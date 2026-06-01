"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  getMetalLevel,
  METAL_LABELS,
  METAL_BADGE_CLASS,
  formatResilience,
} from "@/lib/product-lexicon";

const PatrimoTrustGauge = dynamic(() => import("@/app/components/PatrimoTrustGauge"), { ssr: false });

export interface ResilienceGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

/**
 * Wrapper de PatrimoTrustGauge — jauge V2 (niveau métal : PLATINUM/GOLD/
 * SILVER/ALERTE). Affiche la jauge semi-circulaire + badge niveau en dessous.
 */
export function ResilienceGauge({
  score,
  size = "md",
  showLabel = true,
  className = "",
}: ResilienceGaugeProps) {
  // V8.2 — Single source of truth : niveau métal dérivé du score (≥90/75/50)
  const level = getMetalLevel(score);
  const scale = size === "sm" ? "scale-75" : size === "lg" ? "scale-110" : "scale-100";

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`origin-center ${scale}`}>
        <PatrimoTrustGauge score={Math.round(score)} />
      </div>
      {showLabel && (
        <div className={`-mt-4 inline-flex items-center gap-2 rounded-pill px-3 py-1 ring-1 ${METAL_BADGE_CLASS[level]}`}>
          {level === "PLATINUM" && <span aria-hidden="true">★</span>}
          <span className="font-serif text-sm font-bold tracking-tight">{METAL_LABELS[level]}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
            {formatResilience(score)}
          </span>
        </div>
      )}
    </div>
  );
}
