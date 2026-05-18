"use client";

import * as React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { formatPrice } from "@/lib/product-lexicon";

export interface RemainingIncomeChartProps {
  monthlyIncome: number;
  monthlyRent: number;
  essentialExpenses?: number;
  remainingThreshold?: number; // seuil critique
  className?: string;
}

/**
 * Stacked bar horizontale : Revenu = Loyer + Charges essentielles + Reste-à-vivre.
 * Couleur du reste-à-vivre selon seuil :
 *   - emerald si ≥ threshold (par défaut 800€)
 *   - amber si 600-threshold
 *   - red si < 600€
 */
export function RemainingIncomeChart({
  monthlyIncome,
  monthlyRent,
  essentialExpenses,
  remainingThreshold = 800,
  className = "",
}: RemainingIncomeChartProps) {
  if (monthlyIncome <= 0) return null;

  // Si essentialExpenses non fourni, on estime 30% du revenu pour les dépenses essentielles
  const expenses = essentialExpenses ?? Math.max(0, Math.round(monthlyIncome * 0.3));
  const remaining = Math.max(0, monthlyIncome - monthlyRent - expenses);

  const rentPct = (monthlyRent / monthlyIncome) * 100;
  const expensesPct = (expenses / monthlyIncome) * 100;
  const remainingPct = Math.max(0, 100 - rentPct - expensesPct);

  const remainingTone: "ok" | "warn" | "alert" =
    remaining >= remainingThreshold ? "ok" : remaining >= 600 ? "warn" : "alert";

  const remainingColor =
    remainingTone === "ok"
      ? { fill: "bg-emerald-500", text: "text-emerald-700", icon: ShieldCheck }
      : remainingTone === "warn"
      ? { fill: "bg-amber-500", text: "text-amber-700", icon: AlertTriangle }
      : { fill: "bg-red-500", text: "text-red-700", icon: AlertTriangle };

  const Icon = remainingColor.icon;

  return (
    <div className={`rounded-card border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Sécurité financière
          </p>
          <h3 className="mt-1 font-serif text-lg font-bold text-slate-900">
            Reste-à-vivre
          </h3>
        </div>
        <div className="text-right">
          <div className={`font-serif text-2xl font-bold ${remainingColor.text}`}>
            {formatPrice(remaining)}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            par mois
          </div>
        </div>
      </div>

      {/* Stacked bar */}
      <div
        className="flex h-9 w-full overflow-hidden rounded-pill ring-1 ring-slate-200"
        role="img"
        aria-label={`Revenu ${formatPrice(monthlyIncome)} = Loyer ${formatPrice(monthlyRent)} + Charges ${formatPrice(expenses)} + Reste ${formatPrice(remaining)}`}
      >
        <div
          className="h-full bg-slate-700 transition-all"
          style={{ width: `${rentPct.toFixed(1)}%` }}
        />
        <div
          className="h-full bg-slate-400 transition-all"
          style={{ width: `${expensesPct.toFixed(1)}%` }}
        />
        <div
          className={`h-full ${remainingColor.fill} transition-all`}
          style={{ width: `${remainingPct.toFixed(1)}%` }}
        />
      </div>

      {/* Légende */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-700" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Loyer</span>
          </div>
          <div className="text-sm font-semibold text-slate-900">{formatPrice(monthlyRent)}</div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Charges</span>
          </div>
          <div className="text-sm font-semibold text-slate-900">{formatPrice(expenses)}</div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${remainingColor.fill}`} aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reste</span>
          </div>
          <div className={`text-sm font-semibold ${remainingColor.text}`}>
            {formatPrice(remaining)}
          </div>
        </div>
      </div>

      {/* Alerte si reste critique */}
      {remainingTone !== "ok" && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-card px-3 py-2 text-xs ${
            remainingTone === "alert" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            {remainingTone === "alert"
              ? `Reste-à-vivre faible (${formatPrice(remaining)}). Risque d'impayé. Recommandation : exiger un garant solide ou Visale.`
              : `Reste-à-vivre modéré (${formatPrice(remaining)}). Tolérable avec garantie ou caution.`}
          </p>
        </div>
      )}
    </div>
  );
}
