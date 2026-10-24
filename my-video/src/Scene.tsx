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
  tag?: string;
  format?: string;
  role?: string;
  tone?: string;
  image: string;
  prevImage?: string;
  audioFile?: string;
}

const CANTIDAD_PARTICULAS = 22;

export const Scene: React.FC<SceneProps> = ({
  index = 0,
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

  // 2. Corte "Punch-In" Profesional a mitad de escena con resorte + reencuadre
  const framePunchIn = Math.floor(durationInFrames * 0.52);
  const aplicaPunchIn =
    tone === "impacto" ||
    tone === "intriga" ||
    role !== "narrador" ||
    format === "top_datos" ||
    index === 0;

  const punchSpring = aplicaPunchIn
    ? spring({
        frame: frame - framePunchIn,
        fps,
        config: { damping: 14, stiffness: 220, mass: 0.4 },
      })
    : 0;

  const multiplicadorPunch = 1 + punchSpring * 0.15;
  const offsetPunchY = punchSpring * (index % 2 === 0 ? -14 : 12);

  const blurPunchIn = aplicaPunchIn
    ? interpolate(frame, [framePunchIn - 1, framePunchIn + 1, framePunchIn + 5], [0, 4.5, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const flashPunchIn = aplicaPunchIn
    ? interpolate(frame, [framePunchIn - 1, framePunchIn, framePunchIn + 5], [1, 1.32, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const flickerProyector =
    role === "testigo" ? 1 + noise2D(`flicker-${index}`, frame * 0.35, 0) * 0.05 : 1;

  // 3. Cámara en mano orgánica con @remotion/noise (más intensa en terror/impacto)
  const baseIntensidad = format === "terror" ? 8 : 4;
  const intensidadShake =
    tone === "impacto" ? 10 : tone === "intriga" ? 6.5 : baseIntensidad;
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

  // 5. Light Leak adaptativo según el Formato y Rol
  const opacidadLightLeak = interpolate(frame, [0, 4, 18], [0.75, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let colorLightLeak =
    index % 2 === 0
      ? "radial-gradient(circle at 20% 40%, rgba(251, 146, 60, 0.85) 0%, rgba(239, 68, 68, 0.35) 45%, rgba(0,0,0,0) 75%)"
      : "radial-gradient(circle at 80% 30%, rgba(56, 189, 248, 0.8) 0%, rgba(99, 102, 241, 0.35) 45%, rgba(0,0,0,0) 75%)";

  if (role === "testigo") {
    colorLightLeak =
      "radial-gradient(circle at 25% 35%, rgba(245, 158, 11, 0.85) 0%, rgba(180, 83, 9, 0.4) 45%, rgba(0,0,0,0) 75%)";
  } else if (format === "terror") {
    colorLightLeak =
      "radial-gradient(circle at 30% 35%, rgba(220, 38, 38, 0.75) 0%, rgba(15, 23, 42, 0.5) 50%, rgba(0,0,0,0) 75%)";
  } else if (format === "ciencia") {
    colorLightLeak =
      "radial-gradient(circle at 75% 30%, rgba(34, 211, 238, 0.85) 0%, rgba(59, 130, 246, 0.4) 48%, rgba(0,0,0,0) 75%)";
  }

  // 6. Estética de color según Rol y Formato
  const filtroPorRol =
    role === "testigo"
      ? "sepia(0.24) contrast(1.14) saturate(0.95)"
      : role === "archivo"
        ? "contrast(1.16) saturate(0.88) hue-rotate(-6deg)"
        : format === "terror"
          ? "contrast(1.15) saturate(0.92)"
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

  const sfxTransicion =
    index === 0 ? vineBoom : role === "testigo" ? pageTurn : index % 3 === 0 ? whip : whoosh;
  const volumenSfx = index === 0 ? 0.22 : 0.13;

  // 8. Sello superior inteligente según el formato y el rol
  let textoSello: string | null = null;
  const esDatoTop = format === "top_datos" && /^DATO\s*#?\d/i.test(tag);

  if (esDatoTop) {
    textoSello = `${tag.toUpperCase()} // ARCHIVO CLASIFICADO`;
  } else if (role === "testigo") {
    textoSello = "REGISTRO TESTIMONIAL // BITÁCORA";
  } else if (role === "archivo") {
    textoSello = "EVIDENCIA FORENSE // EXPEDIENTE";
  } else if (format === "noticia" && index === 0) {
    textoSello = "REPORTE ESPECIAL // INVESTIGACIÓN";
  }

  const duracionSello = esDatoTop ? Math.min(durationInFrames - 5, 110) : 78;

  const caracteresVisibles = textoSello
    ? Math.floor(
        interpolate(frame, [4, 30], [0, textoSello.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      )
    : 0;

  const opacidadSello = interpolate(
    frame,
    [0, 8, Math.max(10, duracionSello - 12), duracionSello],
    [0, 0.92, 0.92, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      {/* 1. Audio de la locución de esta escena */}
      {audioFile && <Audio src={staticFile(audioFile)} volume={1.0} />}

      {/* 2. Efecto de sonido al iniciar la escena */}
      <Audio src={sfxTransicion} volume={volumenSfx} />

      {/* 3. Efecto de sonido sincronizado con el corte Punch-In a mitad de escena */}
      {aplicaPunchIn && durationInFrames > 45 && (
        <Sequence from={framePunchIn}>
          <Audio src={whoosh} volume={0.08} />
        </Sequence>
      )}

      {/* 4. Imagen principal con Ken Burns + Punch-In Elástico + Cámara en Mano */}
      <Img
        src={imageSrc}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${baseScale * multiplicadorPunch}) translate(${baseX + shakeX}px, ${baseY + shakeY + offsetPunchY}px) rotate(${baseRotate + shakeRot}deg)`,
          filter: `blur(${blurEntrada + blurPunchIn}px) brightness(${1.02 * flashPunchIn * flickerProyector}) ${filtroPorRol}`,
        }}
      />

      {/* 5. Capa de Partículas Flotantes 2.5D Parallax */}
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
                backgroundColor:
                  role === "testigo"
                    ? "#fde68a"
                    : format === "terror"
                      ? "#fca5a5"
                      : "#e0f2fe",
                opacity: parpadeo,
                filter: `blur(${p.blur}px)`,
                boxShadow: "0 0 8px rgba(255,255,255,0.6)",
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* 6. Cross-fade con la escena anterior */}
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

      {/* 7. Light Leak (Destello de lente cinematográfico en cada transición) */}
      {frame < 18 && (
        <AbsoluteFill
          style={{
            background: colorLightLeak,
            opacity: opacidadLightLeak,
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* 8. Iluminación volumétrica sutil en movimiento */}
      <AbsoluteFill
        style={{
          background:
            role === "testigo"
              ? "radial-gradient(circle at 50% 25%, rgba(245, 158, 11, 0.22) 0%, rgba(0, 0, 0, 0) 65%)"
              : format === "terror"
                ? "radial-gradient(circle at 50% 25%, rgba(220, 38, 38, 0.18) 0%, rgba(0, 0, 0, 0) 65%)"
                : "radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.22) 0%, rgba(0, 0, 0, 0) 65%)",
          opacity: pulsoAtmosfera,
          mixBlendMode: "screen",
        }}
      />

      {/* 9. Viñeta radial oscura de documental */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0) 42%, rgba(0,0,0,0.65) 88%, rgba(0,0,0,0.92) 100%)",
        }}
      />

      {/* 10. Sombras superior e inferior para dar profundidad */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* 11. Sello minimalista superior (Top Datos #5->#1, Testigo, Forense o Reporte) */}
      {textoSello && frame < duracionSello && (
        <div
          style={{
            position: "absolute",
            top: "85px",
            left: "65px",
            opacity: opacidadSello,
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontFamily: "monospace",
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "3px",
            color:
              role === "testigo"
                ? "#fde68a"
                : esDatoTop
                  ? "#38bdf8"
                  : "#7dd3fc",
            textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor:
                role === "testigo"
                  ? "#f59e0b"
                  : esDatoTop
                    ? "#38bdf8"
                    : "#ef4444",
              boxShadow: "0 0 12px currentColor",
            }}
          />
          <span>{textoSello.slice(0, caracteresVisibles)}</span>
        </div>
      )}
    </AbsoluteFill>
  );
};