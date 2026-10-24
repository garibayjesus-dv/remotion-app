import fs from "fs";
import { execSync } from "child_process";
import getMP3Duration from "get-mp3-duration";
import "dotenv/config";

const TEMA = process.env.TEMA_VIDEO || "El misterio del Pozo Superprofundo de Kola";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;

// Voz de locutor profesional (puedes cambiar a "es-ES-AlvaroNeural" o "es-MX-GerardoNeural" si quieres probar otro timbre)
const VOZ_LOCUTOR = process.env.AZURE_VOICE || "es-MX-JorgeNeural";

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

if (CUENTAS_CF.length === 0 || !AZURE_KEY || !AZURE_REGION) {
  console.error("❌ Faltan credenciales de Cloudflare o de Azure en las variables de entorno.");
  process.exit(1);
}

let indiceCuentaActual = 0;

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
// 1. GENERADOR DE GUION (GEMINI 3.8 + GITHUB MODELS GPT-4O + CF)
// ==========================================
async function generarGuionAutomatico(tema) {
  console.log(`🧠 Escribiendo guion viral de 12 escenas sobre: "${tema}"...`);

  const promptSistema = `Actúa como director y guionista experto en documentales cortos y Reels virales de misterio, ciencia e historia de altísima retención.
Escribe un guion de exactamente 12 escenas sobre el tema: "${tema}".

Devuelve ÚNICAMENTE un arreglo JSON válido (sin texto adicional ni bloques markdown) con esta estructura exacta:
[
  {
    "id": "1",
    "tag": "GANCHO",
    "tone": "intriga",
    "text": "Narración en español neutro de 20 a 26 palabras. Usa signos de interrogación, exclamación y puntos suspensivos (...) para crear suspenso y pausas dramáticas. Escribe todos los números con letras.",
    "imagePrompt": "Centered vertical 9:16 composition, main subject strictly in the center of the frame, medium-wide cinematic shot for FLUX.1, hyperrealistic, moody volumetric lighting, 35mm film grain, dark atmospheric color grading, 8k, no text, no letters, no watermarks",
    "imageFile": "ia_escena_1.jpg"
  }
]
Reglas obligatorias:
- Exactamente 12 escenas numeradas del 1 al 12 ("ia_escena_1.jpg" a "ia_escena_12.jpg").
- El campo "tone" debe ser uno de estos 4 valores según la emoción de la escena: "intriga", "serio", "impacto", "reflexion".
- En "imagePrompt": Describe escenas visuales claras con UN sujeto u objeto principal centrado en la imagen. NUNCA pidas texto, carteles, mapas con letras ni manos en primer plano.
- Escena 1 ("tone": "intriga") debe ser un gancho impactante en los primeros 3 segundos.
- Escena 12 ("tone": "reflexion") debe cerrar con una reflexión profunda o pregunta inquietante.`;

  // --------------------------------------------------
  // INTENTO 1: Google Gemini (gemini-3.8-flash prioritario)
  // --------------------------------------------------
  if (GEMINI_API_KEY) {
    const modelosGemini = [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
    ];

    for (const modelo of modelosGemini) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY.trim()}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptSistema }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          }),
        });

        const data = await res.json();
        if (res.ok) {
          const textoJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          const escenas = extraerEscenas(textoJson);
          if (escenas && escenas.length > 0) {
            console.log(`✅ Guion generado con éxito con Google Gemini (${modelo} - ${escenas.length} escenas).`);
            return escenas;
          }
        } else {
          console.warn(`⚠️ Aviso de Gemini API (${modelo}): ${data.error?.message || JSON.stringify(data)}`);
        }
      } catch (e) {
        console.warn(`⚠️ Error al conectar con Gemini (${modelo}): ${e.message}`);
      }
    }
  } else {
    console.warn("⚠️ GEMINI_API_KEY no detectada. Pasando al siguiente motor de IA...");
  }

  // --------------------------------------------------
  // INTENTO 2: GitHub Models (OpenAI GPT-4o gratis en GitHub Actions)
  // --------------------------------------------------
  if (GITHUB_TOKEN) {
    try {
      console.log("🤖 Intentando generar guion con GitHub Models (OpenAI GPT-4o)...");
      const ghRes = await fetch("https://models.github.ai/inference/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages: [
            { role: "system", content: "Devuelve únicamente un arreglo JSON válido de 12 escenas sin bloques markdown." },
            { role: "user", content: promptSistema },
          ],
          temperature: 0.7,
          max_tokens: 3800,
        }),
      });

      const ghData = await ghRes.json();
      if (ghRes.ok) {
        const contenido = ghData?.choices?.[0]?.message?.content;
        const escenas = extraerEscenas(contenido);
        if (escenas && escenas.length > 0) {
          console.log(`✅ Guion generado con éxito con GitHub Models GPT-4o (${escenas.length} escenas).`);
          return escenas;
        }
      } else {
        console.warn(`⚠️ Aviso de GitHub Models: ${ghData.error?.message || JSON.stringify(ghData)}`);
      }
    } catch (e) {
      console.warn(`⚠️ GitHub Models no disponible (${e.message}), usando respaldo de Cloudflare...`);
    }
  }

  // --------------------------------------------------
  // INTENTO 3: Respaldo con Cloudflare Workers AI
  // --------------------------------------------------
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
          max_tokens: 3500,
        }),
      });

      const data = await response.json();

      if (data.success && data.result?.response) {
        const escenas = extraerEscenas(data.result.response);
        if (escenas && escenas.length > 0) {
          console.log(`✅ Guion generado con éxito usando ${cuenta.nombre} (${escenas.length} escenas).`);
          return escenas;
        }
      }
      console.warn(`⚠️ ${cuenta.nombre} no devolvió guion válido. Cambiando de cuenta...`);
    } catch (err) {
      console.warn(`⚠️ Error en ${cuenta.nombre}: ${err.message}. Cambiando de cuenta...`);
    }
  }

  throw new Error("❌ No se pudo generar el guion: todas las fuentes y cuentas fallaron.");
}

// ==========================================
// 2. GENERADOR DE IMÁGENES ENCUADRE CENTRADO (FLUX 8 STEPS)
// ==========================================
async function generarImagenCloudflare(prompt, outputPath) {
  const promptMejorado = `centered vertical composition, main subject in the exact center of the frame, ${prompt}, masterpiece, photorealistic, cinematic lighting, dramatic shadows, sharp focus, 8k, no text, no letters, no watermark, natural anatomy`;

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
          body: JSON.stringify({
            prompt: promptMejorado,
            steps: 8,
          }),
        }
      );

      const data = await response.json();

      if (data.success && data.result?.image) {
        fs.writeFileSync(outputPath, Buffer.from(data.result.image, "base64"));
        return;
      }

      console.warn(`⚠️ ${cuenta.nombre} agotada para imágenes. Cambiando a la siguiente cuenta...`);
      indiceCuentaActual++;
    } catch (err) {
      console.warn(`⚠️ Error en ${cuenta.nombre}: ${err.message}. Cambiando a la siguiente cuenta...`);
      indiceCuentaActual++;
    }
  }

  throw new Error("❌ Todas las cuentas de Cloudflare agotaron sus neuronas diarias.");
}

// ==========================================
// 3. LOCUCIÓN CALIDAD ESTUDIO HD + EXPRESIONES (SSML)
// ==========================================
function escaparXml(texto) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function generarVozAzure(texto, tono = "serio", outputPath) {
  const url = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const configuracionTono = {
    intriga:   { style: "whispering", styledegree: "0.65", rate: "+4%", pitch: "-4%" },
    serio:     { style: "narration-professional", styledegree: "1.35", rate: "+2%", pitch: "-5%" },
    impacto:   { style: "excited", styledegree: "1.25", rate: "+6%", pitch: "-2%" },
    reflexion: { style: "empathetic", styledegree: "1.25", rate: "-2%", pitch: "-6%" },
  };

  const cfg = configuracionTono[tono] || configuracionTono.serio;

  const textoConPausas = escaparXml(texto)
    .replace(/\.\.\./g, '<break time="450ms"/>')
    .replace(/\. /g, '. <break time="300ms"/>')
    .replace(/\? /g, '? <break time="350ms"/>')
    .replace(/! /g, '! <break time="350ms"/>');

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-MX">
    <voice name="${VOZ_LOCUTOR}">
      <mstts:express-as style="${cfg.style}" styledegree="${cfg.styledegree}">
        <prosody rate="${cfg.rate}" pitch="${cfg.pitch}">
          ${textoConPausas}
        </prosody>
      </mstts:express-as>
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
}

// ==========================================
// 4. FLUJO PRINCIPAL
// ==========================================
async function main() {
  console.log(`\n🚀 INICIANDO FÁBRICA AUTOMÁTICA DE REELS`);
  console.log(`📌 Tema seleccionado: "${TEMA}"\n`);

  const listaEscenas = await generarGuionAutomatico(TEMA);
  const processedScenes = [];

  for (let i = 0; i < listaEscenas.length; i++) {
    const scene = listaEscenas[i];
    const nombreImagen = `ia_escena_${i + 1}.jpg`;
    const tonoEscena = scene.tone || (i === 0 ? "intriga" : i === listaEscenas.length - 1 ? "reflexion" : "serio");

    console.log(`[${i + 1}/${listaEscenas.length}] Procesando escena: "${scene.tag}" (Tono: ${tonoEscena})...`);

    const audioPath = `public/audio_scene_${i + 1}.mp3`;
    const imagePath = `public/${nombreImagen}`;

    await generarImagenCloudflare(scene.imagePrompt, imagePath);
    await generarVozAzure(scene.text, tonoEscena, audioPath);

    const durationSec = getMP3Duration(fs.readFileSync(audioPath)) / 1000;
    const totalFrames = Math.ceil(durationSec * 30) + 8;

    processedScenes.push({
      id: String(i + 1),
      tag: scene.tag || `ESCENA ${i + 1}`,
      tone: tonoEscena,
      image: nombreImagen,
      audioFile: `audio_scene_${i + 1}.mp3`,
      durationInFrames: totalFrames,
    });
  }

  fs.writeFileSync("./guion_sincronizado.json", JSON.stringify({ scenes: processedScenes }, null, 2));

  console.log("\n🎬 Renderizando con Remotion en modo Turbo Multi-Núcleo...");
  execSync(`npx remotion render LongReel out/reel_azure_premium.mp4 --concurrency=3`, { stdio: "inherit" });
  console.log("\n🎉 ¡Reel completado con éxito!");
}

main().catch((err) => {
  console.error("❌ Fallo en la ejecución:", err);
  process.exit(1);
});