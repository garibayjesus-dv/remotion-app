import fs from "fs";
import { execSync } from "child_process";
import getMP3Duration from "get-mp3-duration";
import "dotenv/config";

const TEMA = process.env.TEMA_VIDEO || "El misterio del Pozo Superprofundo de Kola";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AZURE_FOUNDRY_KEY = process.env.AZURE_FOUNDRY_KEY;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;

// Elenco de voces estilo Documental de Netflix
const VOCES_DOCUMENTAL = {
  narrador: { nombre: "es-MX-JorgeNeural", lang: "es-MX", etiqueta: "🎙️ Narrador" },
  testigo:  { nombre: "es-ES-AlvaroNeural", lang: "es-ES", etiqueta: "📜 Voz de Testigo/Diario" },
  archivo:  { nombre: "es-MX-DaliaNeural", lang: "es-MX", etiqueta: "📁 Voz de Expediente/Forense" },
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

if (!AZURE_KEY || !AZURE_REGION) {
  console.error("❌ Faltan credenciales de Azure Speech en las variables de entorno.");
  process.exit(1);
}

let indiceCuentaActual = 0;
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
// 1. GENERADOR DE GUION MULTI-VOZ (GEMINI 3.8 + RESPALDOS)
// ==========================================
async function generarGuionAutomatico(tema) {
  console.log(`🧠 Escribiendo guion documental multi-voz de 12 escenas sobre: "${tema}"...`);

  const promptSistema = `Actúa como director de documentales de Netflix y guionista experto en Reels virales de misterio, ciencia e historia de altísima retención.
Escribe un guion de exactamente 12 escenas sobre el tema: "${tema}".

Devuelve ÚNICAMENTE un arreglo JSON válido (sin texto adicional ni bloques markdown) con esta estructura exacta:
[
  {
    "id": "1",
    "tag": "GANCHO",
    "role": "narrador",
    "tone": "intriga",
    "text": "Narración en español neutro de 20 a 26 palabras. Usa signos de interrogación, exclamación y puntos suspensivos (...) para crear suspenso y pausas dramáticas. Escribe todos los números con letras.",
    "imagePrompt": "Vertical 9:16 cinematic shot, main subject in center, hyperrealistic, moody volumetric lighting, 35mm film, dark atmosphere, 8k, no text",
    "imageFile": "ia_escena_1.jpg"
  }
]
Reglas obligatorias de Dirección Documental Multi-Voz:
- Exactamente 12 escenas numeradas del 1 al 12 ("ia_escena_1.jpg" a "ia_escena_12.jpg").
- El campo "role" define qué voz hablará en esa escena y DEBE usar uno de estos 3 valores:
  1. "narrador": El locutor principal (úsalo en 9 de las 12 escenas, incluyendo siempre la escena 1 y la 12).
  2. "testigo": Voz dramática en primera persona que lee un fragmento de diario antiguo, bitácora, carta, grabación o testimonio real del caso (úsalo en 2 escenas clave, por ejemplo escena 4 y escena 9). La escena anterior del "narrador" debe dar pie a esa cita.
  3. "archivo": Voz clínica/investigadora que revela el dato forense, científico o informe oficial más perturbador (úsalo en 1 escena clave, por ejemplo escena 7 u 8).
- El campo "tone" debe ser uno de estos 4 valores según la emoción: "intriga", "serio", "impacto", "reflexion".
- En "imagePrompt": Escribe un prompt en inglés para FLUX.2-pro con UN sujeto u objeto centrado. REGLA DE SEGURIDAD AZURE: NUNCA uses palabras gráficas, violencia, cadáveres ni sangre (prohibido: blood, corpse, dead, cannibalism, bones, skull, gore, kill, weapon, torture). Si la escena trata algo trágico, describe una metáfora visual atmosférica y segura.
- Escena 1 ("role": "narrador", "tone": "intriga") debe ser un gancho impactante.
- Escena 12 ("role": "narrador", "tone": "reflexion") debe cerrar con una reflexión profunda.`;

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
            console.log(`✅ Guion Multi-Voz generado con Google Gemini (${modelo} - ${escenas.length} escenas).`);
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
          max_tokens: 3500,
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
// 2. GENERADOR DE IMÁGENES PRINCIPAL: AZURE FLUX.2-PRO VERTICAL (768x1344)
// ==========================================
async function generarImagenIA(prompt, outputPath, numeroEscena) {
  const promptFinal = `${prompt}, masterpiece, photorealistic, vertical 9:16 composition, dramatic volumetric lighting, 35mm film grain, sharp focus, 8k, no text, no watermark, natural anatomy`;

  if (AZURE_FOUNDRY_KEY) {
    for (let intento = 1; intento <= 3; intento++) {
      const promptSeguro =
        intento === 1
          ? promptFinal
          : `Atmospheric cinematic vertical 9:16 shot inspired by ${TEMA}, mysterious abandoned scene, moody volumetric lighting, 35mm film grain, dark dramatic atmosphere, 8k, photorealistic, no text`;
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
          console.log(`   🖼️ Imagen vertical 9:16 generada con Azure FLUX.2-pro`);
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
      if (data.success && data.result?.image) {
        fs.writeFileSync(outputPath, Buffer.from(data.result.image, "base64"));
        console.log(`   🖼️ Imagen generada con respaldo ${cuenta.nombre}`);
        return;
      }
      indiceCuentaActual++;
    } catch (err) {
      indiceCuentaActual++;
    }
  }

  throw new Error(`❌ No se pudo generar la imagen de la escena ${numeroEscena}.`);
}

// ==========================================
// 3. LOCUCIÓN MULTI-VOZ CALIDAD ESTUDIO HD + EXPRESIONES (SSML)
// ==========================================
function escaparXml(texto) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function generarVozAzure(texto, tono = "serio", rol = "narrador", outputPath) {
  const url = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const infoVoz = VOCES_DOCUMENTAL[rol] || VOCES_DOCUMENTAL.narrador;

  const configuracionTono = {
    intriga:   { style: "whispering", styledegree: "0.65", rate: "+4%", pitch: "-4%" },
    serio:     { style: "narration-professional", styledegree: "1.35", rate: "+2%", pitch: "-5%" },
    impacto:   { style: "excited", styledegree: "1.25", rate: "+6%", pitch: "-2%" },
    reflexion: { style: "empathetic", styledegree: "1.25", rate: "-2%", pitch: "-6%" },
  };

  const cfg = configuracionTono[tono] || configuracionTono.serio;

  // Si es voz de "testigo" (AlvaroNeural), le damos una cadencia solemne y profunda de diario antiguo
  const rateFinal = rol === "testigo" ? "-3%" : rol === "archivo" ? "+3%" : cfg.rate;
  const pitchFinal = rol === "testigo" ? "-7%" : rol === "archivo" ? "-2%" : cfg.pitch;

  const textoConPausas = escaparXml(texto)
    .replace(/\.\.\./g, '<break time="450ms"/>')
    .replace(/\. /g, '. <break time="300ms"/>')
    .replace(/\? /g, '? <break time="350ms"/>')
    .replace(/! /g, '! <break time="350ms"/>');

  const cuerpoVoz =
    rol === "narrador"
      ? `<mstts:express-as style="${cfg.style}" styledegree="${cfg.styledegree}">
          <prosody rate="${rateFinal}" pitch="${pitchFinal}">
            ${textoConPausas}
          </prosody>
        </mstts:express-as>`
      : `<prosody rate="${rateFinal}" pitch="${pitchFinal}">
          <break time="200ms"/>${textoConPausas}
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
}

// ==========================================
// 4. FLUJO PRINCIPAL
// ==========================================
async function main() {
  console.log(`\n🚀 INICIANDO FÁBRICA AUTOMÁTICA DE REELS (MODO DOCUMENTAL MULTI-VOZ)`);
  console.log(`📌 Tema seleccionado: "${TEMA}"\n`);

  const listaEscenas = await generarGuionAutomatico(TEMA);
  const processedScenes = [];

  for (let i = 0; i < listaEscenas.length; i++) {
    const scene = listaEscenas[i];
    const nombreImagen = `ia_escena_${i + 1}.jpg`;
    const tonoEscena = scene.tone || (i === 0 ? "intriga" : i === listaEscenas.length - 1 ? "reflexion" : "serio");
    const rolEscena = scene.role && VOCES_DOCUMENTAL[scene.role] ? scene.role : "narrador";

    console.log(
      `[${i + 1}/${listaEscenas.length}] Escena: "${scene.tag}" | ${VOCES_DOCUMENTAL[rolEscena].etiqueta} | Tono: ${tonoEscena}`
    );

    const audioPath = `public/audio_scene_${i + 1}.mp3`;
    const imagePath = `public/${nombreImagen}`;

    await generarImagenIA(scene.imagePrompt, imagePath, i + 1);
    await generarVozAzure(scene.text, tonoEscena, rolEscena, audioPath);

    const durationSec = getMP3Duration(fs.readFileSync(audioPath)) / 1000;
    const totalFrames = Math.ceil(durationSec * 30) + 8;

    processedScenes.push({
      id: String(i + 1),
      tag: scene.tag || `ESCENA ${i + 1}`,
      role: rolEscena,
      tone: tonoEscena,
      image: nombreImagen,
      audioFile: `audio_scene_${i + 1}.mp3`,
      durationInFrames: totalFrames,
    });
  }

  fs.writeFileSync("./guion_sincronizado.json", JSON.stringify({ scenes: processedScenes }, null, 2));

  console.log("\n🎬 Renderizando con Remotion en modo Turbo Multi-Núcleo (100%)...");
  execSync(`npx remotion render LongReel out/reel_azure_premium.mp4 --concurrency=100% --crf=23`, { stdio: "inherit" });
  console.log("\n🎉 ¡Reel completado con éxito!");
}

main().catch((err) => {
  console.error("❌ Fallo en la ejecución:", err);
  process.exit(1);
});