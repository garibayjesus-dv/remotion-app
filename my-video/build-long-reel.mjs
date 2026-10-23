import fs from "fs";
import { execSync } from "child_process";
import getMP3Duration from "get-mp3-duration";

const guion = JSON.parse(fs.readFileSync("./guion.json", "utf-8"));
const voice = "es-MX-JorgeNeural";

console.log("\n🎙️ Sintetizando y midiendo el audio de cada escena con IA...\n");

const processedScenes = [];

for (let i = 0; i < guion.scenes.length; i++) {
  const scene = guion.scenes[i];
  const audioFileName = `audio_scene_${i + 1}.mp3`;
  const audioPath = `public/${audioFileName}`;

  console.log(`🗣️ [${i + 1}/${guion.scenes.length}] Generando voz para: "${scene.tag}"`);

  // 1. Generar audio exclusivo para esta escena
  const ttsCommand = `edge-tts --voice ${voice} --text "${scene.text.replace(/"/g, '\\"')}" --write-media ${audioPath}`;
  execSync(ttsCommand, { stdio: "pipe" });

  // 2. Medir duración exacta del audio generado
  const buffer = fs.readFileSync(audioPath);
  const durationMs = getMP3Duration(buffer);
  const durationSec = durationMs / 1000;

  // 3. Convertir a frames (30fps) + 12 frames (~0.4s) de pausa natural antes del siguiente corte
  const audioFrames = Math.ceil(durationSec * 30);
  const totalSceneFrames = audioFrames + 12;

  processedScenes.push({
    ...scene,
    audioFile: audioFileName,
    audioDurationInFrames: audioFrames,
    durationInFrames: totalSceneFrames,
  });

  console.log(`   ⏱️ Duración real: ${durationSec.toFixed(2)}s -> ${totalSceneFrames} frames`);
}

// 4. Guardar archivo sincronizado con datos reales
fs.writeFileSync(
  "./guion_sincronizado.json",
  JSON.stringify({ scenes: processedScenes }, null, 2)
);

const totalDurSec = (processedScenes.reduce((acc, s) => acc + s.durationInFrames, 0) / 30).toFixed(1);
console.log(`\n📐 Duración total real del video: ${totalDurSec} segundos.`);

// 5. Renderizar
console.log("🎬 Compilando video final perfectamente sincronizado...");
execSync("npx remotion render LongReel out/reel_sincronizado_perfecto.mp4", {
  stdio: "inherit",
});

console.log("\n🎉 ¡Video renderizado! Archivo guardado en: out/reel_sincronizado_perfecto.mp4");