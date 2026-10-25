import http from "http";
import fs from "fs";
import path from "path";
import { execSync, spawnSync } from "child_process";
import getMP3Duration from "get-mp3-duration";
import "dotenv/config";

const PORT = process.env.PORT_STUDIO || 3050;

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").replace(/["']/g, "").trim();
const AZURE_FOUNDRY_KEY = (process.env.AZURE_FOUNDRY_KEY || "").replace(/["']/g, "").trim();
const AZURE_KEY = (process.env.AZURE_SPEECH_KEY || "").replace(/["']/g, "").trim();
const AZURE_REGION = (process.env.AZURE_SPEECH_REGION || "eastus").replace(/["']/g, "").trim();
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").replace(/["']/g, "").trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || "").replace(/["']/g, "").trim();
const FISH_API_KEY = (process.env.FISH_API_KEY || "").replace(/["']/g, "").trim();
const DEFAULT_FISH_VOICE = limpiarIdFish(process.env.FISH_VOICE_ID || "");

const AZURE_FLUX_URL =
  "https://reels-foundry-ia.services.ai.azure.com/providers/blackforestlabs/v1/flux-2-pro?api-version=preview";

const CUENTAS_CF = [
  {
    nombre: "Cuenta 1 (Principal)",
    id: (process.env.CLOUDFLARE_ACCOUNT_ID || "").replace(/["']/g, "").trim(),
    token: (process.env.CLOUDFLARE_API_TOKEN || "").replace(/["']/g, "").trim(),
  },
  {
    nombre: "Cuenta 2 (Respaldo)",
    id: (process.env.CLOUDFLARE_ACCOUNT_ID_2 || "").replace(/["']/g, "").trim(),
    token: (process.env.CLOUDFLARE_API_TOKEN_2 || "").replace(/["']/g, "").trim(),
  },
].filter((c) => c.id && c.token);

const VOCES_DOCUMENTAL = {
  narrador: { nombre: "es-MX-JorgeNeural", lang: "es-MX" },
  testigo:  { nombre: "es-ES-AlvaroNeural", lang: "es-ES" },
  archivo:  { nombre: "es-MX-DaliaNeural", lang: "es-MX" },
};

const CONFIG_FORMATOS = {
  documental: {
    numEscenas: 12,
    palabrasPorEscena: "20 a 25 palabras",
    estiloVisualFlux: "35mm documentary film, moody volumetric lighting, historical realism",
    instruccionesFormato: `ESTILO DOCUMENTAL HISTÓRICO (12 escenas): Cuenta la historia de forma cronológica y envolvente como un documental de Netflix. Usa "role": "narrador" en 9 escenas, "role": "testigo" en 2 escenas y "role": "archivo" en 1 escena.`,
  },
  top_datos: {
    numEscenas: 14,
    palabrasPorEscena: "15 a 20 palabras (ritmo rápido y directo)",
    estiloVisualFlux: "hyper-detailed macro or cinematic wide shot, striking contrast, dramatic spotlight",
    instruccionesFormato: `ESTILO TOP 5 DATOS PERTURBADORES / CURIOSOS (14 escenas): Escena 1: "GANCHO", Escenas 2-3: "DATO #5", Escenas 4-5: "DATO #4", Escenas 6-7: "DATO #3", Escenas 8-9: "DATO #2", Escenas 10-12: "DATO #1", Escenas 13-14: "CIERRE".`,
  },
  ciencia: {
    numEscenas: 13,
    palabrasPorEscena: "18 a 23 palabras",
    estiloVisualFlux: "IMAX 70mm science documentary style, Interstellar aesthetic, crisp lighting, deep space or laboratory realism",
    instruccionesFormato: `ESTILO CIENCIA EXTREMA Y EXPLICACIÓN FASCINANTE (13 escenas): Explica el fenómeno paso a paso usando analogías fáciles de imaginar pero asombrosas.`,
  },
  terror: {
    numEscenas: 13,
    palabrasPorEscena: "18 a 23 palabras (con pausas de suspenso usando ...)",
    estiloVisualFlux: "dark psychological thriller cinematography, eerie fog, cold shadows, unsettling atmosphere, A24 film aesthetic",
    instruccionesFormato: `ESTILO TERROR PSICOLÓGICO Y CASOS INEXPLICABLES (13 escenas): Atmósfera de tensión creciente donde cada escena revela un detalle más inquietante.`,
  },
  noticia: {
    numEscenas: 12,
    palabrasPorEscena: "20 a 24 palabras (tono periodístico ágil y contundente)",
    estiloVisualFlux: "photojournalism, Pulitzer prize photography style, high contrast, realistic modern investigative report",
    instruccionesFormato: `ESTILO REPORTAJE PERIODÍSTICO DE IMPACTO (12 escenas): Narra el tema como una investigación de última hora revelando qué ocurrió, dónde y por qué importa.`,
  },
  espiritual: {
    numEscenas: 12,
    palabrasPorEscena: "18 a 24 palabras (tono cálido, reverente, emotivo e inspirador)",
    estiloVisualFlux: "divine golden hour volumetric lighting, peaceful spiritual cinematic realism, warm celestial rays, sacred serene atmosphere",
    instruccionesFormato: `ESTILO ESPIRITUAL, ORACIÓN PODEROSA, HISTORIA BÍBLICA O RELATO DE MILAGRO (12 escenas): Gancho espiritual profundo en Escena 1, desarrollo emotivo con fe y esperanza, cierre invitando a escribir Amén.`,
  },
  infantil: {
    numEscenas: 12,
    palabrasPorEscena: "16 a 22 palabras (lenguaje tierno, alegre, mágico y educativo para niños menores de 10 años)",
    estiloVisualFlux: "3D Pixar and Disney cute animation style, vibrant cheerful colors, adorable expressive characters, magical warm lighting, family friendly",
    instruccionesFormato: `ESTILO CUENTO INFANTIL, VALORES Y APRENDIZAJE ANIMADO PARA NIÑOS (12 escenas): Historia mágica, tierna y divertida con enseñanza de valores, animales o números para niños pequeños.`,
  },
};

function limpiarIdFish(raw) {
  const s = String(raw || "").replace(/["']/g, "").trim();
  return s.includes("/m/") ? s.split("/m/")[1].split("/")[0].split("?")[0] : s;
}

const LOGS = [];
let ESTADO_ACTUAL = { ocupado: false, paso: "Listo para crear", progreso: 0 };

function agregarLog(msg) {
  const hora = new Date().toLocaleTimeString();
  const linea = `[${hora}] ${msg}`;
  console.log(linea);
  LOGS.push(linea);
  if (LOGS.length > 250) LOGS.shift();
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const VOCES_FILE = "./voces_favoritas.json";
function leerVocesFavoritas() {
  if (!fs.existsSync(VOCES_FILE)) {
    const inicial = DEFAULT_FISH_VOICE
      ? [{ nombre: "⭐ Mi Voz Principal (Por defecto)", id: DEFAULT_FISH_VOICE }]
      : [];
    fs.writeFileSync(VOCES_FILE, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  try {
    return JSON.parse(fs.readFileSync(VOCES_FILE, "utf8"));
  } catch {
    return [];
  }
}

function resolverFormato(tema, formatoElegido) {
  if (formatoElegido && formatoElegido !== "auto") return formatoElegido;
  const t = String(tema || "").toLowerCase();
  if (/(oraci[oó]n|plegaria|dios|jes[uú]s|biblia|b[ií]blic|milagro|salmo|fe |bendici[oó]n|ángel|virgen|santo)/.test(t)) return "espiritual";
  if (/(niñ|infantil|cuento para|caricatura|aprendiendo|valores para|fabula|fábula|pequeñitos)/.test(t)) return "infantil";
  if (/(\b5\b|\bcinco\b|datos|cosas que|curiosidades|no sab[ií]as|nadie quiere saber|top )/.test(t)) return "top_datos";
  if (/(terror|escalofriante|maldici[oó]n|paranormal|horror|macabro|perturbador|siniestro|fantasma)/.test(t)) return "terror";
  if (/(ciencia|f[ií]sica|universo|espacio|agujero negro|cerebro|c[oó]mo funciona|paradoja|cu[aá]ntic|planeta)/.test(t)) return "ciencia";
  if (/(noticia|descubren|hallazgo|alerta|acaban de|cient[ií]ficos encuentran|revelan|nuevo|última hora)/.test(t)) return "noticia";
  return "documental";
}

function extraerEscenas(respuesta) {
  if (Array.isArray(respuesta)) return respuesta;
  if (respuesta && typeof respuesta === "object") {
    const posibleArray = Object.values(respuesta).find((v) => Array.isArray(v));
    if (posibleArray) return posibleArray;
  }
  if (typeof respuesta === "string") {
    const limpio = respuesta.replace(/```json|```/gi, "").trim();
    const jsonMatch = limpio.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    const parsed = JSON.parse(limpio);
    if (Array.isArray(parsed)) return parsed;
  }
  return null;
}

async function generarGuionIA(tema, formatoActivo, guionPropio = "") {
  const cfg = CONFIG_FORMATOS[formatoActivo] || CONFIG_FORMATOS.documental;
  const instruccionOrigen = guionPropio
    ? `EL USUARIO PROPORCIONÓ ESTE GUION PROPIO:\n"""\n${guionPropio}\n"""\nDivide este guion en entre 10 y ${cfg.numEscenas} escenas secuenciales RESPETANDO FIELMENTE su texto y sus etiquetas ([pause], <stress>, <whisper>, [...]), y genera para cada escena su "imagePrompt" en inglés.`
    : `Escribe un guion original de exactamente ${cfg.numEscenas} escenas sobre el tema: "${tema}".\n\n${cfg.instruccionesFormato}`;

  const promptSistema = `Actúa como director y guionista experto en Reels virales de altísima retención.
${instruccionOrigen}

Devuelve ÚNICAMENTE un arreglo JSON válido (sin texto adicional ni bloques markdown) con esta estructura exacta:
[
  {
    "id": "1",
    "tag": "GANCHO",
    "role": "narrador",
    "tone": "intriga",
    "text": "Narración en español neutro de ${cfg.palabrasPorEscena}. Usa puntos suspensivos (...) para pausas dramáticas y <stress>palabra</stress> en una palabra clave. Escribe todos los números con letras.",
    "imagePrompt": "Vertical 9:16 shot, main subject centered, ${cfg.estiloVisualFlux}, 8k, no text",
    "imageFile": "ia_escena_1.jpg"
  }
]
Reglas:
- "role": "narrador", "testigo" o "archivo".
- "tone": "intriga", "serio", "impacto" o "reflexion".
- En "imagePrompt": Prompt en inglés con sujeto centrado (${cfg.estiloVisualFlux}). Prohibido usar palabras sangrientas o violentas.`;

  const modelosGemini = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
  ];

  for (const modelo of modelosGemini) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptSistema }] }],
          generationConfig: { temperature: 0.7 },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const escenas = extraerEscenas(data?.candidates?.[0]?.content?.parts?.[0]?.text);
        if (escenas && escenas.length > 0) {
          agregarLog(`✅ Guion [${formatoActivo.toUpperCase()}] creado con Gemini (${modelo} - ${escenas.length} escenas)`);
          return escenas;
        }
      }
    } catch (e) {
      await esperar(1200);
    }
  }
  throw new Error("No se pudo generar el guion con Gemini.");
}

let indiceCF = 0;
async function generarImagenUnica(prompt, outputPath, formatoActivo = "documental", modoImagen = "ahorro") {
  const cfg = CONFIG_FORMATOS[formatoActivo] || CONFIG_FORMATOS.documental;
  const promptFinal = `${prompt}, ${cfg.estiloVisualFlux}, masterpiece, vertical 9:16 composition, sharp focus, 8k, no text, no watermark, natural anatomy`;

  if (modoImagen !== "solo_azure") {
    while (indiceCF < CUENTAS_CF.length) {
      const cuenta = CUENTAS_CF[indiceCF];
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cuenta.id}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${cuenta.token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptFinal, steps: 8 }),
          }
        );
        const data = await res.json();
        if (res.ok && data.success && data.result?.image) {
          fs.writeFileSync(outputPath, Buffer.from(data.result.image, "base64"));
          agregarLog(`🖼️ Imagen creada gratis con Cloudflare (${cuenta.nombre})`);
          return;
        }
        indiceCF++;
      } catch {
        indiceCF++;
      }
    }
  }

  if (AZURE_FOUNDRY_KEY) {
    for (let intento = 1; intento <= 3; intento++) {
      const promptSeguro =
        intento === 1
          ? promptFinal
          : `Atmospheric cinematic vertical 9:16 shot, ${cfg.estiloVisualFlux}, moody volumetric lighting, 8k, photorealistic, no text`;
      try {
        const resAz = await fetch(AZURE_FLUX_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AZURE_FOUNDRY_KEY}`,
            "api-key": AZURE_FOUNDRY_KEY,
          },
          body: JSON.stringify({
            prompt: promptSeguro,
            model: "FLUX.2-pro",
            width: 768,
            height: 1344,
            n: 1,
          }),
        });
        const dataAz = await resAz.json();
        if (resAz.ok && dataAz?.data?.[0]?.b64_json) {
          fs.writeFileSync(outputPath, Buffer.from(dataAz.data[0].b64_json, "base64"));
          agregarLog(`💎 Imagen vertical 9:16 creada con Azure FLUX.2-pro`);
          return;
        }
      } catch {}
      await esperar(1500);
    }
  }
  throw new Error("No se pudo generar la imagen en Cloudflare ni Azure.");
}

function construirTextoDrama3(texto, tono = "serio", rol = "narrador", formatoActivo = "documental") {
  const limpio = String(texto).replace(/\.\.\./g, " [pause] ").replace(/\s+/g, " ").trim();
  if (/^\[[a-zA-Z\s,]+\]/.test(limpio)) return limpio;

  let dir = "[serious, deep captivating documentary narrator]";
  if (formatoActivo === "espiritual") dir = "[warm, reverent, peaceful and deeply comforting spiritual voice]";
  else if (formatoActivo === "infantil") dir = "[warm, cheerful, playful and magical storyteller voice for children]";
  else if (rol === "testigo") dir = "[emotional, weary survivor reading a historical diary, intimate tone]";
  else if (rol === "archivo") dir = "[cold, clinical forensic investigator reading a classified file]";
  else if (formatoActivo === "noticia") dir = "[authoritative investigative news anchor, crisp and urgent tone]";
  else if (tono === "intriga") dir = "[mysterious, low suspenseful tone]";
  else if (tono === "impacto") dir = "[intense, dramatic, shocked tone]";
  else if (tono === "reflexion") dir = "[somber, slow, deep reflective tone]";

  return `${dir} ${limpio}`;
}

async function generarVozUnica(texto, tono, rol, formatoActivo, outputPath, motorVoz = "fish_drama3", idVozFish = "") {
  const vozId = limpiarIdFish(idVozFish) || DEFAULT_FISH_VOICE;

  if (motorVoz === "fish_drama3" && FISH_API_KEY && vozId) {
    const textoActoral = construirTextoDrama3(texto, tono, rol, formatoActivo);
    for (let i = 1; i <= 3; i++) {
      try {
        const res = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FISH_API_KEY}`,
            "Content-Type": "application/json",
            model: "drama-3",
          },
          body: JSON.stringify({
            text: textoActoral,
            reference_id: vozId,
            format: "mp3",
            mp3_bitrate: 192,
            normalize: true,
          }),
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 1000) {
            fs.writeFileSync(outputPath, buf);
            agregarLog(`🎭 Voz creada con Fish Audio Drama-3 (${vozId.slice(0, 8)}...)`);
            return;
          }
        }
      } catch {}
      await esperar(1200);
    }
  }

  const url = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const infoVoz = VOCES_DOCUMENTAL[rol] || VOCES_DOCUMENTAL.narrador;
  const limpioXml = String(texto)
    .replace(/<\/?(stress|whisper)>/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\.\.\./g, '<break time="400ms"/>');

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${infoVoz.lang}">
    <voice name="${infoVoz.nombre}">${limpioXml}</voice>
  </speak>`;

  const resAz = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
      "User-Agent": "RemotionStudio",
    },
    body: ssml,
  });
  if (!resAz.ok) throw new Error(`Error Azure TTS: ${resAz.status}`);
  fs.writeFileSync(outputPath, Buffer.from(await resAz.arrayBuffer()));
  agregarLog(`🎙️ Voz creada con Azure Speech (${infoVoz.nombre})`);
}

async function enviarATelegram(videoPath, tema, formatoActivo) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    agregarLog("⚠️ Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en .env");
    return false;
  }
  let archivo = videoPath;
  let sizeMB = fs.statSync(archivo).size / (1024 * 1024);
  if (sizeMB > 48) {
    const comp = "out/reel_telegram.mp4";
    execSync(`npx remotion ffmpeg -y -i "${videoPath}" -vcodec libx264 -crf 28 -preset fast -acodec copy "${comp}"`, { stdio: "ignore" });
    if (fs.existsSync(comp)) {
      archivo = comp;
      sizeMB = fs.statSync(archivo).size / (1024 * 1024);
    }
  }
  agregarLog(`📲 Enviando Reel (${sizeMB.toFixed(2)} MB) a tu Telegram...`);
  const caption = `🎬 ¡Reel listo para publicar!\n📌 Tema: ${tema}\n🎭 Formato: ${formatoActivo.toUpperCase()}`;
  const r = spawnSync(
    "curl",
    [
      "-s",
      "-X",
      "POST",
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
      "-F",
      `chat_id=${TELEGRAM_CHAT_ID}`,
      "-F",
      `video=@${archivo}`,
      "-F",
      "supports_streaming=true",
      "--form-string",
      `caption=${caption}`,
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  const json = JSON.parse((r.stdout || "{}").trim());
  if (json.ok) {
    agregarLog("✅ ¡Video enviado a tu celular por Telegram!");
    return true;
  } else {
    agregarLog(`❌ Error de Telegram: ${json.description || "Rechazado"}`);
    return false;
  }
}

const HTML_APP = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Estudio Pro de Reels IA — Fish Drama-3 & FLUX</title>
<style>
  :root {
    --bg: #090d16;
    --panel: #111827;
    --card: #1e293b;
    --border: #334155;
    --accent: #38bdf8;
    --accent2: #f59e0b;
    --success: #22c55e;
    --text: #f8fafc;
    --muted: #94a3b8;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }
  header {
    background: linear-gradient(90deg, #0f172a, #1e1b4b);
    border-bottom: 1px solid var(--border);
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .logo { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 20px; }
  .badge-gpu {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid #22c55e;
    color: #4ade80;
    padding: 5px 12px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 700;
  }
  .layout {
    display: grid;
    grid-template-columns: 380px 1fr 350px;
    gap: 16px;
    padding: 16px;
    max-width: 1850px;
    margin: 0 auto;
  }
  @media (max-width: 1300px) {
    .layout { grid-template-columns: 1fr; }
  }
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h2 { font-size: 16px; color: var(--accent); display: flex; align-items: center; gap: 8px; }
  label { font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px; }
  input, select, textarea {
    width: 100%;
    background: #0b1120;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 14px;
  }
  textarea { resize: vertical; min-height: 95px; font-family: inherit; }
  .btn {
    border: none;
    padding: 11px 16px;
    border-radius: 9px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: 0.15s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: linear-gradient(135deg, #0284c7, #2563eb); color: white; }
  .btn-turbo { background: linear-gradient(135deg, #f59e0b, #ea580c); color: white; font-size: 15px; padding: 13px; }
  .btn-success { background: linear-gradient(135deg, #16a34a, #059669); color: white; }
  .btn-sm { padding: 6px 10px; font-size: 12px; border-radius: 6px; background: #334155; color: white; }
  .btn-sm:hover { background: #475569; }
  .status-bar {
    background: #0b1120;
    border: 1px solid var(--border);
    padding: 10px 14px;
    border-radius: 10px;
  }
  .progress-track {
    width: 100%;
    height: 8px;
    background: #1e293b;
    border-radius: 99px;
    overflow: hidden;
    margin-top: 6px;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #38bdf8, #22c55e);
    width: 0%;
    transition: width 0.3s;
  }
  .scenes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 14px;
    max-height: 80vh;
    overflow-y: auto;
    padding-right: 4px;
  }
  .scene-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .scene-img-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 9 / 16;
    max-height: 270px;
    background: #000;
    border-radius: 8px;
    overflow: hidden;
  }
  .scene-img-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .scene-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    background: rgba(15, 23, 42, 0.85);
    color: #38bdf8;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
  }
  audio { width: 100%; height: 32px; }
  .logs-box {
    background: #050811;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    font-family: monospace;
    font-size: 12px;
    color: #a7f3d0;
    height: 220px;
    overflow-y: auto;
    white-space: pre-wrap;
  }
  .video-preview {
    width: 100%;
    aspect-ratio: 9 / 16;
    max-height: 440px;
    background: #000;
    border-radius: 10px;
  }
  .tabs { display: flex; gap: 6px; }
  .tab {
    flex: 1;
    padding: 8px;
    text-align: center;
    background: #0b1120;
    border: 1px solid var(--border);
    border-radius: 7px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .tab.active { background: #1e3a8a; border-color: var(--accent); color: white; }
</style>
</head>
<body>
<header>
  <div class="logo">🎬 ESTUDIO PRO DE REELS IA <span style="font-size:13px;color:#94a3b8;font-weight:500;">| Camaleón Visual 2.0 + Fish Audio Drama-3</span></div>
  <div class="badge-gpu">⚡ Modo Turbo Multi-Núcleo Activo</div>
</header>

<div class="layout">
  <div class="panel">
    <h2>⚙️ 1. Configuración del Reel</h2>

    <div class="tabs">
      <div class="tab active" id="tabAuto" onclick="cambiarModoGuion('auto')">🧠 Crear por Tema</div>
      <div class="tab" id="tabPropio" onclick="cambiarModoGuion('propio')">📜 Pegar mi Guion Experto</div>
    </div>

    <div>
      <label>📌 Tema o Título del Video</label>
      <input id="inputTema" type="text" value="El misterio del barco fantasma Mary Celeste" placeholder="Escribe el tema del Reel..." />
    </div>

    <div id="cajaGuionPropio" style="display:none;">
      <label>📜 Pega aquí tu Guion (de tus 4 Prompts Expertos con etiquetas Drama-3)</label>
      <textarea id="inputGuionPropio" placeholder="[warm, reverent tone] No deslices, esta oración llegó a ti... [pause] <stress>Dios</stress> está contigo..."></textarea>
    </div>

    <div>
      <label>🎭 Formato y Estilo Visual (7 Modos)</label>
      <select id="selectFormato">
        <option value="auto">🤖 Auto-detectar según el tema</option>
        <option value="espiritual">🙏 Espiritual / Oraciones / Biblia / Milagros (Luz Dorada)</option>
        <option value="infantil">🧸 Infantil / Cuentos Pixar 3D / Valores (< 10 años)</option>
        <option value="noticia">📰 Noticia / Periodismo (Cintillo en Vivo + Onda)</option>
        <option value="top_datos">⚡ Top 5 Datos Asombrosos (Barra Progreso + Contador)</option>
        <option value="documental">🎬 Documental Histórico (Estilo Netflix 35mm)</option>
        <option value="ciencia">🌌 Ciencia / Universo / IA (Estilo IMAX)</option>
        <option value="terror">👻 Terror / Casos Inexplicables</option>
      </select>
    </div>

    <div>
      <label>🎙️ Motor de Voz</label>
      <select id="selectMotorVoz">
        <option value="fish_drama3">🎭 Fish Audio Drama-3 (Dirección Actoral + Clonación)</option>
        <option value="azure_multivoz">🎙️ Azure Speech Multi-Voz (3 Voces Documental)</option>
      </select>
    </div>

    <div>
      <label>🔑 Voz de Fish Audio (Selecciona o pega un ID / URL)</label>
      <select id="selectVozGuardada" onchange="seleccionarVozGuardada()" style="margin-bottom:6px;"></select>
      <input id="inputIdVozFish" type="text" placeholder="Vacío = usar tu voz principal por defecto" />
      <div style="display:flex;gap:6px;margin-top:6px;">
        <input id="inputNombreNuevaVoz" type="text" placeholder="Nombre (ej: Voz Cuentos)" style="font-size:12px;padding:6px 8px;" />
        <button class="btn btn-sm" onclick="guardarVozFavorita()">💾 Guardar Voz</button>
      </div>
    </div>

    <div>
      <label>🖼️ Prioridad del Generador de Imágenes</label>
      <select id="selectModoImagen">
        <option value="ahorro">⚡ Ahorro: 1º Cloudflare Gratis (Cuentas 1 y 2) ➔ 2º Azure FLUX.2-pro</option>
        <option value="solo_azure">💎 Directo Azure FLUX.2-pro (768x1344 Vertical)</option>
      </select>
    </div>

    <button class="btn btn-primary" id="btnGenerarEscenas" onclick="generarEscenas(false)">
      ✨ 1. Generar Guion, Fotos y Voces (Previsualizar)
    </button>

    <button class="btn btn-turbo" id="btnTodoEnUno" onclick="generarEscenas(true)">
      🚀 Crear, Renderizar MP4 y Enviar a Telegram (Todo en 1 Clic)
    </button>

    <div class="status-bar">
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;">
        <span id="txtEstado">Listo</span>
        <span id="txtPorcentaje">0%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" id="barraProgreso"></div></div>
    </div>
  </div>

  <div class="panel">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <h2>🎞️ 2. Estudio de Escenas (Edita o regenera cualquier foto o voz individualmente)</h2>
      <button class="btn btn-sm" onclick="cargarEscenasActuales()">🔄 Refrescar Galería</button>
    </div>
    <div class="scenes-grid" id="galeriaEscenas"></div>
  </div>

  <div class="panel">
    <h2>🎬 3. Video Final y Exportación</h2>

    <video id="videoPlayer" class="video-preview" controls src="/out/reel_azure_premium.mp4"></video>

    <button class="btn btn-success" id="btnRenderizar" onclick="renderizarVideo()">
      🎬 Renderizar Video MP4 Ahora (Modo Turbo)
    </button>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <a class="btn btn-sm" href="/out/reel_azure_premium.mp4" download="Reel_Terminado.mp4" style="text-decoration:none;text-align:center;">⬇️ Descargar MP4</a>
      <a class="btn btn-sm" href="/out/portada_reel.jpg" download="Portada_Reel.jpg" style="text-decoration:none;text-align:center;">🖼️ Descargar Portada</a>
    </div>

    <button class="btn btn-primary" onclick="enviarTelegramManual()">
      📲 Enviar este MP4 a mi Telegram
    </button>

    <label style="margin-top:6px;">🖥️ Consola en Vivo</label>
    <div class="logs-box" id="cajaLogs"></div>
  </div>
</div>

<script>
let modoGuion = 'auto';
let escenasMemoria = [];

function cambiarModoGuion(modo) {
  modoGuion = modo;
  document.getElementById('tabAuto').classList.toggle('active', modo === 'auto');
  document.getElementById('tabPropio').classList.toggle('active', modo === 'propio');
  document.getElementById('cajaGuionPropio').style.display = modo === 'propio' ? 'block' : 'none';
}

async function cargarVocesFavoritas() {
  const r = await fetch('/api/voces');
  const voces = await r.json();
  const sel = document.getElementById('selectVozGuardada');
  sel.innerHTML = '<option value="">-- Elegir de mis voces guardadas --</option>' +
    voces.map(v => \`<option value="\${v.id}">\${v.nombre} (\${v.id.slice(0,8)}...)</option>\`).join('');
}

function seleccionarVozGuardada() {
  const val = document.getElementById('selectVozGuardada').value;
  if (val) document.getElementById('inputIdVozFish').value = val;
}

async function guardarVozFavorita() {
  const nombre = document.getElementById('inputNombreNuevaVoz').value.trim();
  const id = document.getElementById('inputIdVozFish').value.trim();
  if (!nombre || !id) return alert('Escribe un nombre y pega el ID o URL de la voz de Fish Audio.');
  await fetch('/api/voces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, id })
  });
  document.getElementById('inputNombreNuevaVoz').value = '';
  await cargarVocesFavoritas();
}

async function cargarEscenasActuales() {
  const r = await fetch('/api/escenas');
  const data = await r.json();
  escenasMemoria = data.scenes || [];
  dibujarGaleria();
}

function dibujarGaleria() {
  const cont = document.getElementById('galeriaEscenas');
  const ts = Date.now();
  if (!escenasMemoria.length) {
    cont.innerHTML = '<div style="color:#94a3b8;padding:20px;">Aún no hay escenas cargadas. Haz clic en "Generar Guion, Fotos y Voces".</div>';
    return;
  }
  cont.innerHTML = escenasMemoria.map((s, idx) => \`
    <div class="scene-card">
      <div class="scene-img-wrap">
        <img src="/public/\${s.image}?t=\${ts}" onerror="this.style.opacity=0.2" />
        <div class="scene-badge">#\${idx + 1} — \${s.tag || 'ESCENA'} (\${s.role || 'narrador'})</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm" style="flex:1;" onclick="regenerarImagen(\${idx}, 'ahorro')">🔄 Foto Cloudflare</button>
        <button class="btn btn-sm" style="flex:1;background:#1d4ed8;" onclick="regenerarImagen(\${idx}, 'solo_azure')">💎 Foto Azure</button>
      </div>
      <audio controls src="/public/\${s.audioFile}?t=\${ts}"></audio>
      <textarea id="txtEscena_\${idx}" style="min-height:68px;font-size:12px;">\${s.text || ''}</textarea>
      <button class="btn btn-sm" onclick="regenerarVoz(\${idx})">🎙️ Actualizar Voz de Escena #\${idx + 1}</button>
    </div>
  \`).join('');
}

async function generarEscenas(renderizarAlFinal) {
  const payload = {
    tema: document.getElementById('inputTema').value,
    formato: document.getElementById('selectFormato').value,
    motorVoz: document.getElementById('selectMotorVoz').value,
    idVozFish: document.getElementById('inputIdVozFish').value,
    modoImagen: document.getElementById('selectModoImagen').value,
    guionPropio: modoGuion === 'propio' ? document.getElementById('inputGuionPropio').value : '',
    renderizarAlFinal
  };
  await fetch('/api/generar-todo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function regenerarImagen(index, modoImagen) {
  await fetch('/api/regenerar-imagen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, modoImagen })
  });
  await cargarEscenasActuales();
}

async function regenerarVoz(index) {
  const nuevoTexto = document.getElementById('txtEscena_' + index).value;
  const motorVoz = document.getElementById('selectMotorVoz').value;
  const idVozFish = document.getElementById('inputIdVozFish').value;
  await fetch('/api/regenerar-voz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ index, texto: nuevoTexto, motorVoz, idVozFish })
  });
  await cargarEscenasActuales();
}

async function renderizarVideo() {
  await fetch('/api/renderizar', { method: 'POST' });
  document.getElementById('videoPlayer').src = '/out/reel_azure_premium.mp4?t=' + Date.now();
}

async function enviarTelegramManual() {
  const tema = document.getElementById('inputTema').value;
  const formato = document.getElementById('selectFormato').value;
  await fetch('/api/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tema, formato })
  });
}

setInterval(async () => {
  try {
    const r = await fetch('/api/estado');
    const d = await r.json();
    document.getElementById('txtEstado').textContent = d.estado.paso;
    document.getElementById('txtPorcentaje').textContent = d.estado.progreso + '%';
    document.getElementById('barraProgreso').style.width = d.estado.progreso + '%';
    const caja = document.getElementById('cajaLogs');
    caja.textContent = d.logs.join('\\n');
    caja.scrollTop = caja.scrollHeight;
  } catch {}
}, 1500);

cargarVocesFavoritas();
cargarEscenasActuales();
</script>
</body>
</html>`;

function leerBodyJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  if (req.method === "GET" && pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(HTML_APP);
  }

  if (req.method === "GET" && (pathname.startsWith("/public/") || pathname.startsWith("/out/"))) {
    const filePath = path.join(process.cwd(), pathname.slice(1));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === ".mp4"
          ? "video/mp4"
          : ext === ".mp3"
            ? "audio/mpeg"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
      return fs.createReadStream(filePath).pipe(res);
    }
    res.writeHead(404);
    return res.end("No encontrado");
  }

  if (req.method === "GET" && pathname === "/api/estado") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ estado: ESTADO_ACTUAL, logs: LOGS }));
  }

  if (req.method === "GET" && pathname === "/api/voces") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(leerVocesFavoritas()));
  }

  if (req.method === "POST" && pathname === "/api/voces") {
    const { nombre, id } = await leerBodyJson(req);
    const lista = leerVocesFavoritas();
    lista.push({ nombre, id: limpiarIdFish(id) });
    fs.writeFileSync(VOCES_FILE, JSON.stringify(lista, null, 2));
    agregarLog(`💾 Voz "${nombre}" guardada en tu biblioteca.`);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "GET" && pathname === "/api/escenas") {
    if (fs.existsSync("./guion_sincronizado.json")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(fs.readFileSync("./guion_sincronizado.json", "utf8"));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ scenes: [] }));
  }

  if (req.method === "POST" && pathname === "/api/generar-todo") {
    const body = await leerBodyJson(req);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ started: true }));

    (async () => {
      try {
        ESTADO_ACTUAL = { ocupado: true, paso: "Generando guion con IA...", progreso: 8 };
        const formatoActivo = resolverFormato(body.tema, body.formato);
        const listaEscenas = await generarGuionIA(body.tema, formatoActivo, body.guionPropio);
        const processedScenes = [];

        for (let i = 0; i < listaEscenas.length; i++) {
          const s = listaEscenas[i];
          const pct = Math.round(10 + ((i + 1) / listaEscenas.length) * 65);
          ESTADO_ACTUAL = {
            ocupado: true,
            paso: `Escena ${i + 1}/${listaEscenas.length}: Creando imagen y voz...`,
            progreso: pct,
          };

          const nombreImagen = `ia_escena_${i + 1}.jpg`;
          const audioFile = `audio_scene_${i + 1}.mp3`;
          const tonoEscena = s.tone || "serio";
          const rolEscena = s.role && VOCES_DOCUMENTAL[s.role] ? s.role : "narrador";

          await generarImagenUnica(s.imagePrompt, `public/${nombreImagen}`, formatoActivo, body.modoImagen);
          await generarVozUnica(
            s.text,
            tonoEscena,
            rolEscena,
            formatoActivo,
            `public/${audioFile}`,
            body.motorVoz,
            body.idVozFish
          );

          const durationSec = getMP3Duration(fs.readFileSync(`public/${audioFile}`)) / 1000;
          const esUltima = i === listaEscenas.length - 1;
          const totalFrames = Math.ceil(durationSec * 30) + (esUltima ? 2 : 8);

          processedScenes.push({
            id: String(i + 1),
            tag: s.tag || `ESCENA ${i + 1}`,
            format: formatoActivo,
            role: rolEscena,
            tone: tonoEscena,
            text: s.text,
            imagePrompt: s.imagePrompt,
            image: nombreImagen,
            audioFile,
            durationInFrames: totalFrames,
          });

          fs.writeFileSync("./guion_sincronizado.json", JSON.stringify({ scenes: processedScenes }, null, 2));
        }

        if (!fs.existsSync("out")) fs.mkdirSync("out", { recursive: true });
        if (fs.existsSync("public/ia_escena_1.jpg")) {
          fs.copyFileSync("public/ia_escena_1.jpg", "out/portada_reel.jpg");
        }

        if (body.renderizarAlFinal) {
          ESTADO_ACTUAL = { ocupado: true, paso: "Renderizando MP4 en Modo Turbo...", progreso: 85 };
          agregarLog("🎬 Renderizando video MP4 con Remotion Turbo...");
          execSync(`npx remotion render LongReel out/reel_azure_premium.mp4 --concurrency=100% --crf=23`, {
            stdio: "inherit",
          });
          await enviarATelegram("out/reel_azure_premium.mp4", body.tema, formatoActivo);
        }

        ESTADO_ACTUAL = { ocupado: false, paso: "🎉 ¡Proceso completado con éxito!", progreso: 100 };
      } catch (err) {
        agregarLog(`❌ Error: ${err.message}`);
        ESTADO_ACTUAL = { ocupado: false, paso: "Error en el proceso", progreso: 0 };
      }
    })();
    return;
  }

  if (req.method === "POST" && pathname === "/api/regenerar-imagen") {
    const { index, modoImagen } = await leerBodyJson(req);
    const data = JSON.parse(fs.readFileSync("./guion_sincronizado.json", "utf8"));
    const s = data.scenes[index];
    if (s) {
      ESTADO_ACTUAL = { ocupado: true, paso: `Regenerando foto de Escena #${index + 1}...`, progreso: 50 };
      await generarImagenUnica(s.imagePrompt, `public/${s.image}`, s.format || "documental", modoImagen);
      ESTADO_ACTUAL = { ocupado: false, paso: `✅ Foto #${index + 1} actualizada`, progreso: 100 };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "POST" && pathname === "/api/regenerar-voz") {
    const { index, texto, motorVoz, idVozFish } = await leerBodyJson(req);
    const data = JSON.parse(fs.readFileSync("./guion_sincronizado.json", "utf8"));
    const s = data.scenes[index];
    if (s) {
      ESTADO_ACTUAL = { ocupado: true, paso: `Regenerando voz de Escena #${index + 1}...`, progreso: 50 };
      s.text = texto;
      await generarVozUnica(texto, s.tone, s.role, s.format, `public/${s.audioFile}`, motorVoz, idVozFish);
      const durationSec = getMP3Duration(fs.readFileSync(`public/${s.audioFile}`)) / 1000;
      const esUltima = index === data.scenes.length - 1;
      s.durationInFrames = Math.ceil(durationSec * 30) + (esUltima ? 2 : 8);
      fs.writeFileSync("./guion_sincronizado.json", JSON.stringify(data, null, 2));
      ESTADO_ACTUAL = { ocupado: false, paso: `✅ Voz #${index + 1} actualizada`, progreso: 100 };
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "POST" && pathname === "/api/renderizar") {
    ESTADO_ACTUAL = { ocupado: true, paso: "Renderizando MP4 en Modo Turbo...", progreso: 50 };
    agregarLog("🎬 Iniciando renderizado Turbo del Reel...");
    execSync(`npx remotion render LongReel out/reel_azure_premium.mp4 --concurrency=100% --crf=23`, {
      stdio: "inherit",
    });
    ESTADO_ACTUAL = { ocupado: false, paso: "🎉 ¡Video MP4 renderizado!", progreso: 100 };
    agregarLog("✅ ¡Video MP4 listo para ver y descargar!");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "POST" && pathname === "/api/telegram") {
    const { tema, formato } = await leerBodyJson(req);
    await enviarATelegram("out/reel_azure_premium.mp4", tema || "Reel IA", formato || "documental");
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  agregarLog(`🚀 Estudio Pro de Reels IA iniciado en: http://localhost:${PORT}`);
});