import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface SceneProps {
  tag?: string;
  image: string;
  audioFile?: string;
}

export const Scene: React.FC<SceneProps> = ({ tag, image, audioFile }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Zoom suave continuo durante la escena (1.0x a 1.15x)
  const bgScale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  // Animación suave para la etiqueta superior
  const tagScale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5 },
  });

  const imageSrc = image.startsWith("http") ? image : staticFile(image);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* 1. Audio de la voz de esta escena */}
      {audioFile && <Audio src={staticFile(audioFile)} volume={1.0} />}

      {/* 2. Imagen generada por IA con movimiento */}
      <Img
        src={imageSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${bgScale})`,
        }}
      />

      {/* 3. Viñeta cinematográfica sutil */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* 4. Etiqueta superior (si existe) */}
      {tag && (
        <div
          style={{
            position: "absolute",
            top: "120px",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              transform: `scale(${tagScale})`,
              backgroundColor: "rgba(15, 23, 42, 0.85)",
              color: "#38bdf8",
              border: "2px solid rgba(56, 189, 248, 0.4)",
              backdropFilter: "blur(8px)",
              padding: "14px 38px",
              borderRadius: "50px",
              fontSize: "30px",
              fontWeight: "800",
              letterSpacing: "3px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            }}
          >
            {tag}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};