import React, { useMemo } from "react";
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
  role?: string;
  tone?: string;
  image: string;
  prevImage?: string;
  audioFile?: string;
}

// Generador determinista de partículas en 2 capas de profundidad (Parallax 2.5D)
const CANTIDAD_PARTICULAS = 22;

export const Scene: React.FC<SceneProps> = ({
  index = 0,
  role = "narrador",
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

  // 1. Movimiento base Ken Burns (4 estilos alternados)
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

  // 2. Corte "Punch-In" a mitad de escena (duplica el dinamismo en escenas de impacto/intriga)
  const framePunchIn = Math.floor(durationInFrames * 0.52);
  const aplicaPunchIn = tone === "impacto" || tone === "intriga" || index === 0;
  const esDespuesDePunch = aplicaPunchIn && frame >= framePunchIn;

  const multiplicadorPunch = esDespuesDePunch ? 1.13 : 1.0;
  const flashPunchIn = aplicaPunchIn
    ? interpolate(frame, [framePunchIn - 1, framePunchIn, framePunchIn + 5], [0, 1.28, 1.0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1.0;

  // 3. Cámara en mano orgánica con @remotion/noise
  const intensidadShake = tone === "impacto" ? 10 : tone === "intriga" ? 6 : 3.5;
  const velocidadShake = tone === "impacto" ? 0.045 : 0.025;

  const shakeX = noise2D(`shakeX-${index}`, frame * velocidadShake, 0) * intensidadShake;
  const shakeY = noise2D(`shakeY-${index}`, 0, frame * velocidadShake) * intensidadShake;
  const shakeRot = noise2D(`shakeR-${index}`, frame * velocidadShake, frame * velocidadShake) * 0.45;

  // 4. Transición de entrada con la escena anterior (primeros 14 frames)
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

  // 5. Light Leak (filtración de luz de cine en el cambio de escena)
  const opacidadLightLeak = interpolate(frame, [0, 4, 18], [0.75, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const colorLightLeak =
    role === "testigo"
      ? "radial-gradient(circle at 25% 35%, rgba(245, 158, 11, 0.85) 0%, rgba(180, 83, 9, 0.4) 45%, rgba(0,0,0,0) 75%)"
      : index % 2 === 0
        ? "radial-gradient(circle at 20% 40%, rgba(251, 146, 60, 0.85) 0%, rgba(239, 68, 68, 0.35) 45%, rgba(0,0,0,0) 75%)"
        : "radial-gradient(circle at 80% 30%, rgba(56, 189, 248, 0.8) 0%, rgba(99, 102, 241, 0.35) 45%, rgba(0,0,0,0) 75%)";

  // 6. Estética de color según la voz que habla (Narrador vs Testigo vs Archivo Forense)
  const filtroPorRol =
    role === "testigo"
      ? "sepia(0.24) contrast(1.14) saturate(0.95)"
      : role === "archivo"
        ? "contrast(1.16) saturate(0.88) hue-rotate(-6deg)"
        : "contrast(1.09) saturate(1.14)";

  // 7. Partículas 3D Parallax deterministas
  const particulas = useMemo(() => {
    return Array.from({ length: CANTIDAD_PARTICULAS }).map((_, i) => {
      const esPrimerPlano = i % 3 === 0;
      return {
        id: i,
        xInicial: ((i * 47 + index * 19) % 96) + 2,
        yInicial: ((i * 73 + index * 31) % 96) + 2,
        size: esPrimerPlano ? 7 + (i % 5) : 3 + (i % 3),
        velocidadY: esPrimerPlano ? 0.85 : 0.35,
        velocidadX: esPrimerPlano ? 0.45 : 0.18,
        opacidadBase: esPrimerPlano ? 0.42 : 0.22,
        blur: esPrimerPlano ? 2.5 : 0.5,
      };
    });
  }, [index]);

  const pulsoAtmosfera = interpolate(Math.sin(frame / 14), [-1, 1], [0.08, 0.22]);

  const imageSrc = image.startsWith("http") ? image : staticFile(image);
  const prevImageSrc = prevImage
    ? prevImage.startsWith("http")
      ? prevImage
      : staticFile(prevImage)
    : null;

  const sfxTransicion = index === 0 ? vineBoom : index % 3 === 0 ? whip : whoosh;
  const volumenSfx = index === 0 ? 0.22 : 0.13;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* 1. Audio de la locución de esta escena */}
      {audioFile && <Audio src={staticFile(audioFile)} volume={1.0} />}

      {/* 2. Efecto de sonido oficial de @remotion/sfx */}
      <Audio src={sfxTransicion} volume={volumenSfx} />

      {/* 3. Imagen principal con Ken Burns + Punch-In + Cámara en Mano */}
      <Img
        src={imageSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${baseScale * multiplicadorPunch}) translate(${baseX + shakeX}px, ${baseY + shakeY}px) rotate(${baseRotate + shakeRot}deg)`,
          filter: `blur(${blurEntrada}px) brightness(${ 1.02 * flashPunchIn }) ${filtroPorRol}`,
        }}
      />

      {/* 4. Capa de Partículas Flotantes 2.5D Parallax */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {particulas.map((p) => {
          const derivaX = noise2D(`px-${index}-${p.id}`, frame * 0.015, 0) * 35;
          const posX = (p.xInicial + frame * p.velocidadX * 0.12 + derivaX + 100) % 100;
          const posY = (p.yInicial - frame * p.velocidadY * 0.18 + 200) % 100;
          const parpadeo = interpolate(
            Math.sin((frame + p.id * 12) / 10),
            [-1, 1],
            [p.opacidadBase * 0.4, p.opacidadBase]
          );

          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: `${posX}%`,
                top: `${posY}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                borderRadius: "50%",
                backgroundColor: role === "testigo" ? "#fde68a" : "#e0f2fe",
                opacity: parpadeo,
                filter: `blur(${p.blur}px)`,
                boxShadow: "0 0 8px rgba(255,255,255,0.6)",
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* 5. Cross-fade con la escena anterior (superposición suave de 14 frames) */}
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

      {/* 6. Light Leak (Destello de lente cinematográfico en cada transición) */}
      {frame < 18 && (
        <AbsoluteFill
          style={{
            background: colorLightLeak,
            opacity: opacidadLightLeak,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* 7. Iluminación volumétrica sutil en movimiento */}
      <AbsoluteFill
        style={{
          background:
            role === "testigo"
              ? "radial-gradient(circle at 50% 25%, rgba(245, 158, 11, 0.22) 0%, rgba(0, 0, 0, 0) 65%)"
              : "radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.22) 0%, rgba(0, 0, 0, 0) 65%)",
          opacity: pulsoAtmosfera,
          mixBlendMode: "screen",
        }}
      />

      {/* 8. Viñeta radial oscura de documental */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(0,0,0,0.65) 88%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      {/* 9. Sombras superior e inferior para dar profundidad */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};