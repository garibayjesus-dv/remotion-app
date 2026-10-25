import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { vineBoom, whoosh, whip, pageTurn } from "@remotion/sfx";

export interface SceneProps {
  index?: number;
  totalScenes?: number;
  tag?: string;
  format?: string;
  role?: string;
  tone?: string;
  image: string;
  prevImage?: string;
  audioFile?: string;
}

const CANTIDAD_PARTICULAS = 24;
const BARRAS_ONDA = 14;

export const Scene: React.FC<SceneProps> = ({
  index = 0,
  totalScenes = 12,
  tag = "",
  format = "documental",
  role = "narrador",
  tone = "serio",
  image,
  prevImage,
  audioFile,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progreso = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progreso global del video (para barra superior en top_datos y noticia)
  const progresoGlobal = interpolate(
    frame,
    [0, durationInFrames],
    [index / Math.max(1, totalScenes), (index + 1) / Math.max(1, totalScenes)],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

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
    baseScale = interpolate(progreso, [0, 1], [1.08, 1.23]);
    baseX = interpolate(progreso, [0, 1], [14, -14]);
    baseY = interpolate(progreso, [0, 1], [-12, 12]);
    baseRotate = interpolate(progreso, [0, 1], [-0.8, 0.8]);
  } else {
    baseScale = interpolate(progreso, [0, 1], [1.2, 1.06]);
    baseX = interpolate(progreso, [0, 1], [-15, 15]);
    baseY = interpolate(progreso, [0, 1], [-16, 16]);
    baseRotate = interpolate(progreso, [0, 1], [0.8, -0.8]);
  }

  // 2. Corte "Punch-In" elástico a mitad de escena (no se aplica en oraciones pacíficas de cierre)
  const framePunchIn = Math.floor(durationInFrames * 0.52);
  const aplicaPunchIn =
    format !== "espiritual" &&
    (tone === "intriga" || tone === "impacto" || format === "top_datos" || index === 0);
  const enPunchIn = aplicaPunchIn && frame >= framePunchIn;

  const resortePunch = enPunchIn
    ? spring({
        frame: frame - framePunchIn,
        fps,
        config: { damping: 13, stiffness: 220, mass: 0.5 },
      })
    : 0;

  const punchScale = interpolate(resortePunch, [0, 1], [1, 1.15]);
  const punchOffsetX = interpolate(resortePunch, [0, 1], [0, index % 2 === 0 ? -20 : 20]);
  const punchOffsetY = interpolate(resortePunch, [0, 1], [0, -16]);

  // Motion Blur y Aberración Cromática Anamórfica en cambios rápidos y Punch-In
  const blurTransicionInicial = interpolate(frame, [0, 5], [3.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blurChoquePunch = enPunchIn
    ? interpolate(frame - framePunchIn, [0, 2, 6], [0, 4.0, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const motionBlurTotal = Math.max(blurTransicionInicial, blurChoquePunch);

  const flashPunchIn = enPunchIn
    ? interpolate(frame - framePunchIn, [0, 2, 10], [0, 0.42, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // 3. Vibración orgánica de cámara con @remotion/noise (suavizada en espiritual e infantil)
  const intensidadShake =
    format === "espiritual" || format === "infantil"
      ? 2.2
      : format === "terror"
        ? 11
        : tone === "impacto"
          ? 9
          : 3.5;
  const velocidadShake =
    format === "espiritual" || format === "infantil"
      ? 0.025
      : format === "terror" || tone === "impacto"
        ? 0.08
        : 0.035;

  const shakeX = noise2D(`shakeX-${index}`, frame * velocidadShake, 0) * intensidadShake;
  const shakeY = noise2D(`shakeY-${index}`, 0, frame * velocidadShake) * intensidadShake;
  const shakeRotate = noise2D(`shakeR-${index}`, frame * velocidadShake, frame * velocidadShake) * 0.45;

  const finalScale = baseScale * punchScale;
  const finalX = baseX + punchOffsetX + shakeX;
  const finalY = baseY + punchOffsetY + shakeY;
  const finalRotate = baseRotate + shakeRotate;

  // Pulso "Reactivo a la Voz" simulado con armónicos de frecuencia vocal
  const pulsoVoz =
    0.5 +
    0.5 * Math.sin(frame * 0.38 + index) * Math.cos(frame * 0.19) +
    noise2D(`voice-energy-${index}`, frame * 0.12, 0) * 0.25;

  // 4. Transición cruzada suave (Cross-Dissolve)
  const opacidadPrevImage = interpolate(frame, [0, 14], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scalePrevImage = interpolate(frame, [0, 14], [1.14, 1.24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 5. Destellos de lente (Light Leaks) adaptados a los 7 formatos
  const opacidadLightLeak = interpolate(frame, [0, 4, 18], [0.55, 0.35, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let colorLightLeak =
    "radial-gradient(circle at 20% 30%, rgba(251, 146, 60, 0.72) 0%, rgba(234, 88, 12, 0.25) 45%, rgba(0, 0, 0, 0) 75%)";
  if (format === "espiritual") {
    colorLightLeak =
      "radial-gradient(circle at 50% 15%, rgba(253, 224, 71, 0.85) 0%, rgba(245, 158, 11, 0.35) 50%, rgba(0, 0, 0, 0) 80%)";
  } else if (format === "infantil") {
    colorLightLeak =
      "radial-gradient(circle at 80% 20%, rgba(244, 114, 182, 0.65) 0%, rgba(56, 189, 248, 0.35) 50%, rgba(0, 0, 0, 0) 80%)";
  } else if (format === "terror") {
    colorLightLeak =
      "radial-gradient(circle at 50% 40%, rgba(185, 28, 28, 0.68) 0%, rgba(15, 23, 42, 0.4) 50%, rgba(0, 0, 0, 0) 78%)";
  } else if (format === "ciencia") {
    colorLightLeak =
      "radial-gradient(circle at 80% 25%, rgba(56, 189, 248, 0.75) 0%, rgba(14, 165, 233, 0.28) 48%, rgba(0, 0, 0, 0) 75%)";
  } else if (format === "noticia") {
    colorLightLeak =
      "radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.82) 0%, rgba(239, 68, 68, 0.28) 45%, rgba(0, 0, 0, 0) 75%)";
  }

  // 6. Color Grading Camaleónico por Formato y Rol + Aberración Cromática en impactos
  const parpadeoProyector =
    role === "testigo" ? 1 + noise2D(`flicker-${index}`, frame * 0.45, 0) * 0.04 : 1;

  const activarAberracion =
    (tone === "impacto" || format === "terror" || blurChoquePunch > 1) &&
    format !== "infantil" &&
    format !== "espiritual";

  const filtroAberracion = activarAberracion
    ? "drop-shadow(-3px 0px 0px rgba(239, 68, 68, 0.42)) drop-shadow(3px 0px 0px rgba(56, 189, 248, 0.42))"
    : "";

  let filtroColor = `contrast(1.14) saturate(1.18) brightness(0.95) blur(${motionBlurTotal.toFixed(2)}px) ${filtroAberracion}`;

  if (format === "espiritual") {
    filtroColor = `contrast(1.08) saturate(1.22) brightness(1.03) sepia(0.1) blur(${motionBlurTotal.toFixed(2)}px)`;
  } else if (format === "infantil") {
    filtroColor = `contrast(1.06) saturate(1.35) brightness(1.05) blur(${motionBlurTotal.toFixed(2)}px)`;
  } else if (role === "testigo") {
    filtroColor = `contrast(1.22) saturate(0.75) sepia(0.28) brightness(${(0.92 * parpadeoProyector).toFixed(3)}) blur(${motionBlurTotal.toFixed(2)}px)`;
  } else if (role === "archivo") {
    filtroColor = `contrast(1.25) saturate(0.88) hue-rotate(-8deg) brightness(0.94) blur(${motionBlurTotal.toFixed(2)}px)`;
  } else if (format === "terror") {
    filtroColor = `contrast(1.28) saturate(0.82) brightness(0.86) blur(${motionBlurTotal.toFixed(2)}px) ${filtroAberracion}`;
  } else if (format === "ciencia") {
    filtroColor = `contrast(1.18) saturate(1.28) brightness(0.97) blur(${motionBlurTotal.toFixed(2)}px) ${filtroAberracion}`;
  }

  // 7. Partículas 2.5D Parallax (Polvo de oro en espiritual, Luciérnagas en infantil, Ceniza en terror)
  const particulas = useMemo(() => {
    return Array.from({ length: CANTIDAD_PARTICULAS }).map((_, i) => {
      const esPrimerPlano = i % 3 === 0;
      let colorParticula = "rgba(255, 255, 255, 0.75)";

      if (format === "espiritual") {
        colorParticula = i % 2 === 0 ? "rgba(253, 224, 71, 0.9)" : "rgba(251, 191, 36, 0.8)";
      } else if (format === "infantil") {
        const coloresMagicos = [
          "rgba(254, 240, 138, 0.92)",
          "rgba(125, 211, 252, 0.92)",
          "rgba(244, 114, 182, 0.9)",
          "rgba(167, 243, 208, 0.9)",
        ];
        colorParticula = coloresMagicos[i % coloresMagicos.length];
      } else if (format === "terror") {
        colorParticula = "rgba(254, 202, 202, 0.55)";
      } else if (format === "ciencia") {
        colorParticula = "rgba(186, 230, 253, 0.78)";
      } else if (role === "testigo") {
        colorParticula = "rgba(254, 243, 199, 0.72)";
      }

      return {
        id: i,
        baseX: (i * 41 + index * 17) % 100,
        baseY: (i * 67 + index * 29) % 100,
        size: esPrimerPlano ? 8 + (i % 5) : 3 + (i % 4),
        speed: esPrimerPlano ? 1.5 : 0.65,
        opacity: esPrimerPlano ? 0.38 : 0.62,
        blur: esPrimerPlano ? 2.5 : 0.4,
        color: colorParticula,
      };
    });
  }, [index, role, format]);

  // 8. Sello Superior Dinámico (con animación elástica y onda de voz)
  let textoSello = "";
  let colorTextoSello = "#7dd3fc";
  let colorPuntoSello = "#ef4444";
  let mostrarOndaVoz = false;

  if (format === "top_datos" && /^DATO #\d+/i.test(tag)) {
    textoSello = `⚡ ${tag.toUpperCase()}`;
    const esDatoUno = tag.toUpperCase().includes("#1") && !tag.toUpperCase().includes("#10");
    colorTextoSello = esDatoUno ? "#fde047" : "#38bdf8";
    colorPuntoSello = esDatoUno ? "#eab308" : "#0ea5e9";
  } else if (role === "testigo") {
    textoSello = "🎙️ TESTIMONIO // ARCHIVO DE VOZ";
    colorTextoSello = "#fde68a";
    colorPuntoSello = "#f59e0b";
    mostrarOndaVoz = true;
  } else if (role === "archivo") {
    textoSello = "📁 EXPEDIENTE // REPORTE TÉCNICO";
    colorTextoSello = "#7dd3fc";
    colorPuntoSello = "#ef4444";
    mostrarOndaVoz = true;
  } else if (format === "noticia") {
    textoSello = index === 0 ? "🔴 ÚLTIMA HORA // REPORTE ESPECIAL" : "🔴 EN DESARROLLO // INFORMACIÓN";
    colorTextoSello = "#fecaca";
    colorPuntoSello = "#ef4444";
    mostrarOndaVoz = true;
  } else if (format === "espiritual" && index === 0) {
    textoSello = "✨ MENSAJE DE FE Y ESPERANZA";
    colorTextoSello = "#fef08a";
    colorPuntoSello = "#f59e0b";
  }

  const duracionSello = format === "top_datos" || format === "noticia" ? 100 : 80;
  const caracteresVisibles = Math.floor(
    interpolate(frame, [4, 34], [0, textoSello.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const opacidadSello = interpolate(
    frame,
    [0, 8, duracionSello - 14, duracionSello],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );
  const escalaSello = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });

  const imageSrc = image.startsWith("http") ? image : staticFile(image);
  const prevImageSrc = prevImage
    ? prevImage.startsWith("http")
      ? prevImage
      : staticFile(prevImage)
    : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* 1. Voz del narrador / testigo / archivo */}
      {audioFile && <Audio src={staticFile(audioFile)} volume={1} />}

      {/* 2. Efectos de Sonido (no suenan golpes bruscos en modo espiritual ni infantil) */}
      {index === 0 && format !== "espiritual" && format !== "infantil" && (
        <Audio src={vineBoom} volume={0.22} />
      )}
      {index > 0 && role === "testigo" && <Audio src={pageTurn} volume={0.22} />}
      {index > 0 && role !== "testigo" && format !== "espiritual" && (
        <Audio src={tone === "impacto" ? whip : whoosh} volume={format === "infantil" ? 0.08 : 0.13} />
      )}

      {/* 3. Micro-sonido sincronizado en el corte Punch-In */}
      {aplicaPunchIn && durationInFrames > 45 && (
        <Sequence from={framePunchIn} durationInFrames={20}>
          <Audio src={whoosh} volume={0.08} />
        </Sequence>
      )}

      {/* 4. Imagen Principal con Ken Burns + Punch-In + Motion Blur + Aberración Cromática */}
      <Img
        src={imageSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${finalScale}) translate(${finalX}px, ${finalY}px) rotate(${finalRotate}deg)`,
          filter: filtroColor,
        }}
      />

      {/* 5. Rayos de Luz Celestial (God Rays) exclusivos para el modo Espiritual */}
      {format === "espiritual" && (
        <AbsoluteFill
          style={{
            background:
              "conic-gradient(from 165deg at 50% -10%, rgba(0,0,0,0) 0deg, rgba(253, 224, 71, 0.22) 15deg, rgba(0,0,0,0) 32deg, rgba(251, 191, 36, 0.25) 48deg, rgba(0,0,0,0) 65deg)",
            opacity: 0.75 + pulsoVoz * 0.2,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 6. Capa Parallax 2.5D de Partículas Flotantes */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {particulas.map((p) => {
          const driftX = noise2D(`px-${p.id}`, frame * 0.008 * p.speed, index) * 65;
          // En espiritual suben suavemente hacia el cielo; en los demás flotan orgánicamente
          const direccionVertical = format === "espiritual" ? -0.35 : -0.18;
          const driftY =
            noise2D(`py-${p.id}`, index, frame * 0.008 * p.speed) * 65 +
            frame * p.speed * direccionVertical;
          const posX = (p.baseX + driftX + 100) % 100;
          const posY = (p.baseY + driftY + 100) % 100;

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
                backgroundColor: p.color,
                boxShadow:
                  format === "espiritual" || format === "infantil"
                    ? `0 0 ${p.size * 2}px ${p.color}`
                    : "none",
                opacity: p.opacity,
                filter: `blur(${p.blur}px)`,
                transform: `translate(${-finalX * 0.35 * p.speed}px, ${-finalY * 0.35 * p.speed}px)`,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* 7. Destello óptico en el corte Punch-In */}
      {flashPunchIn > 0.01 && (
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.85) 0%, rgba(56,189,248,0.25) 55%, rgba(0,0,0,0) 85%)",
            opacity: flashPunchIn,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* 8. Cross-Dissolve desde la escena anterior */}
      {prevImageSrc && frame < 15 && (
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

      {/* 9. Light Leak en cada transición */}
      {frame < 18 && (
        <AbsoluteFill
          style={{
            background: colorLightLeak,
            opacity: opacidadLightLeak,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* 10. Iluminación Volumétrica Reactiva a la Voz */}
      <AbsoluteFill
        style={{
          background:
            format === "espiritual"
              ? "radial-gradient(circle at 50% 20%, rgba(253, 224, 71, 0.26) 0%, rgba(0, 0, 0, 0) 68%)"
              : format === "infantil"
                ? "radial-gradient(circle at 50% 25%, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0) 65%)"
                : format === "terror"
                  ? "radial-gradient(circle at 50% 30%, rgba(220, 38, 38, 0.18) 0%, rgba(0, 0, 0, 0) 65%)"
                  : role === "testigo"
                    ? "radial-gradient(circle at 50% 25%, rgba(245, 158, 11, 0.22) 0%, rgba(0, 0, 0, 0) 65%)"
                    : "radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.22) 0%, rgba(0, 0, 0, 0) 65%)",
          opacity: Math.min(1, Math.max(0.2, pulsoVoz * 0.85)),
          mixBlendMode: "screen",
        }}
      />

      {/* 11. Viñeta inteligente (Oscura en misterio/documental, Cálida suave en espiritual, Limpia en infantil) */}
      {format !== "infantil" && (
        <AbsoluteFill
          style={{
            background:
              format === "espiritual"
                ? "radial-gradient(circle at center, rgba(0,0,0,0) 52%, rgba(45,25,5,0.42) 90%, rgba(20,10,0,0.68) 100%)"
                : "radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(0,0,0,0.65) 88%, rgba(0,0,0,0.92) 100%)",
          }}
        />
      )}

      {/* 12. Sombras superior e inferior para contraste de lectura */}
      <AbsoluteFill
        style={{
          background:
            format === "infantil"
              ? "linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 15%, rgba(0,0,0,0) 80%, rgba(0,0,0,0.45) 100%)"
              : "linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* 13. Barra de Progreso Luminosa Superior (en Top Datos y Noticia) */}
      {(format === "top_datos" || format === "noticia") && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.14)",
          }}
        >
          <div
            style={{
              width: `${(progresoGlobal * 100).toFixed(1)}%`,
              height: "100%",
              background:
                format === "noticia"
                  ? "linear-gradient(90deg, #ef4444, #f97316)"
                  : "linear-gradient(90deg, #38bdf8, #fde047)",
              boxShadow: "0 0 16px rgba(56, 189, 248, 0.9)",
            }}
          />
        </div>
      )}

      {/* 14. Tarjeta / Cintillo Superior + Onda de Voz Reactiva */}
      {textoSello && frame < duracionSello && (
        <div
          style={{
            position: "absolute",
            top: "78px",
            left: "58px",
            opacity: opacidadSello,
            transform: `scale(${interpolate(escalaSello, [0, 1], [0.85, 1])})`,
            transformOrigin: "left center",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            backgroundColor: "rgba(15, 23, 42, 0.68)",
            border: `1.5px solid ${colorPuntoSello}66`,
            backdropFilter: "blur(8px)",
            padding: "10px 22px",
            borderRadius: "14px",
            fontFamily: "monospace",
            fontSize: format === "top_datos" ? "28px" : "22px",
            fontWeight: 800,
            letterSpacing: "2.5px",
            color: colorTextoSello,
            boxShadow: "0 8px 24px rgba(0,0,0,0.65)",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: colorPuntoSello,
              boxShadow: `0 0 12px ${colorPuntoSello}`,
            }}
          />
          <span>{textoSello.slice(0, caracteresVisibles)}</span>

          {/* Onda de audio reactiva cuando habla Testigo, Archivo o Noticiero */}
          {mostrarOndaVoz && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                height: "22px",
                marginLeft: "8px",
              }}
            >
              {Array.from({ length: BARRAS_ONDA }).map((_, b) => {
                const altura =
                  6 +
                  Math.abs(
                    Math.sin(frame * 0.35 + b * 0.7) *
                      Math.cos(frame * 0.22 - b * 0.4) *
                      18
                  );
                return (
                  <div
                    key={b}
                    style={{
                      width: "3px",
                      height: `${altura.toFixed(1)}px`,
                      backgroundColor: colorTextoSello,
                      borderRadius: "2px",
                      opacity: 0.85,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};