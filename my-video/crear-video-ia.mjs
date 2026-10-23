import fs from "fs";
import { execSync } from "child_process";
import getMP3Duration from "get-mp3-duration";
import "dotenv/config";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("❌ Faltan CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_API_TOKEN en el archivo .env");
  process.exit(1);
}

// ========================================================
// GUION DINÁMICO: 10 ESCENAS (~65 SEGUNDOS DE DURACIÓN)
// ========================================================
const guion = {
  title: "El lugar más silencioso de la Tierra",
  scenes: [
    {
      id: "escena_1",
      tag: "EL LUGAR PROHIBIDO",
      text: "Existe una habitación en la Tierra tan silenciosa que nadie ha logrado soportar más de 45 minutos dentro sin perder la calma.",
      imagePrompt: "dark futuristic anechoic chamber lined with sound absorbing geometric fiberglass wedges, lone person standing in center, eerie dramatic cinematic lighting, photorealistic 8k, vertical 9:16",
      imageFile: "ia_escena_1.jpg",
    },
    {
      id: "escena_2",
      tag: "SILENCIO ABSOLUTO",
      text: "Se encuentra en Minnesota y fue diseñada para absorber el 99.99 por ciento de cualquier sonido que exista.",
      imagePrompt: "exterior and interior perspective of advanced acoustic research science laboratory, thick steel soundproof vault doors, sterile mysterious atmosphere, vertical 9:16",
      imageFile: "ia_escena_2.jpg",
    },
    {
      id: "escena_3",
      tag: "LA ADAPTACIÓN",
      text: "Al entrar y cerrarse la compuerta, tus oídos se adaptan a la nada en segundos. Y es ahí cuando comienza la pesadilla.",
      imagePrompt: "cinematic close-up of human face in absolute dark, dilated pupils, expression of intense psychological unease and disorientation, vertical 9:16",
      imageFile: "ia_escena_3.jpg",
    },
    {
      id: "escena_4",
      tag: "TU PROPIO CUERPO",
      text: "Sin ruido exterior que lo tape, empiezas a escuchar los latidos de tu propio corazón como si fueran golpes de tambor retumbando.",
      imagePrompt: "anatomical glowing artistic illustration of human heart beating inside chest cavity, luminous blood vessels, dark background, cinematic 8k, vertical 9:16",
      imageFile: "ia_escena_4.jpg",
    },
    {
      id: "escena_5",
      tag: "SONIDOS INTERNOS",
      text: "Luego escuchas el aire rozando tus pulmones, la saliva bajando por tu garganta e incluso la sangre fluyendo en tus oídos.",
      imagePrompt: "close-up macro of human ear and temple with subtle futuristic glowing soundwaves penetrating skin, hyperrealistic, dramatic side lighting, vertical 9:16",
      imageFile: "ia_escena_5.jpg",
    },
    {
      id: "escena_6",
      tag: "PÉRDIDA DE EQUILIBRIO",
      text: "Pero lo peor no es el sonido, sino la pérdida de orientación. Sin rebote sonoro en las paredes, tu cerebro pierde el equilibrio por completo.",
      imagePrompt: "person stumbling in a surreal disorienting room, tilted perspective, vertigo illusion, cinematic shadows, photorealistic vertical 9:16",
      imageFile: "ia_escena_6.jpg",
    },
    {
      id: "escena_7",
      tag: "ALUCINACIONES",
      text: "A partir de la media hora, el cerebro, desesperado por encontrar un estímulo acústico, empieza a fabricar alucinaciones sonoras.",
      imagePrompt: "surreal psychological illustration of human mind melting into eerie acoustic soundwaves, shadows whispering in darkness, dark fantasy art, vertical 9:16",
      imageFile: "ia_escena_7.jpg",
    },
    {
      id: "escena_8",
      tag: "ENTRENAMIENTO NASA",
      text: "La NASA utiliza esta misma cámara para entrenar a sus astronautas y prepararlos para el silencio absoluto del espacio profundo.",
      imagePrompt: "astronaut in detailed spacesuit floating inside pitch-black infinite deep cosmic void, distant stars and earth glow, photorealistic, cinematic vertical 9:16",
      imageFile: "ia_escena_8.jpg",
    },
    {
      id: "escena_9",
      tag: "EL LÍMITE HUMANO",
      text: "El récord de permanencia a oscuras es de tan solo 45 minutos. Quien lo intentó aseguró sentir que su mente se rompía por dentro.",
      imagePrompt: "heavy vault door opening slightly revealing warm light from outside, distressed person sitting on a chair inside dark anechoic room, cinematic vertical 9:16",
      imageFile: "ia_escena_9.jpg",
    },
    {
      id: "escena_10",
      tag: "¿LO SOPORTARÍAS?",
      text: "¿Y tú? ¿Cuántos minutos crees que serías capaz de aguantar a solas con tus propios pensamientos en silencio absoluto?",
      imagePrompt: "silhouette of a lone person standing in an infinite dark geometric acoustic chamber, single beam of light falling from above, mysterious mood, vertical 9:16",
      imageFile: "ia_escena_10.jpg",
    },
  ],
};

const voice = "es-MX-JorgeNeural";

// ========================================================
// GENERADOR CON CLOUDFLARE FLUX.1 [SCHNELL]
// ========================================================
async function generarImagenCloudflare(prompt, outputPath) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        steps: 4,
      }),
    }
  );

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Error en Cloudflare: ${JSON.stringify(data.errors)}`);
  }

  fs.writeFileSync(outputPath, Buffer.from(data.result.image, "base64"));
}

async function main() {
  console.log("\n🚀 INICIANDO PRODUCCIÓN DE REEL DINÁMICO (+60 SEG)\n");

  // 1. GENERACIÓN DE LAS 10 IMÁGENES CON IA
  console.log("🎨 Generando 10 imágenes con Cloudflare Workers AI...");
  for (let i = 0; i < guion.scenes.length; i++) {
    const scene = guion.scenes[i];
    const targetPath = `public/${scene.imageFile}`;

    console.log(`🖼️ [${i + 1}/${guion.scenes.length}] Creando toma: "${scene.tag}"...`);
    await generarImagenCloudflare(scene.imagePrompt, targetPath);
  }
  console.log("✅ 10 tomas fotorrealistas guardadas en public/\n");

  // 2. LOCUCIÓN NEURONAL Y MEDICIÓN EXACTA FRAME POR FRAME
  console.log("🎙️ Generando voz de IA y sincronizando duración exacta...");
  const processedScenes = [];

  for (let i = 0; i < guion.scenes.length; i++) {
    const scene = guion.scenes[i];
    const audioFileName = `audio_scene_${i + 1}.mp3`;
    const audioPath = `public/${audioFileName}`;

    const ttsCommand = `edge-tts --voice ${voice} --text "${scene.text.replace(/"/g, '\\"')}" --write-media ${audioPath}`;
    execSync(ttsCommand, { stdio: "pipe" });

    const buffer = fs.readFileSync(audioPath);
    const durationMs = getMP3Duration(buffer);
    const durationSec = durationMs / 1000;

    // Duración de la voz + 10 frames (~0.33s) para un cambio ágil de escena
    const audioFrames = Math.ceil(durationSec * 30);
    const totalSceneFrames = audioFrames + 10;

    processedScenes.push({
      id: scene.id,
      tag: scene.tag,
      image: scene.imageFile,
      audioFile: audioFileName,
      durationInFrames: totalSceneFrames,
    });

    console.log(`   ⏱️ Toma ${i + 1}: ${durationSec.toFixed(2)}s (${totalSceneFrames} frames)`);
  }

  // Guardar archivo sincronizado
  fs.writeFileSync(
    "./guion_sincronizado.json",
    JSON.stringify({ scenes: processedScenes }, null, 2)
  );

  const totalSeconds = (processedScenes.reduce((acc, s) => acc + s.durationInFrames, 0) / 30).toFixed(1);
  console.log(`\n📐 Duración total del Reel: ${totalSeconds} segundos.`);

  // 3. RENDERIZADO CON CONCURRENCY=1 (PROTECCIÓN DE CPU CODESPACES)
  console.log("🎬 Compilando video final limpio en Remotion...");
  const outputFile = "out/reel_silencio_absoluto.mp4";

  execSync(`npx remotion render LongReel ${outputFile} --concurrency=1`, {
    stdio: "inherit",
  });

  console.log(`\n🎉 ¡Reel de alta retención generado! Archivo: ${outputFile}`);
}

main().catch((err) => console.error("❌ Fallo durante la ejecución:", err));