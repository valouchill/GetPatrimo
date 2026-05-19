"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, AlertTriangle, AlertOctagon, Sparkles } from "lucide-react";
import { Avatar, GradeBadge } from "./ui";
import type { LocalDossier, LocalBien } from "./ui";
import {
  ResilienceGauge,
  CertificationRow,
  verdictFromScore,
} from "@/app/components/audit";
import { PRODUCT, formatPrice, GRADE_LABELS, getGrade } from "@/lib/product-lexicon";
import { labelForReason } from "@/lib/verdict-reasons";

export interface TopCandidateCardProps {
  rank: 1 | 2 | 3;
  candidate: LocalDossier;
  bien?: LocalBien;
  onOpenAudit: (c: LocalDossier) => void;
  className?: string;
}

const VERDICT_STYLES = {
  recommended: {
    icon: ShieldCheck,
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-700",
    label: "Recommandé",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeRing: "ring-emerald-200",
  },
  review: {
    icon: AlertTriangle,
    iconBg: "bg-amber-50",
    iconText: "text-amber-700",
    label: "À vérifier",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeRing: "ring-amber-200",
  },
  risky: {
    icon: AlertOctagon,
    iconBg: "bg-red-50",
    iconText: "text-red-700",
    label: "Risqué",
    badgeBg: "bg-red-50",
    badgeText: "text-red-700",
    badgeRing: "ring-red-200",
  },
} as const;

export function TopCandidateCard({
  rank,
  candidate: c,
  bien,
  onOpenAudit,
  className = "",
}: TopCandidateCardProps) {
  const verdict = c.verdict || verdictFromScore(c.score, c.auditStatus);
  const v = VERDICT_STYLES[verdict];
  const Icon = v.icon;
  const grade = getGrade(c.score);
  const ratio = bien && bien.loyer > 0 ? c.revenus / bien.loyer : 0;

  // Première raison saillante à afficher
  const firstReason = c.reasonCodes && c.reasonCodes.length > 0
    ? labelForReason(c.reasonCodes[0])
    : (c.decisionHeadline || c.auditSummary || "");

  // Bordure selon rang (et override si risky)
  const borderClass = verdict === "risky"
    ? "border-red-200 shadow-card"
    : rank === 1
    ? "border-emerald-300 shadow-emerald"
    : "border-slate-200 shadow-card";

  const rankBadge = rank === 1
    ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white"
    : rank === 2
    ? "bg-slate-700 text-white"
    : "bg-slate-400 text-white";

  return (
    <motion.button
      type="button"
      onClick={() => onOpenAudit(c)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (rank - 1) * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={[
        "group relative flex flex-col gap-4 overflow-hidden rounded-card border bg-white p-5 text-left transition-shadow hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2",
        borderClass,
        className,
      ].join(" ")}
    >
      {/* Rank badge + Grade */}
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-serif text-xs font-bold ${rankBadge}`}>
          #{rank}
        </span>
        <div className="flex items-center gap-1.5">
          <GradeBadge score={c.score} size="sm" />
          {c.isTop3 && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Top
            </span>
          )}
        </div>
      </div>

      {/* Candidat info */}
      <div className="flex items-center gap-3">
        <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-base font-bold text-slate-900">
            {c.prenom} {c.nom}
          </div>
          <p className="truncate text-xs text-slate-500">
            {c.contrat}{bien ? ` · ${bien.label}` : ""}
          </p>
        </div>
      </div>

      {/* Gauge centrée */}
      <div className="flex items-center justify-center -my-2">
        <ResilienceGauge score={c.score} size="sm" />
      </div>

      {/* Verdict line */}
      <div className={`inline-flex items-start gap-2 rounded-card px-3 py-2 ${v.badgeBg} ring-1 ${v.badgeRing}`}>
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${v.iconText}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold ${v.badgeText}`}>
            {c.verdictLabel || v.label}
            {grade ? ` · ${GRADE_LABELS[grade].split(' — ')[1] || ''}` : ""}
          </p>
          {firstReason && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
              {firstReason}
            </p>
          )}
        </div>
      </div>

      {/* Métrique financière clé */}
      {c.revenus > 0 && (
        <div className="flex items-baseline justify-between text-sm">
          <div>
            <span className="font-serif text-base font-bold text-emerald-700">
              {formatPrice(c.revenus)}
            </span>
            <span className="text-[11px] text-slate-500"> nets/mois</span>
          </div>
          {ratio > 0 && (
            <span className={`text-xs font-semibold ${
              ratio >= 3 ? "text-emerald-700" : ratio >= 2 ? "text-amber-700" : "text-red-700"
            }`}>
              {ratio.toFixed(1)}× loyer
            </span>
          )}
        </div>
      )}

      {/* Certifications compactes */}
      <CertificationRow
        badges={[
          { type: "identity", label: "Identité", verified: c.identityVerified === true },
          { type: "forensic", label: PRODUCT.AUDIT, verified: c.auditStatus === "CLEAR" },
          {
            type: "guarantee",
            label: c.guaranteeMode === "VISALE" ? "Visale" : c.guaranteeMode === "PHYSICAL" ? "Garant" : "Aucune",
            verified: ["VISALE", "PHYSICAL"].includes(String(c.guaranteeMode || "")),
          },
        ]}
      />

      {/* CTA footer */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
        <span className="text-xs font-semibold text-slate-500">Voir le dossier</span>
        <ArrowRight className="h-4 w-4 text-amber-600 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </motion.button>
  );
}
