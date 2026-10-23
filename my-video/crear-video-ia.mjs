import fs from "fs";
import { execSync } from "child_process";
import getMP3Duration from "get-mp3-duration";
import "dotenv/config";

const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;

if (!AZURE_KEY || !AZURE_REGION) {
  console.error("❌ Faltan AZURE_SPEECH_KEY o AZURE_SPEECH_REGION en las variables.");
  process.exit(1);
}

const guion = [
  {
    id: "1",
    tag: "ABISMO",
    text: "¿Qué encontraron los científicos al perforar casi doce kilómetros bajo la tierra, en un lugar donde la roca parecía guardar un secreto imposible?",
    imagePrompt: "A Soviet-era drilling rig descending into the Kola Superdeep Borehole, massive industrial machinery surrounded by dark northern wilderness, aerial wide shot from above, cold volumetric light cutting through mist, ominous blue and steel gray palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_1.jpg"
  },
  {
    id: "2",
    tag: "MISTERIO",
    text: "En la península de Kola, un equipo soviético inició una carrera contra la naturaleza para alcanzar el punto más profundo jamás excavado por seres humanos.",
    imagePrompt: "Soviet scientists and engineers studying blueprints beside a towering drilling platform in northern Russia, snow-covered landscape and rugged equipment surrounding them, medium shot at eye level, pale winter sunlight with dramatic rim light, desaturated blue and amber palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_2.jpg"
  },
  {
    id: "3",
    tag: "DESAFÍO",
    text: "El objetivo no era encontrar petróleo ni construir una mina. Querían estudiar la corteza terrestre y descubrir cómo era realmente el planeta por dentro.",
    imagePrompt: "Determined Soviet geologist examining geological samples beside a deep drilling shaft, laboratory containers and metallic instruments visible in a remote research station, close-up three-quarter angle, focused tungsten light mixed with icy window light, earthy brown and cold cyan palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_3.jpg"
  },
  {
    id: "4",
    tag: "PROFUNDIDAD",
    text: "La perforación comenzó en mil novecientos setenta y continuó durante décadas. Cada metro nuevo exigía herramientas más resistentes y una paciencia extraordinaria.",
    imagePrompt: "Long drill pipe rotating deep inside an enormous industrial borehole, engineers monitoring gauges and machinery in a Soviet research facility, low angle shot looking upward through the steel structure, harsh chiaroscuro and glowing warning lamps, graphite black and rusty orange palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_4.jpg"
  },
  {
    id: "5",
    tag: "GIRO",
    text: "Pero cuanto más descendían, más extraño se volvía el subsuelo. La temperatura aumentaba mucho más de lo esperado y deformaba las brocas.",
    imagePrompt: "Glowing drill bit emerging from fractured rock deep underground, molten heat shimmering around the metal and engineers reacting in the background, extreme close-up from a low angle, intense orange volumetric light surrounded by deep shadows, fiery amber and charcoal palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_5.jpg"
  },
  {
    id: "6",
    tag: "SORPRESA",
    text: "Los científicos también descubrieron agua atrapada a gran profundidad, liberada por minerales que la habían conservado durante millones de años.",
    imagePrompt: "Scientists collecting water droplets from fractured deep rock inside a drilling laboratory, mineral crystals glistening around the sample and tools carefully arranged, macro close-up with a slight side angle, luminous blue rim light and subtle chiaroscuro, deep cobalt and silver palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_6.jpg"
  },
  {
    id: "7",
    tag: "HALLAZGO",
    text: "También aparecieron diminutos fósiles de organismos antiguos en rocas que parecían demasiado profundas para conservar señales de vida.",
    imagePrompt: "Ancient microscopic fossil patterns revealed inside a polished deep-earth rock sample, gloved scientist holding the specimen under magnification equipment, dramatic close-up from an oblique angle, focused laboratory light with cool rim illumination, dark emerald and golden mineral palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_7.jpg"
  },
  {
    id: "8",
    tag: "ALARMA",
    text: "El plan original esperaba una corteza dividida en capas simples. La realidad fue distinta: las rocas estaban fracturadas, mezcladas y llenas de sorpresas.",
    imagePrompt: "Cross-section of complex fractured continental crust revealed beneath a drilling operation, layered rocks twisted and interlocked around the borehole, cinematic cutaway wide shot, dramatic volumetric beams piercing underground darkness, ochre, copper and midnight blue palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_8.jpg"
  },
  {
    id: "9",
    tag: "TENSIÓN",
    text: "A más de doce kilómetros, la presión y el calor convirtieron cada avance en una batalla. El pozo podía cerrarse sobre la herramienta en cualquier momento.",
    imagePrompt: "Massive underground drilling assembly bending under extreme pressure inside a narrow borehole, sparks and fractured stone surrounding the machinery, dynamic low angle close-up, pulsing red industrial light with strong rim highlights, oppressive black, crimson and bronze palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_9.jpg"
  },
  {
    id: "10",
    tag: "LÍMITE",
    text: "En mil novecientos ochenta y nueve alcanzaron doce kilómetros y doscientos sesenta y dos metros, una distancia enorme, aunque pequeña comparada con el tamaño de la Tierra.",
    imagePrompt: "Soviet drilling crew standing beside the record-setting Kola borehole platform, enormous machinery fading into a snowy horizon, heroic wide shot from a low angle, golden sunset breaking through storm clouds with dramatic rim light, steel blue and warm copper palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_10.jpg"
  },
  {
    id: "11",
    tag: "CLÍMAX",
    text: "La gran revelación fue que la frontera entre capas no estaba donde los científicos esperaban. El interior terrestre resultó mucho más complejo y vivo.",
    imagePrompt: "Scientists staring into a deep illuminated borehole while a symbolic cross-section of Earth reveals intricate living geological layers beneath them, dramatic low angle composition, powerful volumetric light rising from the abyss, deep blue, molten orange and obsidian palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_11.jpg"
  },
  {
    id: "12",
    tag: "REFLEXIÓN",
    text: "El pozo de Kola demuestra que conocemos mejor otros mundos que nuestro propio subsuelo. Si te sorprendió, guárdalo y sígueme para descubrir más misterios reales.",
    imagePrompt: "Abandoned Kola Superdeep Borehole facility under northern twilight, silent rusted machinery surrounded by snow and vast wilderness, distant cinematic wide shot at eye level, fading blue hour light with subtle golden rim glow, melancholic steel blue and amber palette, hyperrealistic, cinematic, 35mm film, shallow depth of field, ultra detailed, 8k",
    imageFile: "ia_escena_12.jpg"
  }
];

// GENERADOR TURBO ULTRA RÁPIDO CON TOLERANCIA A TIMEOUT
async function generarImagen(prompt, outputPath, reintentos = 3) {
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=720&height=1280&nologo=true&model=turbo&seed=${seed}`;

  for (let intento = 1; intento <= reintentos; intento++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 segundos límite

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      return;
    } catch (err) {
      console.warn(`⚠️ Intento ${intento}/${reintentos} falló (${err.message}). Reintentando...`);
      if (intento === reintentos) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// LOCUCIÓN PROFESIONAL CON AZURE SPEECH
async function generarVozAzure(texto, outputPath) {
  const url = `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = `<speak version='1.0' xml:lang='es-MX'><voice xml:lang='es-MX' name='es-MX-JorgeNeural'>${texto}</voice></speak>`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "RemotionReels"
    },
    body: ssml,
  });

  if (!response.ok) throw new Error(`Error de Azure TTS: ${response.statusText}`);
  fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function main() {
  console.log("\n🚀 INICIANDO PRODUCCIÓN CON MOTOR TURBO VERTICAL Y VOZ AZURE PREMIUM\n");

  const listaEscenas = Array.isArray(guion) ? guion : (guion.scenes || guion.escenas || []);

  if (!listaEscenas || listaEscenas.length === 0) {
    console.error("❌ No se encontraron escenas válidas en el guion.");
    process.exit(1);
  }

  const processedScenes = [];

  for (let i = 0; i < listaEscenas.length; i++) {
    const scene = listaEscenas[i];
    console.log(`[${i + 1}/${listaEscenas.length}] Procesando escena: "${scene.tag}"...`);
    
    const audioPath = `public/audio_scene_${i + 1}.mp3`;
    const imagePath = `public/${scene.imageFile}`;

    await generarImagen(scene.imagePrompt, imagePath);
    await generarVozAzure(scene.text, audioPath);

    const durationSec = getMP3Duration(fs.readFileSync(audioPath)) / 1000;
    const totalFrames = Math.ceil(durationSec * 30) + 8;

    processedScenes.push({ 
      id: String(scene.id || i + 1),
      tag: scene.tag,
      image: scene.imageFile, 
      audioFile: `audio_scene_${i + 1}.mp3`, 
      durationInFrames: totalFrames 
    });
  }

  fs.writeFileSync("./guion_sincronizado.json", JSON.stringify({ scenes: processedScenes }, null, 2));

  console.log("\n🎬 Renderizando con Remotion en GitHub Actions...");
  execSync(`npx remotion render LongReel out/reel_azure_premium.mp4 --concurrency=1`, { stdio: "inherit" });
  console.log("\n🎉 ¡Reel completado con éxito!");
}

main().catch(err => console.error("❌ Fallo en la ejecución:", err));