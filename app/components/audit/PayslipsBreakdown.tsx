"use client";

import * as React from "react";
import { FileText, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { formatPrice } from "@/lib/product-lexicon";

export interface PayslipBreakdownItem {
  amount: number;
  period?: string | null;
  date?: string | null;
  status?: string;
  source?: string | null;
  confidence?: number | null;
}

export interface PayslipsBreakdownProps {
  breakdown: PayslipBreakdownItem[];
  mean?: number | null;
  median?: number | null;
  stdDev?: number | null;
  method?: "mean" | "median" | "none" | null;
  varianceRatio?: number | null;
  varianceHigh?: boolean;
  className?: string;
}

const STATUS_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  CERTIFIED: { label: "Certifié", bg: "bg-emerald-50", text: "text-emerald-700" },
  REVIEW: { label: "À réviser", bg: "bg-amber-50", text: "text-amber-700" },
  NEEDS_REVIEW: { label: "À réviser", bg: "bg-amber-50", text: "text-amber-700" },
  PENDING: { label: "En attente", bg: "bg-slate-100", text: "text-slate-600" },
  FLAGGED: { label: "Vigilance", bg: "bg-amber-50", text: "text-amber-700" },
  REJECTED: { label: "Rejeté", bg: "bg-red-50", text: "text-red-700" },
  ILLEGIBLE: { label: "Illisible", bg: "bg-slate-100", text: "text-slate-600" },
};

const SOURCE_TOOLTIPS: Record<string, string> = {
  "financial_data.monthly_net_income": "Net extrait directement par l'IA",
  "extractedData.salaireNet": "Net extrait (champ legacy)",
  gross_minus_deductions: "Net dérivé du brut moins cotisations",
  "extractedData.montants": "Montant retenu parmi les valeurs détectées",
  ai_direct: "Net extrait directement par l'IA",
  ai_gross_minus_deductions: "Net dérivé du brut",
};

function statusStyle(status?: string) {
  const key = String(status || "PENDING").toUpperCase();
  return STATUS_STYLES[key] || STATUS_STYLES.PENDING;
}

function formatDate(d?: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Affiche le détail des bulletins de paie analysés avec moyenne, médiane et alerte de variance.
 * Visible côté propriétaire pour transparence sur le calcul du revenu net.
 */
export function PayslipsBreakdown({
  breakdown,
  mean,
  median,
  stdDev,
  method,
  varianceRatio,
  varianceHigh = false,
  className = "",
}: PayslipsBreakdownProps) {
  if (!breakdown || breakdown.length === 0) return null;

  const variancePct = typeof varianceRatio === "number" ? Math.round(varianceRatio * 1000) / 10 : null;
  const primaryAmount = method === "median" ? median : mean;

  return (
    <div className={`rounded-card border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-600" aria-hidden="true" />
          <h3 className="font-serif text-base font-bold text-slate-900">
            Bulletins de paie analysés
          </h3>
        </div>
        <span className="rounded-pill bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {breakdown.length} bulletin{breakdown.length > 1 ? "s" : ""}
        </span>
      </header>

      {/* Liste des bulletins */}
      <ul className="divide-y divide-slate-100 rounded-card border border-slate-100 bg-slate-50/40">
        {breakdown.map((item, i) => {
          const s = statusStyle(item.status);
          const sourceLabel = item.source ? SOURCE_TOOLTIPS[item.source] || item.source : null;
          const derived = item.source && /gross|montants/i.test(item.source);
          const dateLabel = item.period || formatDate(item.date) || `Bulletin #${i + 1}`;
          return (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-white shadow-card">
                <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-slate-900">{dateLabel}</span>
                  <span className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                </div>
                {sourceLabel && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                    {derived ? (
                      <Info className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                    )}
                    <span title={sourceLabel}>{sourceLabel}</span>
                    {typeof item.confidence === "number" && (
                      <span className="ml-1 text-slate-400">
                        · confiance {Math.round(item.confidence * 100)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-serif text-base font-bold text-emerald-700">
                  {formatPrice(item.amount)}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  net mensuel
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer : moyenne / médiane */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {typeof mean === "number" && mean > 0 && (
          <div
            className={`rounded-card border px-3 py-2.5 ${
              method === "mean" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Moyenne
              {method === "mean" && (
                <span className="ml-1 text-emerald-600">· retenue</span>
              )}
            </div>
            <div className="mt-0.5 font-serif text-base font-bold text-slate-900">
              {formatPrice(mean)}
            </div>
          </div>
        )}
        {typeof median === "number" && median > 0 && (
          <div
            className={`rounded-card border px-3 py-2.5 ${
              method === "median" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Médiane
              {method === "median" && (
                <span className="ml-1 text-emerald-600">· retenue</span>
              )}
            </div>
            <div className="mt-0.5 font-serif text-base font-bold text-slate-900">
              {formatPrice(median)}
            </div>
          </div>
        )}
        {typeof stdDev === "number" && stdDev > 0 && (
          <div className="rounded-card border border-slate-200 bg-white px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Écart-type
            </div>
            <div className="mt-0.5 font-serif text-base font-bold text-slate-900">
              ± {formatPrice(stdDev)}
            </div>
          </div>
        )}
      </div>

      {/* Alerte variance */}
      {varianceHigh && (
        <div className="mt-3 flex items-start gap-2 rounded-card bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            Variance élevée entre bulletins
            {variancePct != null ? ` (${variancePct.toFixed(1)}%)` : ""} —
            la <strong>médiane</strong> est utilisée pour le calcul. Revenus possiblement
            instables (prime, rappel ou changement de poste).
          </p>
        </div>
      )}

      {typeof primaryAmount === "number" && primaryAmount > 0 && (
        <p className="mt-3 text-[11px] text-slate-500">
          Revenu retenu pour l&apos;évaluation : <strong className="text-slate-700">{formatPrice(primaryAmount)}/mois</strong>
          {method === "median" ? " (médiane)" : " (moyenne)"}.
        </p>
      )}
    </div>
  );
}
