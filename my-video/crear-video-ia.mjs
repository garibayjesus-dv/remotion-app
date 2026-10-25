import fs from "fs";
import { execSync, spawnSync } from "child_process";
import getMP3Duration from "get-mp3-duration";
import "dotenv/config";

const TEMA = process.env.TEMA_VIDEO || "El misterio del Pozo Superprofundo de Kola";
const FORMATO_INPUT = (process.env.FORMATO_VIDEO || "auto").toLowerCase().trim();
const MOTOR_VOZ = (process.env.MOTOR_VOZ || "fish_drama3").toLowerCase().trim();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AZURE_FOUNDRY_KEY = process.env.AZURE_FOUNDRY_KEY;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").replace(/["']/g, "").trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || "").replace(/["']/g, "").trim();

const FISH_API_KEY = (process.env.FISH_API_KEY || "").replace(/["']/g, "").trim();
const RAW_FISH_VOICE = (process.env.FISH_VOICE_OVERRIDE || process.env.FISH_VOICE_ID || "")
  .replace(/["']/g, "")
  .trim();

const FISH_VOICE_ID = RAW_FISH_VOICE.includes("/m/")
  ? RAW_FISH_VOICE.split("/m/")[1].split("/")[0].split("?")[0]
  : RAW_FISH_VOICE;

const VOCES_DOCUMENTAL = {
  narrador: { nombre: "es-MX-JorgeNeural", lang: "es-MX", etiqueta: "🎙️ Narrador Principal" },
  testigo:  { nombre: "es-ES-AlvaroNeural", lang: "es-ES", etiqueta: "📜 Voz de Testigo/Cita" },
  archivo:  { nombre: "es-MX-DaliaNeural", lang: "es-MX", etiqueta: "📁 Voz Forense/Datos" },
};

const AZURE_FLUX_URL =
  "https://reels-foundry-ia.services.ai.azure.com/providers/blackforestlabs/v1/flux-2-pro?api-version=preview";

const CUENTAS_CF = [
  {
    nombre: "Cuenta 1 (Principal)",
    id: process.env.CLOUDFLARE_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
  },
  {
    nombre: "Cuenta 2 (Respaldo)",
    id: process.env.CLOUDFLARE_ACCOUNT_ID_2,
    token: process.env.CLOUDFLARE_API_TOKEN_2,
  },
].filter((c) => c.id && c.token);

let indiceCuentaActual = 0;
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolverFormato(tema, formatoElegido) {
  if (formatoElegido && formatoElegido !== "auto") return formatoElegido;
  const t = tema.toLowerCase();
  if (/(\b5\b|\bcinco\b|datos|cosas que|curiosidades|no sab[ií]as|nadie quiere saber|top )/.test(t)) {
    return "top_datos";
  }
  if (/(terror|escalofriante|maldici[oó]n|paranormal|horror|macabro|perturbador|siniestro|fantasma)/.test(t)) {
    return "terror";
  }
  if (/(ciencia|f[ií]sica|universo|espacio|agujero negro|cerebro|c[oó]mo funciona|paradoja|cu[aá]ntic|planeta)/.test(t)) {
    return "ciencia";
  }
  if (/(noticia|descubren|hallazgo|alerta|acaban de|cient[ií]ficos encuentran|revelan|nuevo)/.test(t)) {
    return "noticia";
  }
  return "documental";
}

const CONFIG_FORMATOS = {
  documental: {
    numEscenas: 12,
    palabrasPorEscena: "20 a 25 palabras",
    estiloVisualFlux: "35mm documentary film, moody volumetric lighting, historical realism",
    instruccionesFormato: `ESTILO DOCUMENTAL HISTÓRICO (12 escenas):
- Cuenta la historia de forma cronológica y envolvente como un documental de Netflix.
- Usa "role": "narrador" en 9 escenas, "role": "testigo" en 2 escenas (leyendo un diario, bitácora o testimonio en primera persona) y "role": "archivo" en 1 escena (revelando un dato forense u oficial).`,
  },
  top_datos: {
    numEscenas: 14,
    palabrasPorEscena: "15 a 20 palabras (ritmo rápido y directo)",
    estiloVisualFlux: "hyper-detailed macro or cinematic wide shot, striking contrast, dramatic spotlight",
    instruccionesFormato: `ESTILO TOP 5 DATOS PERTURBADORES / CURIOSOS (14 escenas rápidas):
- Estructura obligatoria de etiquetas ("tag") para mantener a la audiencia hasta el final:
  * Escena 1: "tag": "GANCHO" (Presenta por qué nadie está preparado para el Dato #1).
  * Escenas 2 y 3: "tag": "DATO #5"
  * Escenas 4 y 5: "tag": "DATO #4"
  * Escenas 6 y 7: "tag": "DATO #3"
  * Escenas 8 y 9: "tag": "DATO #2"
  * Escenas 10, 11 y 12: "tag": "DATO #1" (El dato más impactante explicado en 3 tomas).
  * Escenas 13 y 14: "tag": "CIERRE" (Reflexión rápida y conector de Loop Infinito hacia la Escena 1).`,
  },
  ciencia: {
    numEscenas: 13,
    palabrasPorEscena: "18 a 23 palabras",
    estiloVisualFlux: "IMAX 70mm science documentary style, Interstellar aesthetic, crisp lighting, deep space or laboratory realism",
    instruccionesFormato: `ESTILO CIENCIA EXTREMA Y EXPLICACIÓN FASCINANTE (13 escenas):
- Explica el fenómeno, paradoja o misterio científico paso a paso usando analogías fáciles de imaginar pero asombrosas.
- Usa "role": "narrador" como conductor principal y mete a "role": "archivo" en 2 escenas para dar cifras exactas o leyes físicas sorprendentes.`,
  },
  terror: {
    numEscenas: 13,
    palabrasPorEscena: "18 a 23 palabras (con pausas de suspenso usando ...)",
    estiloVisualFlux: "dark psychological thriller cinematography, eerie fog, cold shadows, unsettling atmosphere, A24 film aesthetic",
    instruccionesFormato: `ESTILO TERROR PSICOLÓGICO Y CASOS INEXPLICABLES (13 escenas):
- Construye una atmósfera de tensión creciente donde cada escena revela un detalle más inquietante que el anterior.
- Usa "role": "narrador" en tono de misterio/intriga y mete a "role": "testigo" en 2 escenas clave leyendo las últimas palabras, grabaciones o relatos de quienes lo vivieron.`,
  },
  noticia: {
    numEscenas: 12,
    palabrasPorEscena: "20 a 24 palabras (tono periodístico ágil y contundente)",
    estiloVisualFlux: "photojournalism, Pulitzer prize photography style, high contrast, realistic modern investigative report",
    instruccionesFormato: `ESTILO REPORTAJE PERIODÍSTICO DE IMPACTO (12 escenas):
- Narra el tema como una investigación de última hora o reportaje especial revelando qué se descubrió, dónde ocurrió, qué dicen las pruebas y por qué preocupa a los expertos.
- Usa "role": "narrador", "role": "archivo" en 2 escenas para citar el informe técnico y "role": "testigo" en 1 escena para citar declaraciones.`,
  },
};

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

// ==========================================
// 1. GENERADOR DE GUION CAMALEÓNICO CON ETIQUETAS DRAMA-3
// ==========================================
async function generarGuionAutomatico(tema, formatoActivo) {
  const cfg = CONFIG_FORMATOS[formatoActivo] || CONFIG_FORMATOS.documental;
  console.log(
    `🧠 Generando guion formato [${formatoActivo.toUpperCase()}] (${cfg.numEscenas} escenas) sobre: "${tema}"...`
  );

  const promptSistema = `Actúa como director y guionista experto en Reels virales de altísima retención.
Escribe un guion de exactamente ${cfg.numEscenas} escenas sobre el tema: "${tema}".

${cfg.instruccionesFormato}

Devuelve ÚNICAMENTE un arreglo JSON válido (sin texto adicional ni bloques markdown) con esta estructura exacta:
[
  {
    "id": "1",
    "tag": "GANCHO",
    "role": "narrador",
    "tone": "intriga",
    "text": "Narración en español neutro de ${cfg.palabrasPorEscena}. Usa puntos suspensivos (...) para pausas dramáticas, envuelve UNA palabra clave importante por escena en <stress>palabra</stress> y, solo en momentos de mucho misterio, una frase corta final en <whisper>frase susurrada</whisper>. Escribe todos los números con letras.",
    "imagePrompt": "Vertical 9:16 shot, main subject centered, ${cfg.estiloVisualFlux}, 8k, no text",
    "imageFile": "ia_escena_1.jpg"
  }
]
Reglas técnicas obligatorias:
- Exactamente ${cfg.numEscenas} escenas numeradas del 1 al ${cfg.numEscenas} ("ia_escena_1.jpg" a "ia_escena_${cfg.numEscenas}.jpg").
- "role" solo puede ser: "narrador", "testigo" o "archivo".
- "tone" solo puede ser: "intriga", "serio", "impacto" o "reflexion".
- En "text": Escribe todos los números con letras. Puedes usar <stress>palabra</stress> para dar énfasis vocal a una palabra clave y puntos suspensivos (...) donde quieras una pausa dramática.
- En "imagePrompt": Escribe un prompt en inglés con UN sujeto u objeto centrado. REGLA DE SEGURIDAD: NUNCA uses palabras gráficas, violencia, cadáveres ni sangre (prohibido: blood, corpse, dead, cannibalism, bones, skull, gore, kill, weapon, torture). Usa metáforas visuales atmosféricas y seguras.
- REGLA DE LOOP INFINITO VIRAL: El final de la Escena ${cfg.numEscenas} y el inicio de la Escena 1 deben formar UNA SOLA ORACIÓN CONTINUA cuando el video se repita en bucle (la última escena termina en frase abierta sin punto final y la primera escena la completa como gancho).`;

  if (GEMINI_API_KEY) {
    const modelosGemini = [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-omni-1.1-flash",
      "gemini-4-argon",
      "gemma-4-31b-it",
    ];

    for (const modelo of modelosGemini) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY.trim()}`;
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
          const textoJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          const escenas = extraerEscenas(textoJson);
          if (escenas && escenas.length > 0) {
            console.log(`✅ Guion [${formatoActivo}] generado con Google Gemini (${modelo} - ${escenas.length} escenas).`);
            return escenas;
          }
        } else {
          console.warn(`⚠️ Aviso de Gemini API (${modelo}): ${data.error?.message || JSON.stringify(data)}`);
          await esperar(2500);
        }
      } catch (e) {
        console.warn(`⚠️ Error al conectar con Gemini (${modelo}): ${e.message}`);
        await esperar(2000);
      }
    }
  }

  for (let i = 0; i < CUENTAS_CF.length; i++) {
    const cuenta = CUENTAS_CF[i];
    try {
      const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${cuenta.id}/ai/run/@cf/meta/llama-3.1-8b-instruct`;
      const response = await fetch(cfUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cuenta.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Responde únicamente con un JSON array válido sin markdown." },
            { role: "user", content: promptSistema },
          ],
          max_tokens: 3800,
        }),
      });

      const data = await response.json();
      if (data.success && data.result?.response) {
        const escenas = extraerEscenas(data.result.response);
        if (escenas && escenas.length > 0) {
          console.log(`✅ Guion generado usando ${cuenta.nombre} (${escenas.length} escenas).`);
          return escenas;
        }
      }
    } catch (err) {
      console.warn(`⚠️ Error en ${cuenta.nombre}: ${err.message}`);
    }
  }

  throw new Error("❌ No se pudo generar el guion: todas las fuentes y cuentas fallaron.");
}

// ==========================================
// 2. GENERADOR DE IMÁGENES:
//    1º CLOUDFLARE GRATIS (Cuenta 1 -> Cuenta 2)
//    2º RESPALDO AUTOMÁTICO: AZURE FLUX.2-PRO (768x1344)
// ==========================================
async function generarImagenIA(prompt, outputPath, numeroEscena, formatoActivo) {
  const cfg = CONFIG_FORMATOS[formatoActivo] || CONFIG_FORMATOS.documental;
  const promptFinal = `${prompt}, ${cfg.estiloVisualFlux}, masterpiece, photorealistic, vertical 9:16 composition, sharp focus, 8k, no text, no watermark, natural anatomy`;

  // PASO 1: Intentar primero con tus cuentas gratuitas de Cloudflare (Cuenta 1 -> Cuenta 2)
  while (indiceCuentaActual < CUENTAS_CF.length) {
    const cuenta = CUENTAS_CF[indiceCuentaActual];
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cuenta.id}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cuenta.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt: promptFinal, steps: 8 }),
        }
      );

      const data = await response.json();
      if (response.ok && data.success && data.result?.image) {
        fs.writeFileSync(outputPath, Buffer.from(data.result.image, "base64"));
        console.log(`   🖼️ Imagen generada gratis con Cloudflare (${cuenta.nombre})`);
        return;
      } else {
        const motivo = data?.errors?.[0]?.message || response.status;
        console.warn(`   ⚠️ Cloudflare ${cuenta.nombre} sin créditos o límite alcanzado (${motivo}). Pasando al siguiente respaldo...`);
        indiceCuentaActual++;
      }
    } catch (err) {
      console.warn(`   ⚠️ Error en Cloudflare ${cuenta.nombre} (${err.message}). Pasando al siguiente respaldo...`);
      indiceCuentaActual++;
    }
  }

  // PASO 2: Si ambas cuentas de Cloudflare agotaron sus créditos hoy, entra Azure FLUX.2-pro automáticamente
  if (AZURE_FOUNDRY_KEY) {
    for (let intento = 1; intento <= 3; intento++) {
      const promptSeguro =
        intento === 1
          ? promptFinal
          : `Atmospheric cinematic vertical 9:16 shot inspired by ${TEMA}, ${cfg.estiloVisualFlux}, mysterious scene, moody volumetric lighting, 8k, photorealistic, no text`;
      try {
        const resAz = await fetch(AZURE_FLUX_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AZURE_FOUNDRY_KEY.trim()}`,
            "api-key": AZURE_FOUNDRY_KEY.trim(),
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
          console.log(`   🖼️ Imagen vertical 9:16 generada con respaldo Azure FLUX.2-pro`);
          return;
        } else {
          console.warn(`   ⚠️ Aviso Azure FLUX.2-pro (intento ${intento}/3): ${dataAz?.error?.message || resAz.status}`);
          await esperar(2000 * intento);
        }
      } catch (err) {
        console.warn(`   ⚠️ Error de red Azure FLUX.2-pro (intento ${intento}/3): ${err.message}`);
        await esperar(2000 * intento);
      }
    }
  }

  throw new Error(`❌ No se pudo generar la imagen de la escena ${numeroEscena}.`);
}

// ==========================================
// 3A. MOTOR DE VOZ PRINCIPAL: FISH AUDIO DRAMA-3 (DIRECCIÓN ACTORAL)
// ==========================================
function construirTextoDrama3(texto, tono = "serio", rol = "narrador", formatoActivo = "documental") {
  let direccionActoral = "[serious, deep captivating documentary narrator]";

  if (rol === "testigo") {
    direccionActoral = "[emotional, weary survivor reading a historical diary, intimate tone]";
  } else if (rol === "archivo") {
    direccionActoral = "[cold, clinical forensic investigator reading a classified file]";
  } else if (formatoActivo === "noticia" && (tono === "serio" || tono === "impacto")) {
    direccionActoral = "[authoritative investigative news anchor, crisp and urgent tone]";
  } else if (tono === "intriga") {
    direccionActoral = "[mysterious, low suspenseful tone]";
  } else if (tono === "impacto") {
    direccionActoral = "[intense, dramatic, shocked tone]";
  } else if (tono === "reflexion") {
    direccionActoral = "[somber, slow, deep reflective tone]";
  }

  const textoFormateado = String(texto)
    .replace(/\.\.\./g, " [pause] ")
    .replace(/\s+/g, " ")
    .trim();

  return `${direccionActoral} ${textoFormateado}`;
}

async function generarVozFishDrama3(texto, tono, rol, formatoActivo, outputPath) {
  if (!FISH_API_KEY || !FISH_VOICE_ID) {
    return false;
  }

  const textoActoral = construirTextoDrama3(texto, tono, rol, formatoActivo);

  for (let intento = 1; intento <= 3; intento++) {
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
          reference_id: FISH_VOICE_ID,
          format: "mp3",
          mp3_bitrate: 192,
          normalize: true,
        }),
      });

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 1000) {
          fs.writeFileSync(outputPath, buffer);
          console.log(`   🎭 Voz generada con Fish Audio Drama-3 (ID: ${FISH_VOICE_ID.slice(0, 8)}...)`);
          return true;
        }
      } else {
        const errTxt = await res.text();
        console.warn(`   ⚠️ Aviso Fish Drama-3 (intento ${intento}/3): ${res.status} ${errTxt}`);
        await esperar(1500 * intento);
      }
    } catch (err) {
      console.warn(`   ⚠️ Error de conexión Fish Drama-3 (intento ${intento}/3): ${err.message}`);
      await esperar(1500 * intento);
    }
  }

  return false;
}

// ==========================================
// 3B. MOTOR DE VOZ SECUNDARIO / RESPALDO: AZURE SPEECH MULTI-VOZ
// ==========================================
function escaparXml(texto) {
  return String(texto)
    .replace(/<\/?(stress|whisper)>/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function generarVozAzure(texto, tono = "serio", rol = "narrador", formatoActivo = "documental", outputPath) {
  const url = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const infoVoz = VOCES_DOCUMENTAL[rol] || VOCES_DOCUMENTAL.narrador;

  const configuracionTono = {
    intriga:   { style: "whispering", styledegree: "0.65", rate: "+4%", pitch: "-4%" },
    serio:     { style: "narration-professional", styledegree: "1.35", rate: "+2%", pitch: "-5%" },
    impacto:   { style: "excited", styledegree: "1.25", rate: "+6%", pitch: "-2%" },
    reflexion: { style: "empathetic", styledegree: "1.25", rate: "-2%", pitch: "-6%" },
  };

  let cfg = { ...(configuracionTono[tono] || configuracionTono.serio) };

  if (rol === "narrador") {
    if (formatoActivo === "noticia" && (tono === "serio" || tono === "impacto")) {
      cfg = { style: "newscast-formal", styledegree: "1.35", rate: "+6%", pitch: "-3%" };
    } else if (formatoActivo === "top_datos") {
      cfg.rate = "+6%";
    } else if (formatoActivo === "terror") {
      cfg.pitch = "-6%";
    }
  }

  const rateFinal = rol === "testigo" ? "-3%" : rol === "archivo" ? "+4%" : cfg.rate;
  const pitchFinal = rol === "testigo" ? "-7%" : rol === "archivo" ? "-2%" : cfg.pitch;

  const textoConPausas = escaparXml(texto)
    .replace(/\.\.\./g, '<break time="420ms"/>')
    .replace(/\. /g, '. <break time="280ms"/>')
    .replace(/\? /g, '? <break time="320ms"/>')
    .replace(/! /g, '! <break time="320ms"/>');

  const cuerpoVoz =
    rol === "narrador"
      ? `<mstts:express-as style="${cfg.style}" styledegree="${cfg.styledegree}">
          <prosody rate="${rateFinal}" pitch="${pitchFinal}">
            ${textoConPausas}
          </prosody>
        </mstts:express-as>`
      : `<prosody rate="${rateFinal}" pitch="${pitchFinal}">
          <break time="180ms"/>${textoConPausas}
        </prosody>`;

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${infoVoz.lang}">
    <voice name="${infoVoz.nombre}">
      ${cuerpoVoz}
    </voice>
  </speak>`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
      "User-Agent": "RemotionReels",
    },
    body: ssml,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error de Azure TTS (${response.status}): ${errText}`);
  }
  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  console.log(`   🎙️ Voz generada con Azure Speech (${infoVoz.nombre})`);
}

// ==========================================
// 4. ENVÍO AUTOMÁTICO DEL REEL A TU TELEGRAM (BLINDADO)
// ==========================================
async function enviarVideoTelegram(videoPath, tema, formatoActivo) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están configurados en Secrets.");
    return;
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`❌ No se encontró el archivo de video en ${videoPath}.`);
    return;
  }

  let archivoAEnviar = videoPath;
  let sizeMB = fs.statSync(archivoAEnviar).size / (1024 * 1024);

  // Escudo contra el límite de 50 MB de los bots de Telegram
  if (sizeMB > 48) {
    console.log(`⚠️ El video pesa ${sizeMB.toFixed(2)} MB (>48 MB). Optimizando copia para Telegram...`);
    const comprimidoPath = "out/reel_telegram.mp4";
    try {
      execSync(
        `npx remotion ffmpeg -y -i "${videoPath}" -vcodec libx264 -crf 28 -preset fast -acodec copy "${comprimidoPath}"`,
        { stdio: "ignore" }
      );
      if (fs.existsSync(comprimidoPath)) {
        archivoAEnviar = comprimidoPath;
        sizeMB = fs.statSync(archivoAEnviar).size / (1024 * 1024);
      }
    } catch (e) {
      console.warn("⚠️ No se pudo recomprimir, intentando enviar archivo original...");
    }
  }

  console.log(`\n📲 Enviando video (${sizeMB.toFixed(2)} MB) a tu Telegram...`);

  const captionTexto = `🎬 ¡Reel listo para publicar!\n📌 Tema: ${tema}\n🎭 Formato: ${formatoActivo.toUpperCase()}`;

  try {
    const resultado = spawnSync(
      "curl",
      [
        "-s",
        "-X",
        "POST",
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
        "-F",
        `chat_id=${TELEGRAM_CHAT_ID}`,
        "-F",
        `video=@${archivoAEnviar}`,
        "-F",
        "supports_streaming=true",
        "--form-string",
        `caption=${captionTexto}`,
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );

    if (resultado.error) {
      throw resultado.error;
    }

    const salida = (resultado.stdout || "").trim();
    const json = JSON.parse(salida);
    if (json.ok) {
      console.log("✅ ¡Video enviado exitosamente a tu celular por Telegram!");
    } else {
      console.error("❌ Telegram rechazó el envío:", json.description || salida);
    }
  } catch (err) {
    console.error("❌ Error al enviar a Telegram:", err.message);
  }
}

// ==========================================
// 5. FLUJO PRINCIPAL
// ==========================================
async function main() {
  const formatoActivo = resolverFormato(TEMA, FORMATO_INPUT);

  console.log(`\n🚀 INICIANDO FÁBRICA AUTOMÁTICA DE REELS`);
  console.log(`📌 Tema: "${TEMA}"`);
  console.log(`🎭 Formato activo: ${formatoActivo.toUpperCase()}`);
  console.log(`🎙️ Motor de voz seleccionado: ${MOTOR_VOZ.toUpperCase()}\n`);

  const listaEscenas = await generarGuionAutomatico(TEMA, formatoActivo);
  const processedScenes = [];

  for (let i = 0; i < listaEscenas.length; i++) {
    const scene = listaEscenas[i];
    const nombreImagen = `ia_escena_${i + 1}.jpg`;
    const tonoEscena = scene.tone || (i === 0 ? "intriga" : i === listaEscenas.length - 1 ? "reflexion" : "serio");
    const rolEscena = scene.role && VOCES_DOCUMENTAL[scene.role] ? scene.role : "narrador";

    console.log(
      `[${i + 1}/${listaEscenas.length}] Escena: "${scene.tag}" | Rol: ${rolEscena} | Tono: ${tonoEscena}`
    );

    const audioPath = `public/audio_scene_${i + 1}.mp3`;
    const imagePath = `public/${nombreImagen}`;

    await generarImagenIA(scene.imagePrompt, imagePath, i + 1, formatoActivo);

    let vozGenerada = false;
    if (MOTOR_VOZ === "fish_drama3") {
      vozGenerada = await generarVozFishDrama3(scene.text, tonoEscena, rolEscena, formatoActivo, audioPath);
    }
    if (!vozGenerada) {
      await generarVozAzure(scene.text, tonoEscena, rolEscena, formatoActivo, audioPath);
    }

    const durationSec = getMP3Duration(fs.readFileSync(audioPath)) / 1000;
    const esUltimaEscena = i === listaEscenas.length - 1;
    const totalFrames = Math.ceil(durationSec * 30) + (esUltimaEscena ? 2 : 8);

    processedScenes.push({
      id: String(i + 1),
      tag: scene.tag || `ESCENA ${i + 1}`,
      format: formatoActivo,
      role: rolEscena,
      tone: tonoEscena,
      image: nombreImagen,
      audioFile: `audio_scene_${i + 1}.mp3`,
      durationInFrames: totalFrames,
    });
  }

  fs.writeFileSync("./guion_sincronizado.json", JSON.stringify({ scenes: processedScenes }, null, 2));

  const outputVideo = "out/reel_azure_premium.mp4";
  console.log("\n🎬 Renderizando con Remotion en modo Turbo Multi-Núcleo (100%, CRF 23)...");
  execSync(`npx remotion render LongReel ${outputVideo} --concurrency=100% --crf=23`, { stdio: "inherit" });
  console.log("\n🎉 ¡Reel completado con éxito!");

  await enviarVideoTelegram(outputVideo, TEMA, formatoActivo);
}

main().catch((err) => {
  console.error("❌ Fallo en la ejecución:", err);
  process.exit(1);
});