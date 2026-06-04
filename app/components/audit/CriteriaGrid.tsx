"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wallet,
  TrendingUp,
  Briefcase,
  Calendar,
  Fingerprint,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { formatPrice } from "@/lib/product-lexicon";

type Status = "excellent" | "ok" | "warn" | "alert" | "unknown";

export interface Criterion {
  id: string;
  label: string;
  value: string;             // valeur affichée (ex: "28%", "1 150 €", "CDI")
  threshold?: string;        // seuil de référence (ex: "≤ 33%", "≥ 800 €")
  verdict: string;           // jugement court (ex: "Conforme", "Limite, garant requis")
  status: Status;
  icon?: React.ElementType;
}

export interface CriteriaGridProps {
  criteria: Criterion[];
  className?: string;
}

const STATUS_STYLES: Record<Status, {
  badge: string;
  icon: string;
  border: string;
  StatusIcon: React.ElementType;
  statusIconColor: string;
  label: string;
}> = {
  excellent: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: "text-emerald-600",
    border: "border-emerald-200",
    StatusIcon: CheckCircle2,
    statusIconColor: "text-emerald-500",
    label: "Excellent",
  },
  ok: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: "text-emerald-600",
    border: "border-slate-200",
    StatusIcon: CheckCircle2,
    statusIconColor: "text-emerald-500",
    label: "Conforme",
  },
  warn: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: "text-amber-600",
    border: "border-amber-200",
    StatusIcon: AlertTriangle,
    statusIconColor: "text-amber-500",
    label: "Vigilance",
  },
  alert: {
    badge: "bg-red-50 text-red-700 ring-red-200",
    icon: "text-red-600",
    border: "border-red-200",
    StatusIcon: AlertOctagon,
    statusIconColor: "text-red-500",
    label: "Bloquant",
  },
  unknown: {
    badge: "bg-slate-100 text-slate-500 ring-slate-200",
    icon: "text-slate-400",
    border: "border-slate-200",
    StatusIcon: AlertTriangle,
    statusIconColor: "text-slate-400",
    label: "À vérifier",
  },
};

/**
 * Grille de critères objectifs alignés sur les standards FR de sélection locataire.
 * Chaque critère affiche : icône, label, valeur, seuil, verdict et statut.
 */
export function CriteriaGrid({ criteria, className = "" }: CriteriaGridProps) {
  if (!criteria || criteria.length === 0) return null;

  return (
    <div className={`rounded-card border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <FileCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Critères d&apos;évaluation
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {criteria.map((c) => {
          const s = STATUS_STYLES[c.status];
          const Icon = c.icon || FileCheck;
          const StatusIcon = s.StatusIcon;
          return (
            <div
              key={c.id}
              className={`relative rounded-card border ${s.border} bg-white px-4 py-3.5`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-slate-50 ${s.icon}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {c.label}
                    </p>
                    <StatusIcon
                      className={`h-4 w-4 shrink-0 ${s.statusIconColor}`}
                      aria-label={s.label}
                    />
                  </div>
                  <p className="mt-1 font-serif text-base font-bold text-slate-900">
                    {c.value}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.threshold ? `Seuil : ${c.threshold} · ` : ""}
                    <span className={c.status === "alert" ? "font-semibold text-red-700" : c.status === "warn" ? "font-semibold text-amber-700" : "text-slate-600"}>
                      {c.verdict}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Helper : dérive les critères standards d'un LocalDossier.
 * Les seuils sont alignés sur le scoringService V3 :
 *  - Taux d'effort ≤ 33% (standard FR strict)
 *  - Reste-à-vivre ≥ 800€ (province) / 1000€ (zones tendues — à venir)
 *  - Ratio revenus/loyer ≥ 3×
 *  - Stabilité CDI/fonctionnaire/retraité > limites
 *  - Garantie Visale ou physique 3× loyer
 */
export function deriveCriteriaFromDossier(c: {
  revenus: number;
  loyer: number;
  effortRate?: number | null;
  remainingIncome?: number | null;
  contrat?: string;
  guaranteeMode?: "NONE" | "VISALE" | "PHYSICAL";
  garantie?: string;
  identityVerified?: boolean;
  auditStatus?: string;
}): Criterion[] {
  const result: Criterion[] = [];

  // 1) Taux d'effort
  const effortRate = c.effortRate !== null && c.effortRate !== undefined && c.effortRate > 0
    ? c.effortRate
    : c.loyer > 0 && c.revenus > 0
    ? c.loyer / c.revenus
    : 0;
  const effortPct = effortRate > 0 ? effortRate * 100 : 0;
  let effortStatus: Status = "unknown";
  let effortVerdict = "Non calculé";
  if (effortRate > 0) {
    if (effortRate <= 0.28) {
      effortStatus = "excellent";
      effortVerdict = "Excellent (≤ 28%)";
    } else if (effortRate <= 0.33) {
      effortStatus = "ok";
      effortVerdict = "Conforme (≤ 33%)";
    } else if (effortRate <= 0.38) {
      effortStatus = "warn";
      effortVerdict = "Limite — garant recommandé";
    } else if (effortRate <= 0.45) {
      effortStatus = "alert";
      effortVerdict = "Insuffisant";
    } else {
      effortStatus = "alert";
      effortVerdict = "Bloquant (> 45%)";
    }
  }
  result.push({
    id: "effort-rate",
    label: "Taux d'effort",
    value: effortPct > 0 ? `${effortPct.toFixed(1)}%` : "—",
    threshold: "≤ 33%",
    verdict: effortVerdict,
    status: effortStatus,
    icon: TrendingUp,
  });

  // 2) Reste-à-vivre
  const remaining = c.remainingIncome !== null && c.remainingIncome !== undefined
    ? c.remainingIncome
    : c.revenus > 0 && c.loyer > 0
    ? c.revenus - c.loyer - Math.max(50, c.loyer * 0.1)
    : 0;
  let remainStatus: Status = "unknown";
  let remainVerdict = "Non calculé";
  if (remaining > 0) {
    if (remaining >= 1500) {
      remainStatus = "excellent";
      remainVerdict = "Confort financier élevé";
    } else if (remaining >= 1000) {
      remainStatus = "ok";
      remainVerdict = "Marge confortable";
    } else if (remaining >= 800) {
      remainStatus = "ok";
      remainVerdict = "Standard (≥ 800 €)";
    } else if (remaining >= 600) {
      remainStatus = "warn";
      remainVerdict = "Marge tendue";
    } else {
      remainStatus = "alert";
      remainVerdict = "Critique (< 600 €)";
    }
  }
  result.push({
    id: "remaining-income",
    label: "Reste-à-vivre",
    value: remaining > 0 ? formatPrice(remaining) : "—",
    threshold: "≥ 800 €",
    verdict: remainVerdict,
    status: remainStatus,
    icon: Wallet,
  });

  // 3) Ratio revenus / loyer
  const ratio = c.loyer > 0 ? c.revenus / c.loyer : 0;
  let ratioStatus: Status = "unknown";
  let ratioVerdict = "Non calculé";
  if (ratio > 0) {
    if (ratio >= 4) {
      ratioStatus = "excellent";
      ratioVerdict = "Très solide";
    } else if (ratio >= 3) {
      ratioStatus = "ok";
      ratioVerdict = "Standard FR (≥ 3×)";
    } else if (ratio >= 2.5) {
      ratioStatus = "warn";
      ratioVerdict = "Limite — garant requis";
    } else {
      ratioStatus = "alert";
      ratioVerdict = "Insuffisant (< 2.5×)";
    }
  }
  result.push({
    id: "income-ratio",
    label: "Revenus / loyer",
    value: ratio > 0 ? `${ratio.toFixed(1)}×` : "—",
    threshold: "≥ 3×",
    verdict: ratioVerdict,
    status: ratioStatus,
    icon: TrendingUp,
  });

  // 4) Stabilité emploi
  const contractType = String(c.contrat || "").toUpperCase();
  let stabilityStatus: Status = "unknown";
  let stabilityVerdict = "Non renseigné";
  if (contractType === "CDI" || contractType.includes("FONCTIONNAIRE") || contractType.includes("PUBLIC")) {
    stabilityStatus = "excellent";
    stabilityVerdict = "Contrat pérenne";
  } else if (contractType === "CDD") {
    stabilityStatus = "warn";
    stabilityVerdict = "Garant recommandé";
  } else if (contractType.includes("FREELANCE") || contractType.includes("INDEPENDANT") || contractType.includes("AUTO")) {
    stabilityStatus = "warn";
    stabilityVerdict = "Indépendant — garant recommandé";
  } else if (contractType.includes("ETUDIANT") || contractType.includes("STUDENT") || contractType.includes("ÉTUDIANT")) {
    stabilityStatus = "warn";
    stabilityVerdict = "Étudiant — garant attendu";
  } else if (contractType.includes("RETRAIT")) {
    stabilityStatus = "excellent";
    stabilityVerdict = "Revenus pérennes";
  } else if (contractType && contractType !== "N/A") {
    stabilityStatus = "warn";
    stabilityVerdict = "À examiner";
  }
  result.push({
    id: "employment",
    label: "Stabilité emploi",
    value: contractType && contractType !== "N/A" ? contractType : "—",
    threshold: "CDI ou public",
    verdict: stabilityVerdict,
    status: stabilityStatus,
    icon: Briefcase,
  });

  // 5) Identité vérifiée
  const identityVerified = c.identityVerified === true;
  result.push({
    id: "identity",
    label: "Identité",
    value: identityVerified ? "Vérifiée" : "Non vérifiée",
    threshold: "Didit / CNI",
    verdict: identityVerified ? "Identité Didit confirmée" : "Vérification requise",
    status: identityVerified ? "excellent" : "warn",
    icon: Fingerprint,
  });

  // 6) Garantie
  const gm = String(c.guaranteeMode || "NONE").toUpperCase();
  let guaranteeStatus: Status = "unknown";
  let guaranteeVerdict = "";
  let guaranteeValue = "";
  if (gm === "VISALE") {
    guaranteeStatus = "excellent";
    guaranteeValue = "Visale";
    guaranteeVerdict = "Couverture totale 36 mois";
  } else if (gm === "PHYSICAL") {
    guaranteeStatus = "ok";
    guaranteeValue = "Garant physique";
    guaranteeVerdict = "Vérifier solvabilité 3× loyer";
  } else if (gm === "BANK_DEPOSIT" || gm === "CAUTION_BANCAIRE") {
    guaranteeStatus = "excellent";
    guaranteeValue = "Caution bancaire";
    guaranteeVerdict = "Garantie solide";
  } else {
    guaranteeStatus = "alert";
    guaranteeValue = "Aucune";
    guaranteeVerdict = "Visale fortement recommandée";
  }
  result.push({
    id: "guarantee",
    label: "Garantie",
    value: c.garantie || guaranteeValue,
    threshold: "Visale / Garant 3×",
    verdict: guaranteeVerdict,
    status: guaranteeStatus,
    icon: ShieldCheck,
  });

  return result;
}
