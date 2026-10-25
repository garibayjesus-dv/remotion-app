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

      {/* Secuencia de escenas camaleónica 2.0 */}
      <Series>
        {scenes.map((scene, index) => (
          <Series.Sequence
            key={scene.id || index}
            durationInFrames={scene.durationInFrames}
          >
            <Scene
              index={index}
              totalScenes={scenes.length}
              tag={scene.tag}
              format={scene.format}
              role={scene.role}
              tone={scene.tone}
              image={scene.image}
              prevImage={index > 0 ? scenes[index - 1].image : undefined}
              audioFile={scene.audioFile}
            />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};