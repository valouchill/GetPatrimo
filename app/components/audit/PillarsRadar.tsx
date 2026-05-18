"use client";

import * as React from "react";

export interface PillarAxis {
  label: string;
  score: number;   // 0-100 normalisé
  max?: number;
}

export interface PillarsRadarProps {
  pillars: PillarAxis[];
  size?: number;
  className?: string;
}

/**
 * Radar chart SVG inline (pas de lib externe), 3-6 axes.
 * Affiche un polygone des scores normalisés 0-100 sur fond hexagonal de grille.
 * Style "Banque Privée" : emerald-700 outline + emerald-100 fill semi-transparent.
 */
export function PillarsRadar({ pillars, size = 220, className = "" }: PillarsRadarProps) {
  const n = pillars.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;
  const labelRadius = radius + 18;

  // Normaliser les scores 0-100
  const normalize = (p: PillarAxis) => {
    const max = p.max && p.max > 0 ? p.max : 100;
    return Math.max(0, Math.min(100, (p.score / max) * 100)) / 100;
  };

  // Angles : commencer en haut (-90°), tourner clockwise
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const point = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  // Grille : 4 niveaux concentriques (25%, 50%, 75%, 100%)
  const gridLevels = [0.25, 0.5, 0.75, 1];

  // Polygone des scores
  const scorePoints = pillars
    .map((p, i) => {
      const r = radius * normalize(p);
      const pt = point(i, r);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(" ");

  // Axes (lignes du centre vers les sommets)
  const axisLines = pillars.map((_, i) => point(i, radius));

  // Labels (placés à l'extérieur)
  const labels = pillars.map((p, i) => {
    const pt = point(i, labelRadius);
    // Ajuster l'alignement selon position angulaire
    const a = angle(i);
    const anchor: "middle" | "start" | "end" =
      Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
    return { ...pt, label: p.label, score: p.score, max: p.max, anchor };
  });

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Radar des piliers d'analyse"
      >
        {/* Grille */}
        {gridLevels.map((lvl) => {
          const pts = pillars
            .map((_, i) => {
              const pt = point(i, radius * lvl);
              return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <polygon
              key={lvl}
              points={pts}
              fill="none"
              stroke="rgb(226 232 240)"
              strokeWidth={1}
            />
          );
        })}

        {/* Axes */}
        {axisLines.map((pt, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={pt.x.toFixed(1)}
            y2={pt.y.toFixed(1)}
            stroke="rgb(226 232 240)"
            strokeWidth={1}
          />
        ))}

        {/* Score polygon */}
        <polygon
          points={scorePoints}
          fill="rgba(16, 185, 129, 0.20)"
          stroke="rgb(4 120 87)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Dots pour chaque pilier */}
        {pillars.map((p, i) => {
          const r = radius * normalize(p);
          const pt = point(i, r);
          return (
            <circle
              key={i}
              cx={pt.x.toFixed(1)}
              cy={pt.y.toFixed(1)}
              r={3.5}
              fill="rgb(4 120 87)"
            />
          );
        })}

        {/* Labels */}
        {labels.map((l, i) => (
          <g key={i}>
            <text
              x={l.x.toFixed(1)}
              y={l.y.toFixed(1)}
              textAnchor={l.anchor}
              dominantBaseline="middle"
              className="fill-slate-700"
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              {l.label}
            </text>
            <text
              x={l.x.toFixed(1)}
              y={(l.y + 12).toFixed(1)}
              textAnchor={l.anchor}
              dominantBaseline="middle"
              className="fill-emerald-700"
              style={{ fontSize: 10, fontWeight: 700 }}
            >
              {l.max ? `${l.score}/${l.max}` : `${l.score}%`}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
