import fs from "fs";
import "dotenv/config";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function probarFlux() {
  console.log("⚡ Conectando a Cloudflare Workers AI (FLUX.1 [schnell])...");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "Cinematic portrait of a futuristic astronaut standing on Mars, golden hour lighting, photorealistic 8k, vertical 9:16",
        steps: 4, // 4 pasos es el estándar ultrarrápido de FLUX Schnell
      }),
    }
  );

  const data = await response.json();

  if (!data.success) {
    console.error("❌ Error de Cloudflare:", data.errors);
    return;
  }

  // Cloudflare devuelve la imagen codificada en Base64
  const base64Image = data.result.image;
  fs.writeFileSync("public/test_flux.jpg", Buffer.from(base64Image, "base64"));

  console.log("✅ ¡Imagen de prueba generada con éxito en: public/test_flux.jpg!");
}

probarFlux();