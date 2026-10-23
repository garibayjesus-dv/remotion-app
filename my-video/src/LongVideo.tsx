import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Scene, SceneProps } from "./Scene";

export interface LongVideoProps {
  scenes: (SceneProps & {
    id: string;
    durationInFrames: number;
  })[];
}

export const defaultLongVideoProps: LongVideoProps = {
  scenes: [],
};

export const LongVideo: React.FC<LongVideoProps> = ({ scenes = [] }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Barra de progreso global del video (0% a 100%)
  const globalProgress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Música de fondo tenue */}
      <Audio src={staticFile("musica.mp3")} volume={0.06} />

      {/* Secuencia de escenas limpia (sin subtítulos) */}
      <Series>
        {scenes.map((scene) => (
          <Series.Sequence
            key={scene.id}
            durationInFrames={scene.durationInFrames}
          >
            <Scene
              tag={scene.tag}
              image={scene.image}
              audioFile={scene.audioFile}
            />
          </Series.Sequence>
        ))}
      </Series>

      {/* Barra de progreso superior continua */}
      <div
        style={{
          position: "absolute",
          top: "60px",
          left: "60px",
          right: "60px",
          height: "12px",
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "10px",
          overflow: "hidden",
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${globalProgress}%`,
            backgroundColor: "#38bdf8",
            borderRadius: "10px",
            boxShadow: "0 0 16px rgba(56, 189, 248, 0.9)",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};