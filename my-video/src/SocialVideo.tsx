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

export interface SocialVideoProps {
  category: string;
  headline: string;
  source: string;
  bgImage?: string;
  cardImage?: string;
  audioUrl?: string;
}

export const defaultVideoProps: SocialVideoProps = {
  category: "TECNOLOGÍA",
  headline: "Remotion automatiza videos usando React y datos en tiempo real",
  source: "@garibayjesus-dv",
  bgImage:
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1080&auto=format&fit=crop",
  cardImage:
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
  audioUrl: staticFile("musica.mp3"),
};

export const SocialVideo: React.FC<SocialVideoProps> = ({
  category,
  headline,
  source,
  bgImage = defaultVideoProps.bgImage,
  cardImage = defaultVideoProps.cardImage,
  audioUrl = defaultVideoProps.audioUrl,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // 1. Zoom suave de fondo
  const bgScale = interpolate(frame, [0, durationInFrames], [1, 1.2], {
    extrapolateRight: "clamp",
  });

  // 2. Barra de progreso superior
  const progressPercent = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: "clamp",
  });

  // 3. Animación de entrada de la etiqueta
  const badgeScale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5 },
  });

  // 4. Animación de entrada para la tarjeta central
  const cardScale = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  // 5. Lógica de subtítulos dinámicos
  const words = headline.split(" ");
  const framesPerWord = 10;
  const currentWordIndex = Math.floor(frame / framesPerWord);

  const activeBgImage = bgImage || defaultVideoProps.bgImage!;
  const activeCardImage = cardImage || defaultVideoProps.cardImage!;
  const activeAudioUrl = audioUrl || defaultVideoProps.audioUrl!;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* Audio local desde la carpeta public */}
      {activeAudioUrl && <Audio src={activeAudioUrl} volume={0.15} />}

      {/* Fondo con zoom */}
      <Img
        src={activeBgImage}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${bgScale})`,
        }}
      />

      {/* Capa de contraste */}
      <AbsoluteFill
        style={{
          backgroundColor: "rgba(10, 15, 25, 0.84)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Barra de progreso */}
      <div
        style={{
          position: "absolute",
          top: "60px",
          left: "60px",
          right: "60px",
          height: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "10px",
          overflow: "hidden",
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPercent}%`,
            backgroundColor: "#38bdf8",
            borderRadius: "10px",
            boxShadow: "0 0 12px rgba(56, 189, 248, 0.8)",
          }}
        />
      </div>

      {/* Contenedor principal */}
      <AbsoluteFill
        style={{
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "130px 60px 100px 60px",
          textAlign: "center",
          zIndex: 1,
        }}
      >
        {/* Etiqueta superior */}
        <div
          style={{
            transform: `scale(${badgeScale})`,
            backgroundColor: "#2563eb",
            color: "#ffffff",
            padding: "14px 38px",
            borderRadius: "50px",
            fontSize: "30px",
            fontWeight: "800",
            letterSpacing: "3px",
            boxShadow: "0 10px 25px rgba(37, 99, 235, 0.4)",
          }}
        >
          {category}
        </div>

        {/* Tarjeta central */}
        <div
          style={{
            transform: `scale(${cardScale})`,
            width: "880px",
            height: "540px",
            borderRadius: "28px",
            overflow: "hidden",
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 2px rgba(255, 255, 255, 0.12)",
            backgroundColor: "#1e293b",
          }}
        >
          <Img
            src={activeCardImage}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        {/* Subtítulos tipo Karaoke */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "16px",
            maxWidth: "920px",
            minHeight: "220px",
            alignContent: "center",
          }}
        >
          {words.map((word, index) => {
            const isCurrent = index === currentWordIndex;
            const isPast = index < currentWordIndex;
            const wordStartFrame = index * framesPerWord;

            const popScale = spring({
              frame: frame - wordStartFrame,
              fps,
              config: { damping: 10, mass: 0.4 },
            });

            let color = "#475569";
            let scale = 0.95;
            let opacity = 0.25;
            let textShadow = "none";

            if (isCurrent) {
              color = "#facc15";
              scale = popScale * 1.15;
              opacity = 1;
              textShadow = "0 0 35px rgba(250, 204, 21, 0.85)";
            } else if (isPast) {
              color = "#ffffff";
              scale = 1;
              opacity = 0.95;
              textShadow = "0 4px 15px rgba(0,0,0,0.7)";
            }

            return (
              <span
                key={index}
                style={{
                  fontSize: "56px",
                  fontWeight: "900",
                  lineHeight: "1.25",
                  color,
                  opacity,
                  transform: `scale(${scale})`,
                  textShadow,
                  transition: "color 0.1s ease, transform 0.1s ease",
                  display: "inline-block",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Crédito inferior */}
        <div
          style={{
            fontSize: "28px",
            color: "#94a3b8",
            fontWeight: "600",
            letterSpacing: "1.5px",
          }}
        >
          Fuente: {source}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};