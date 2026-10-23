import React from "react";
import {
  AbsoluteFill,
  Audio,
  Series,
  staticFile,
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
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Música de fondo ambiental tenue */}
      <Audio src={staticFile("musica.mp3")} volume={0.07} />

      {/* Secuencia de escenas con efectos de cámara alternados y sin textos */}
      <Series>
        {scenes.map((scene, index) => (
          <Series.Sequence
            key={scene.id || index}
            durationInFrames={scene.durationInFrames}
          >
            <Scene
              index={index}
              tag={scene.tag}
              tone={scene.tone}
              image={scene.image}
              audioFile={scene.audioFile}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};