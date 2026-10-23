import React from "react";
import { Composition } from "remotion";
import { LongVideo } from "./LongVideo";
import sincronizadoData from "../guion_sincronizado.json";

export const RemotionRoot: React.FC = () => {
  const scenes = (sincronizadoData.scenes || []) as any[];

  // Suma los fotogramas reales asegurando el tipo de dato
  const totalFrames =
    scenes.length > 0
      ? scenes.reduce(
          (acc: number, s: any) => acc + (Number(s.durationInFrames) || 0),
          0
        )
      : 300;

  return (
    <>
      <Composition
        id="LongReel"
        component={LongVideo as any}
        durationInFrames={totalFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: scenes as any,
        }}
      />
    </>
  );
};