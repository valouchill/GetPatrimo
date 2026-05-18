"use client";

import * as React from "react";
import { Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";

export interface AIReasoningCardProps {
  strengths?: string[];
  watchouts?: string[];
  insight?: string;
  className?: string;
}

/**
 * Card explainability : Points forts vs Points de vigilance en side-by-side.
 * Optionnellement un encart "Verdict IA" pour la synthèse.
 */
export function AIReasoningCard({
  strengths,
  watchouts,
  insight,
  className = "",
}: AIReasoningCardProps) {
  const hasStrengths = strengths && strengths.length > 0;
  const hasWatchouts = watchouts && watchouts.length > 0;

  if (!hasStrengths && !hasWatchouts && !insight) return null;

  return (
    <div className={`rounded-card border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Analyse IA — Forces & vigilance
        </p>
      </div>

      {insight && (
        <p className="mb-4 rounded-card bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          {insight}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {hasStrengths && (
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Points forts ({strengths!.length})
            </h4>
            <ul className="space-y-2">
              {strengths!.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasWatchouts && (
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Points de vigilance ({watchouts!.length})
            </h4>
            <ul className="space-y-2">
              {watchouts!.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    aria-hidden="true"
                  />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
