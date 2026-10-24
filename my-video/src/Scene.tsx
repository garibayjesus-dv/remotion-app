import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { vineBoom, whoosh, whip } from "@remotion/sfx";

export interface SceneProps {
  index?: number;
  tag?: string;
  tone?: string;
  image: string;
  prevImage?: string;
  audioFile?: string;
}

export const Scene: React.FC<SceneProps> = ({
  index = 0,
  tone = "serio",
  image,
  prevImage,
  audioFile,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progreso = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 1. Movimiento base Ken Burns (4 estilos alternados por escena)
  const tipoMovimiento = index % 4;
  let baseScale = 1.12;
  let baseX = 0;
  let baseY = 0;
  let baseRotate = 0;

  if (tipoMovimiento === 0) {
    baseScale = interpolate(progreso, [0, 1], [1.06, 1.22]);
    baseX = interpolate(progreso, [0, 1], [-18, 18]);
    baseY = interpolate(progreso, [0, 1], [10, -10]);
  } else if (tipoMovimiento === 1) {
    baseScale = interpolate(progreso, [0, 1], [1.24, 1.07]);
    baseX = interpolate(progreso, [0, 1], [16, -16]);
    baseY = interpolate(progreso, [0, 1], [18, -14]);
  } else if (tipoMovimiento === 2) {
    baseScale = interpolate(progreso, [0, 1], [1.07, 1.24]);
    baseX = interpolate(progreso, [0, 1], [20, -20]);
    baseRotate = interpolate(progreso, [0, 1], [-1.2, 1.2]);
  } else {
    baseScale = interpolate(progreso, [0, 1], [1.2, 1.06]);
    baseX = interpolate(progreso, [0, 1], [-20, 20]);
    baseY = interpolate(progreso, [0, 1], [-16, 16]);
    baseRotate = interpolate(progreso, [0, 1], [1, -1]);
  }

  // 2. Cámara en mano orgánica con @remotion/noise (más intensa en escenas de impacto/intriga)
  const intensidadShake = tone === "impacto" ? 10 : tone === "intriga" ? 6 : 3.5;
  const velocidadShake = tone === "impacto" ? 0.045 : 0.025;

  const shakeX = noise2D(`shakeX-${index}`, frame * velocidadShake, 0) * intensidadShake;
  const shakeY = noise2D(`shakeY-${index}`, 0, frame * velocidadShake) * intensidadShake;
  const shakeRot = noise2D(`shakeR-${index}`, frame * velocidadShake, frame * velocidadShake) * 0.45;

  // 3. Efecto de transición de entrada (primeros 14 frames)
  const opacidadPrevImage = interpolate(frame, [0, 14], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scalePrevImage = interpolate(frame, [0, 14], [1.15, 1.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const blurEntrada = interpolate(frame, [0, 10], [6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 4. Light Leak (filtración de luz de cine en el cambio de escena)
  const opacidadLightLeak = interpolate(frame, [0, 4, 18], [0.75, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Alternamos entre destello cálido ámbar (cine 35mm) y azul frío de misterio
  const colorLightLeak =
    index % 2 === 0
      ? "radial-gradient(circle at 20% 40%, rgba(251, 146, 60, 0.85) 0%, rgba(239, 68, 68, 0.35) 45%, rgba(0,0,0,0) 75%)"
      : "radial-gradient(circle at 80% 30%, rgba(56, 189, 248, 0.8) 0%, rgba(99, 102, 241, 0.35) 45%, rgba(0,0,0,0) 75%)";

  // Pulso ambiental continuo durante la escena
  const pulsoAtmosfera = interpolate(Math.sin(frame / 14), [-1, 1], [0.08, 0.22]);

  const imageSrc = image.startsWith("http") ? image : staticFile(image);
  const prevImageSrc = prevImage
    ? prevImage.startsWith("http")
      ? prevImage
      : staticFile(prevImage)
    : null;

  // Sonido de transición: Impacto grave en la Escena 1 (Gancho) y Whoosh/Whip suave en las demás
  const sfxTransicion = index === 0 ? vineBoom : index % 3 === 0 ? whip : whoosh;
  const volumenSfx = index === 0 ? 0.22 : 0.13;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* 1. Audio de la locución de esta escena */}
      {audioFile && <Audio src={staticFile(audioFile)} volume={1.0} />}

      {/* 2. Efecto de sonido oficial de @remotion/sfx al iniciar la escena */}
      <Audio src={sfxTransicion} volume={volumenSfx} />

      {/* 3. Imagen principal con Ken Burns + Cámara en Mano (@remotion/noise) */}
      <Img
        src={imageSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${baseScale}) translate(${baseX + shakeX}px, ${baseY + shakeY}px) rotate(${baseRotate + shakeRot}deg)`,
          filter: `blur(${blurEntrada}px) contrast(1.09) saturate(1.14) brightness(1.02)`,
        }}
      />

      {/* 4. Cross-fade con la escena anterior (superposición suave de 14 frames) */}
      {prevImageSrc && frame < 14 && (
        <Img
          src={prevImageSrc}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: opacidadPrevImage,
            transform: `scale(${scalePrevImage})`,
            filter: "blur(4px)",
          }}
        />
      )}

      {/* 5. Light Leak (Destello de lente cinematográfico en cada transición) */}
      {frame < 18 && (
        <AbsoluteFill
          style={{
            background: colorLightLeak,
            opacity: opacidadLightLeak,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* 6. Iluminación volumétrica sutil en movimiento */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.22) 0%, rgba(0, 0, 0, 0) 65%)",
          opacity: pulsoAtmosfera,
          mixBlendMode: "screen",
        }}
      />

      {/* 7. Viñeta radial oscura de documental */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(0,0,0,0.65) 88%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      {/* 8. Sombras superior e inferior para dar profundidad */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};