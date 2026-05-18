"use client";

import * as React from "react";
import { ShieldCheck, AlertTriangle, AlertOctagon, ChevronDown, Sparkles } from "lucide-react";
import { AUDIT_LABELS, AUDIT_COLORS, PRODUCT } from "@/lib/product-lexicon";
import type { AuditStatus } from "@/lib/product-lexicon";

export interface ForensicCheck {
  label: string;
  status: "ok" | "warn" | "alert" | "info";
  detail?: string;
}

export interface ForensicAuditCardProps {
  auditStatus?: AuditStatus | "CLEAR" | "REVIEW" | "ALERT" | "PENDING";
  integrityScore?: number;
  integrityLabel?: string;
  checks?: ForensicCheck[];
  highlights?: string[];
  alerts?: string[];
  documentsCount?: number;
  certifiedCount?: number;
  reviewCount?: number;
  rejectedCount?: number;
  className?: string;
}

const ICON_BY_STATUS: Record<ForensicCheck["status"], React.ElementType> = {
  ok: ShieldCheck,
  warn: AlertTriangle,
  alert: AlertOctagon,
  info: Sparkles,
};

const COLOR_BY_STATUS: Record<ForensicCheck["status"], string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  alert: "text-red-600",
  info: "text-sky-600",
};

/**
 * Card "Audit Forensic" : score d'intégrité documentaire + liste de vérifications.
 * Effet wow : montrer ce que l'œil humain ne voit pas (logiciel PDF détecté, MRZ validée,
 * cohérence fiscale, etc.).
 */
export function ForensicAuditCard({
  auditStatus = "PENDING",
  integrityScore,
  integrityLabel,
  checks,
  highlights,
  alerts,
  documentsCount,
  certifiedCount,
  reviewCount,
  rejectedCount,
  className = "",
}: ForensicAuditCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const key = (auditStatus || "PENDING") as AuditStatus;
  const auditColors = AUDIT_COLORS[key] || AUDIT_COLORS.PENDING;
  const auditLabel = AUDIT_LABELS[key] || AUDIT_LABELS.PENDING;
  const HeaderIcon = key === "CLEAR" ? ShieldCheck : key === "ALERT" ? AlertOctagon : AlertTriangle;

  // Fallback : construire les checks depuis les highlights/alerts si pas de checks détaillés
  const computedChecks: ForensicCheck[] =
    checks && checks.length > 0
      ? checks
      : [
          ...(highlights || []).map((h) => ({ label: h, status: "ok" as const })),
          ...(alerts || []).map((a) => ({ label: a, status: "warn" as const })),
        ];

  const visibleChecks = expanded ? computedChecks : computedChecks.slice(0, 3);

  return (
    <div className={`rounded-card border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${auditColors.bg}`}>
          <HeaderIcon className={`h-5 w-5 ${auditColors.text}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {PRODUCT.AUDIT}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-serif text-lg font-bold text-slate-900">{auditLabel}</h3>
            {typeof integrityScore === "number" && (
              <span className="text-sm font-semibold text-slate-700">
                Intégrité {Math.round(integrityScore)}/100
              </span>
            )}
          </div>
          {integrityLabel && (
            <p className="mt-1 text-xs text-slate-500">{integrityLabel}</p>
          )}
        </div>
      </div>

      {(documentsCount !== undefined ||
        certifiedCount !== undefined ||
        reviewCount !== undefined ||
        rejectedCount !== undefined) && (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-card bg-slate-50 p-3 text-center">
          <div>
            <div className="text-lg font-bold text-emerald-700">{certifiedCount ?? 0}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Certifiés
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-700">{reviewCount ?? 0}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              À réviser
            </div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-700">{rejectedCount ?? 0}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Rejetés
            </div>
          </div>
        </div>
      )}

      {computedChecks.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {visibleChecks.map((c, i) => {
            const Icon = ICON_BY_STATUS[c.status];
            return (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${COLOR_BY_STATUS[c.status]}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-slate-700">{c.label}</p>
                  {c.detail && <p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {computedChecks.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          {expanded ? "Réduire" : `Voir ${computedChecks.length - 3} vérifications de plus`}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}
