"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { getGrade, GRADE_SHORT, GRADE_COLORS, formatResilience } from "@/lib/product-lexicon";

const PatrimoTrustGauge = dynamic(() => import("@/app/components/PatrimoTrustGauge"), { ssr: false });

export interface ResilienceGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

/**
 * Wrapper de PatrimoTrustGauge avec lexique produit V1 (Grade S, Indice de Résilience).
 * Affiche la jauge semi-circulaire + label Grade en dessous.
 */
export function ResilienceGauge({
  score,
  size = "md",
  showLabel = true,
  className = "",
}: ResilienceGaugeProps) {
  const grade = getGrade(score);
  const colors = GRADE_COLORS[grade];
  const scale = size === "sm" ? "scale-75" : size === "lg" ? "scale-110" : "scale-100";

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`origin-center ${scale}`}>
        <PatrimoTrustGauge score={Math.round(score)} />
      </div>
      {showLabel && (
        <div className={`-mt-4 inline-flex items-center gap-2 rounded-pill px-3 py-1 ring-1 ${colors.bg} ${colors.text} ${colors.ring}`}>
          <span className="font-serif text-sm font-bold tracking-tight">{GRADE_SHORT[grade]}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
            {formatResilience(score)}
          </span>
        </div>
      )}
    </div>
  );
}
