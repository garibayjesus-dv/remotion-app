import fs from "fs";
import { execSync } from "child_process";
import getMP3Duration from "get-mp3-duration";
import "dotenv/config";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;

if (!ACCOUNT_ID || !API_TOKEN || !AZURE_KEY || !AZURE_REGION) {
  console.error("❌ Faltan credenciales en el archivo .env o en GitHub Secrets.");
  process.exit(1);
}

const guion = {
  title: "El misterio de Punto Nemo",
  scenes: [
    { id: "1", tag: "PUNTO NEMO", text: "En medio del océano Pacífico existe el punto más remoto e inaccesible de todo el planeta Tierra.", imagePrompt: "satellite view of Earth focusing on endless vast empty deep blue Pacific Ocean, solitary coordinate point glowing, photorealistic 8k, vertical 9:16", imageFile: "ia_escena_1.jpg" },
    { id: "2", tag: "AISLAMIENTO", text: "La costa más cercana está a casi tres mil kilómetros. Si estuvieras ahí, los humanos más próximos estarían en el espacio.", imagePrompt: "astronaut looking down at empty blue ocean planet from window of space station cupola, hyperrealistic, cinematic lighting, vertical 9:16", imageFile: "ia_escena_2.jpg" },
    { id: "3", tag: "DESIERTO", text: "Debido a las corrientes oceánicas circulares, aquí casi no hay nutrientes. Es un desierto biológico donde apenas existe vida.", imagePrompt: "underwater shot of deep crystal clear empty blue ocean void, sun rays fading into dark abyss, complete silence, cinematic vertical 9:16", imageFile: "ia_escena_3.jpg" },
    { id: "4", tag: "BASURERO", text: "Por esta soledad absoluta, las agencias espaciales de todo el mundo lo eligieron como el basurero definitivo del cosmos.", imagePrompt: "dramatic night shot of old satellites and rocket boosters in low earth orbit, fiery trail, atmospheric reentry beginning, vertical 9:16", imageFile: "ia_escena_4.jpg" },
    { id: "5", tag: "FUEGO", text: "Cuando una estación espacial llega al final de su vida, la envían deliberadamente a estrellarse contra esta zona.", imagePrompt: "giant spacecraft burning and breaking apart in incandescent orange flames through night sky, cinematic sparks, photorealistic vertical 9:16", imageFile: "ia_escena_5.jpg" },
    { id: "6", tag: "IMPACTO", text: "Toneladas de metal y titanio caen a miles de kilómetros por hora provocando un impacto colosal sobre el agua.", imagePrompt: "massive glowing debris crash into dark sea surface causing giant explosion of water and steam, night dramatic lighting, vertical 9:16", imageFile: "ia_escena_6.jpg" },
    { id: "7", tag: "MIR", text: "La legendaria estación espacial soviética Mir descansa ahora mismo a más de cuatro mil metros de profundidad.", imagePrompt: "wreckage of Soviet Mir space station resting on dark seabed, covered in thin marine silt, underwater ROV spotlight illuminating titanium hull, vertical 9:16", imageFile: "ia_escena_7.jpg" },
    { id: "8", tag: "NAVES", text: "En este lecho marino reposan más de doscientos sesenta restos de naves, satélites y módulos de carga espacial.", imagePrompt: "underwater graveyard of space technology on abyssal ocean floor, twisted solar panels, titanium tanks half buried in sand, vertical 9:16", imageFile: "ia_escena_8.jpg" },
    { id: "9", tag: "ISS", text: "Y muy pronto, la propia Estación Espacial Internacional será desorbitada para terminar sepultada bajo estas mismas aguas.", imagePrompt: "International Space Station beginning controlled descent towards earth ocean, golden hour earth glow, atmospheric entry trail, vertical 9:16", imageFile: "ia_escena_9.jpg" },
    { id: "10", tag: "BLOOP", text: "Pero el metal espacial no es lo único extraño. En 1997, micrófonos militares submarinos captaron un sonido perturbador aquí.", imagePrompt: "vintage naval hydrophone sonar screen displaying massive anomalous ultra-low acoustic soundwave frequency, glowing green phosphor, vertical 9:16", imageFile: "ia_escena_10.jpg" },
    { id: "11", tag: "SONIDO", text: "Bautizado como El Bloop, fue tan potente que se escuchó a más de cinco mil kilómetros de distancia a través del océano.", imagePrompt: "mysterious colossal dark silhouette moving through abyssal black deep sea waters, subtle bioluminescent glow, eerie atmosphere, vertical 9:16", imageFile: "ia_escena_11.jpg" },
    { id: "12", tag: "ICEBERG", text: "La ciencia determinó años después que fue la violenta fractura de un enorme iceberg en la Antártida.", imagePrompt: "colossal antarctic glacier iceberg violently cracking and collapsing into dark polar ocean waters, misty frozen atmosphere, vertical 9:16", imageFile: "ia_escena_12.jpg" },
    { id: "13", tag: "COINCIDENCIA", text: "Sin embargo, décadas antes de descubrir Punto Nemo, el escritor Lovecraft ubicó exactamente en estas coordenadas...", imagePrompt: "aged 1920s vintage nautical map on wooden desk, brass compass pointing to handwritten enigmatic coordinates, candlelight, vertical 9:16", imageFile: "ia_escena_13.jpg" },
    { id: "14", tag: "C'THULHU", text: "...a R'lyeh, la mítica ciudad submarina donde una entidad cósmica ancestral duerme bajo el mar.", imagePrompt: "ancient cyclopean submerged stone architecture covered in sea flora, towering monolithic sunken ruins, eerie deep sea green lighting, vertical 9:16", imageFile: "ia_escena_14.jpg" },
    { id: "15", tag: "FINAL", text: "El lugar más solitario del mundo, donde la tecnología del hombre duerme en el olvido del abismo.", imagePrompt: "lone futuristic exploration ship sailing on calm pitch-black ocean under dense starry sky, powerful searchlights illuminating ocean depth, vertical 9:16", imageFile: "ia_escena_15.jpg" }
  ],
};

async function generarImagenCloudflare(prompt, outputPath) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt, steps: 4 }),
    }
  );
  const data = await response.json();
  if (!data.success) throw new Error(JSON.stringify(data.errors));
  fs.writeFileSync(outputPath, Buffer.from(data.result.image, "base64"));
}

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
  console.log("\n🚀 INICIANDO PRODUCCIÓN CON IMÁGENES CLOUDFLARE Y VOZ AZURE PREMIUM\n");
  const processedScenes = [];

  for (let i = 0; i < guion.scenes.length; i++) {
    const scene = guion.scenes[i];
    console.log(`[${i + 1}/${guion.scenes.length}] Procesando: "${scene.tag}"...`);
    
    const audioPath = `public/audio_scene_${i + 1}.mp3`;
    const imagePath = `public/${scene.imageFile}`;

    await generarImagenCloudflare(scene.imagePrompt, imagePath);
    await generarVozAzure(scene.text, audioPath);

    const durationSec = getMP3Duration(fs.readFileSync(audioPath)) / 1000;
    const totalFrames = Math.ceil(durationSec * 30) + 8; // Margen para corte natural

    processedScenes.push({ 
  ...scene, 
  image: scene.imageFile, 
  audioFile: `audio_scene_${i + 1}.mp3`, 
  durationInFrames: totalFrames 
});
  }

  fs.writeFileSync("./guion_sincronizado.json", JSON.stringify({ scenes: processedScenes }, null, 2));

  console.log("\n🎬 Renderizando con Remotion en GitHub Actions...");
  execSync(`npx remotion render LongReel out/reel_azure_premium.mp4 --concurrency=1`, { stdio: "inherit" });
  console.log("\n🎉 ¡Reel premium de 15 escenas completado!");
}

main().catch(err => console.error("❌ Fallo en la ejecución:", err));