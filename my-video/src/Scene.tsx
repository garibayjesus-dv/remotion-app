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

export interface SceneProps {
  index?: number;
  tag?: string;
  tone?: string;
  image: string;
  audioFile?: string;
}

export const Scene: React.FC<SceneProps> = ({ index = 0, image, audioFile }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progreso = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 4 movimientos de cámara distintos según el número de escena
  const tipoMovimiento = index % 4;

  let scale = 1.1;
  let translateX = 0;
  let translateY = 0;
  let rotate = 0;

  if (tipoMovimiento === 0) {
    // 1. Zoom In clásico + Paneo suave a la derecha
    scale = interpolate(progreso, [0, 1], [1.05, 1.22]);
    translateX = interpolate(progreso, [0, 1], [-18, 18]);
    translateY = interpolate(progreso, [0, 1], [10, -10]);
  } else if (tipoMovimiento === 1) {
    // 2. Zoom Out dramático (de cerca hacia atrás) + Paneo hacia arriba
    scale = interpolate(progreso, [0, 1], [1.24, 1.06]);
    translateX = interpolate(progreso, [0, 1], [15, -15]);
    translateY = interpolate(progreso, [0, 1], [20, -15]);
  } else if (tipoMovimiento === 2) {
    // 3. Zoom In con leve inclinación de cámara (tensión/misterio)
    scale = interpolate(progreso, [0, 1], [1.06, 1.24]);
    translateX = interpolate(progreso, [0, 1], [20, -20]);
    rotate = interpolate(progreso, [0, 1], [-1.2, 1.2]);
  } else {
    // 4. Paneo diagonal profundo + Zoom lento
    scale = interpolate(progreso, [0, 1], [1.18, 1.05]);
    translateX = interpolate(progreso, [0, 1], [-22, 22]);
    translateY = interpolate(progreso, [0, 1], [-18, 18]);
    rotate = interpolate(progreso, [0, 1], [1, -1]);
  }

  // Transición de entrada (desenfoque de lente + destello suave en los primeros 10 frames)
  const blurEntrada = interpolate(frame, [0, 10], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const brilloEntrada = interpolate(frame, [0, 12], [1.35, 1.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fundido suave al entrar y al salir de la escena
  const opacidadEscena = interpolate(
    frame,
    [0, 6, Math.max(7, durationInFrames - 7), durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Pulso sutil de luz atmosférica
  const opacidadLuz = interpolate(Math.sin(frame / 15), [-1, 1], [0.08, 0.22]);

  const imageSrc = image.startsWith("http") ? image : staticFile(image);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        overflow: "hidden",
        opacity: opacidadEscena,
      }}
    >
      {/* 1. Audio de la locución de esta escena */}
      {audioFile && <Audio src={staticFile(audioFile)} volume={1.0} />}

      {/* 2. Imagen generada por IA con cámara dinámica y corrección de color */}
      <Img
        src={imageSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px) rotate(${rotate}deg)`,
          filter: `blur(${blurEntrada}px) brightness(${brilloEntrada}) contrast(1.08) saturate(1.12)`,
        }}
      />

      {/* 3. Efecto de iluminación atmosférica en movimiento */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(56, 189, 248, 0.25) 0%, rgba(0, 0, 0, 0) 65%)",
          opacity: opacidadLuz,
          mixBlendMode: "screen",
        }}
      />

      {/* 4. Viñeta radial cinematográfica (oscurece bordes y centra la atención) */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.65) 90%, rgba(0,0,0,0.9) 100%)",
        }}
      />

      {/* 5. Sombra superior e inferior suave para dar profundidad */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};