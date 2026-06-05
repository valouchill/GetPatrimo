"use client";

import * as React from "react";
import { getMetalLevel, METAL_LABELS, formatDate } from "@/lib/product-lexicon";

export interface SealCertificateProps {
  score: number;
  sealedAt?: Date | string | null;
  size?: number;
  spinning?: boolean;
  className?: string;
}

/**
 * Cachet rotatif "Certifié getpatrimo" pour le Passeport Locatif public.
 * Effet : SVG circulaire avec texte rotatif autour + Grade central.
 */
export function SealCertificate({
  score,
  sealedAt,
  size = 220,
  spinning = true,
  className = "",
}: SealCertificateProps) {
  // V8.2 — niveau métal (single source of truth)
  const level = getMetalLevel(score);
  const dateStr = sealedAt ? formatDate(sealedAt) : null;

  const cx = size / 2;
  const cy = size / 2;
  const radiusOuter = size * 0.46;
  const radiusInner = size * 0.34;
  const radiusText = size * 0.405;

  // Texte rotatif : on dessine un cercle invisible et on attache un textPath
  const circumference = 2 * Math.PI * radiusText;
  const text = "CERTIFIÉ GETPATRIMO · IDENTITÉ VÉRIFIÉE · AUDIT FORENSIC · ";
  const repeats = Math.max(1, Math.floor(circumference / 200));
  const fullText = Array(repeats).fill(text).join("");

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Cercle rotatif (texte) */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={spinning ? "animate-[spin_28s_linear_infinite]" : ""}
        role="img"
        aria-label={`Cachet de certification getpatrimo ${METAL_LABELS[level]}`}
      >
        <defs>
          <path
            id={`seal-text-path-${size}`}
            d={`M ${cx},${cy} m -${radiusText},0 a ${radiusText},${radiusText} 0 1,1 ${
              2 * radiusText
            },0 a ${radiusText},${radiusText} 0 1,1 -${2 * radiusText},0`}
          />
        </defs>
        {/* Anneau extérieur */}
        <circle
          cx={cx}
          cy={cy}
          r={radiusOuter}
          fill="none"
          stroke="#064E3B"
          strokeWidth={2.5}
        />
        {/* Anneau intérieur (texte) */}
        <circle
          cx={cx}
          cy={cy}
          r={radiusInner}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {/* Texte rotatif */}
        <text fill="#064E3B" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em" }}>
          <textPath href={`#seal-text-path-${size}`} startOffset="0">
            {fullText}
          </textPath>
        </text>
      </svg>

      {/* Centre statique (Grade + date) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-emerald-900/70">
          Patrimo·Trust
        </div>
        {/* V8.2 — score en héro + niveau métal (le mot ne tient pas en 5xl) */}
        <div className="font-serif text-5xl font-black leading-none text-emerald-900">
          {Math.round(score)}
        </div>
        <div className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
          {METAL_LABELS[level]}
        </div>
        {dateStr && (
          <div className="mt-1 text-[9px] text-slate-500">Scellé le {dateStr}</div>
        )}
      </div>
    </div>
  );
}
