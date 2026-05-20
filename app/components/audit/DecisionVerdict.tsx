"use client";

import * as React from "react";
import { ShieldCheck, AlertTriangle, AlertOctagon } from "lucide-react";
import { Button } from "@/app/components/ui";
import { labelForReason } from "@/lib/verdict-reasons";
import { verdictFromScore as verdictFromScoreShared, type ServerVerdict } from "@/lib/verdict-system";

type Verdict = ServerVerdict;

export interface DecisionVerdictProps {
  verdict: Verdict;
  headline?: string;
  summary?: string;
  reasonCodes?: string[];
  primaryActionLabel?: string;
  onPrimary?: () => void;
  secondaryActionLabel?: string;
  onSecondary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  className?: string;
}

const VARIANTS: Record<
  Verdict,
  {
    icon: React.ElementType;
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    label: string;
    accent: string;
  }
> = {
  recommended: {
    icon: ShieldCheck,
    bg: "bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40",
    border: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    label: "Recommandé",
    accent: "text-emerald-700",
  },
  review: {
    icon: AlertTriangle,
    bg: "bg-gradient-to-br from-amber-50 via-white to-amber-50/40",
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    label: "À vérifier",
    accent: "text-amber-700",
  },
  risky: {
    icon: AlertOctagon,
    bg: "bg-gradient-to-br from-red-50 via-white to-red-50/40",
    border: "border-red-200",
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
    label: "Risqué",
    accent: "text-red-700",
  },
};

/**
 * Verdict d'audit affiché en hero de la page audit candidat et du drawer.
 * Combine icône, niveau (Recommandé / À vérifier / Risqué), résumé IA et CTA.
 */
export function DecisionVerdict({
  verdict,
  headline,
  summary,
  reasonCodes,
  primaryActionLabel = "Choisir ce candidat",
  onPrimary,
  secondaryActionLabel,
  onSecondary,
  primaryDisabled,
  primaryLoading,
  className = "",
}: DecisionVerdictProps) {
  const v = VARIANTS[verdict];
  const Icon = v.icon;

  return (
    <div className={`rounded-card border ${v.border} ${v.bg} p-5 md:p-6 ${className}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-card ${v.iconBg}`}>
          <Icon className={`h-7 w-7 ${v.iconColor}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${v.accent}`}>
            Verdict d'audit
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {v.label} {headline ? `· ${headline}` : ""}
          </h2>
          {summary && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              {summary}
            </p>
          )}
          {reasonCodes && reasonCodes.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {reasonCodes.map((code) => (
                <li key={code} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700 sm:text-sm">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      verdict === "risky"
                        ? "bg-red-500"
                        : verdict === "review"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{labelForReason(code)}</span>
                </li>
              ))}
            </ul>
          )}
          {(onPrimary || onSecondary) && (
            <div className="mt-5 flex flex-wrap gap-2.5">
              {onPrimary && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={onPrimary}
                  disabled={primaryDisabled}
                  loading={primaryLoading}
                >
                  {primaryActionLabel}
                </Button>
              )}
              {onSecondary && secondaryActionLabel && (
                <Button variant="outline" size="md" onClick={onSecondary}>
                  {secondaryActionLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper : dérive le verdict d'un score d'Indice de Résilience + statut audit.
 *
 * Note V4.1 : la logique est désormais centralisée dans lib/verdict-system.ts.
 * Cette fonction reste exportée pour rétrocompat (~5 imports existants).
 */
export const verdictFromScore = verdictFromScoreShared;
