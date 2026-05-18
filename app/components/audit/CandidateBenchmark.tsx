"use client";

import * as React from "react";
import { TrendingUp, Award } from "lucide-react";

export interface CandidateBenchmarkProps {
  score: number;            // Indice de Résilience 0-100
  rank?: number;            // Rang dans la propriété
  totalCandidates?: number; // Total candidats reçus pour ce bien
  percentile?: number;      // optionnel — sinon dérivé du score
  className?: string;
}

/**
 * Bande horizontale "Top X% des candidats reçus".
 * Affiche une distribution avec un marqueur positionné au score.
 */
export function CandidateBenchmark({
  score,
  rank,
  totalCandidates,
  percentile,
  className = "",
}: CandidateBenchmarkProps) {
  // Si pas de percentile fourni, on déduit du score (estimation : score 90 = top 10%, etc.)
  const computedPercentile = percentile ?? Math.max(1, Math.min(99, 100 - score));
  const positionPct = Math.max(2, Math.min(98, score));

  const tone =
    computedPercentile <= 20
      ? { bg: "bg-emerald-50", text: "text-emerald-700", marker: "bg-emerald-600" }
      : computedPercentile <= 50
      ? { bg: "bg-amber-50", text: "text-amber-700", marker: "bg-amber-600" }
      : { bg: "bg-slate-50", text: "text-slate-600", marker: "bg-slate-500" };

  return (
    <div className={`rounded-card border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${tone.bg}`}>
          <Award className={`h-5 w-5 ${tone.text}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Position relative
          </p>
          <h3 className="mt-1 font-serif text-lg font-bold text-slate-900">
            Top {computedPercentile}% des candidats reçus
          </h3>
          {rank && totalCandidates && totalCandidates > 1 && (
            <p className="mt-1 text-xs text-slate-500">
              Rang #{rank} / {totalCandidates} dossiers reçus sur ce bien
            </p>
          )}
        </div>
      </div>

      {/* Barre distribution */}
      <div className="mt-4">
        <div className="relative h-2 rounded-pill bg-gradient-to-r from-red-200 via-amber-200 to-emerald-300">
          <div
            className={`absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white ring-2 ring-slate-200 ${tone.marker} shadow-card`}
            style={{ left: `${positionPct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Risqué</span>
          <span>Solide</span>
          <span>Exceptionnel</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <TrendingUp className="h-3 w-3 text-emerald-600" aria-hidden="true" />
        Indice {Math.round(score)}% — comparé aux profils analysés par notre IA.
      </div>
    </div>
  );
}
