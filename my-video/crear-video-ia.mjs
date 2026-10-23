import fs from "fs";
import { execSync } from "child_process";
import getMP3Duration from "get-mp3-duration";
import "dotenv/config";

const TEMA = process.env.TEMA_VIDEO || "El misterio del Pozo Superprofundo de Kola";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;

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

// Función auxiliar para extraer el arreglo de escenas sin importar cómo lo devuelva la IA
function extraerEscenas(respuesta) {
  // Caso 1: La API ya devolvió el arreglo parseado
  if (Array.isArray(respuesta)) {
    return respuesta;
  }
  // Caso 2: La API devolvió un objeto que contiene el arreglo (ej. { scenes: [...] })
  if (respuesta && typeof respuesta === "object") {
    const posibleArray = Object.values(respuesta).find((v) => Array.isArray(v));
    if (posibleArray) return posibleArray;
  }
  // Caso 3: La API devolvió un string (con o sin bloques ```json)
  if (typeof respuesta === "string") {
    const limpio = respuesta.replace(/```json|```/gi, "").trim();
    const jsonMatch = limpio.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    const parsed = JSON.parse(limpio);
    if (Array.isArray(parsed)) return parsed;
  }
  return null;
}

// ==========================================
// 1. GENERADOR AUTOMÁTICO DE GUION CON IA
// ==========================================
async function generarGuionAutomatico(tema) {
  console.log(`🧠 Escribiendo guion viral de 12 escenas sobre: "${tema}"...`);

  const promptSistema = `Actúa como guionista experto en Reels virales de misterio, ciencia e historia de alta retención.
Escribe un guion de exactamente 12 escenas sobre el tema: "${tema}".

Devuelve ÚNICAMENTE un arreglo JSON válido (sin texto adicional ni bloques markdown) con esta estructura exacta:
[
  {
    "id": "1",
    "tag": "GANCHO",
    "text": "Narración en español neutro de 20 a 28 palabras. Escribe todos los números con letras (ej: mil novecientos setenta).",
    "imagePrompt": "Detailed English prompt for FLUX.1, hyperrealistic, cinematic lighting, 35mm film, dramatic atmosphere, ultra detailed, 8k, vertical 9:16",
    "imageFile": "ia_escena_1.jpg"
  }
]
Reglas:
- Exactamente 12 escenas numeradas del 1 al 12 ("ia_escena_1.jpg" a "ia_escena_12.jpg").
- Escena 1 debe ser una pregunta o gancho intrigante.
- Escena 12 debe cerrar con una reflexión e invitar a seguir la cuenta.`;

  // Intento 1: Google Gemini (probando modelos actuales en orden)
  if (GEMINI_API_KEY) {
    const modelosGemini = [
      "gemini-3.0-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
    ];

    for (const modelo of modelosGemini) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY.trim()}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptSistema }] }],
            generationConfig: { responseMimeType: "application/json" },
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
          console.warn(`⚠️ Aviso de Gemini API (${modelo}): ${ data.error?.message || JSON.stringify(data) }`);
        }
      } catch (e) {
        console.warn(`⚠️ Error en Gemini (${modelo}): ${e.message}`);
      }
    }
  }

  // Intento 2: Respaldo con rotación de cuentas de Cloudflare
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
      } else {
        console.warn(`⚠️ Respuesta de ${cuenta.nombre}:`, JSON.stringify(data.errors || data));
      }

      console.warn(`⚠️ ${cuenta.nombre} sin recursos para texto. Cambiando de cuenta...`);
    } catch (err) {
      console.warn(`⚠️ Error en ${cuenta.nombre}: ${err.message}. Cambiando de cuenta...`);
    }
  }

  throw new Error("❌ No se pudo generar el guion: todas las fuentes y cuentas fallaron.");
}

// ==========================================
// 2. GENERADOR DE IMÁGENES (ROTACIÓN CF)
// ==========================================
async function generarImagenCloudflare(prompt, outputPath) {
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
          body: JSON.stringify({ prompt: prompt, steps: 4 }),
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
// 3. LOCUCIÓN CON AZURE SPEECH
// ==========================================
async function generarVozAzure(texto, outputPath) {
  const url = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version='1.0' xml:lang='es-MX'><voice xml:lang='es-MX' name='es-MX-JorgeNeural'>${texto}</voice></speak>`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "RemotionReels",
    },
    body: ssml,
  });

  if (!response.ok) throw new Error(`Error de Azure TTS: ${response.statusText}`);
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
    console.log(`[${i + 1}/${listaEscenas.length}] Procesando escena: "${scene.tag}"...`);

    const audioPath = `public/audio_scene_${i + 1}.mp3`;
    const imagePath = `public/${nombreImagen}`;

    await generarImagenCloudflare(scene.imagePrompt, imagePath);
    await generarVozAzure(scene.text, audioPath);

    const durationSec = getMP3Duration(fs.readFileSync(audioPath)) / 1000;
    const totalFrames = Math.ceil(durationSec * 30) + 8;

    processedScenes.push({
      id: String(i + 1),
      tag: scene.tag || `ESCENA ${i + 1}`,
      image: nombreImagen,
      audioFile: `audio_scene_${i + 1}.mp3`,
      durationInFrames: totalFrames,
    });
  }

  fs.writeFileSync("./guion_sincronizado.json", JSON.stringify({ scenes: processedScenes }, null, 2));

  console.log("\n🎬 Renderizando con Remotion en GitHub Actions...");
  execSync(`npx remotion render LongReel out/reel_azure_premium.mp4 --concurrency=1`, { stdio: "inherit" });
  console.log("\n🎉 ¡Reel completado con éxito!");
}

main().catch((err) => {
  console.error("❌ Fallo en la ejecución:", err);
  process.exit(1);
});