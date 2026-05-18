"use client";

import * as React from "react";
import { Check, ShieldCheck, Fingerprint, Receipt, Wallet, FileCheck } from "lucide-react";

type CertType =
  | "identity"
  | "income"
  | "solvent"
  | "forensic"
  | "guarantee"
  | "ready"
  | "custom";

export interface CertificationBadgeProps {
  type?: CertType;
  label: string;
  verified?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const TYPE_ICONS: Record<Exclude<CertType, "custom">, React.ElementType> = {
  identity: Fingerprint,
  income: Receipt,
  solvent: Wallet,
  forensic: ShieldCheck,
  guarantee: FileCheck,
  ready: Check,
};

/**
 * Badge inline pour signaler une vérification (Identité Didit, Revenus certifiés, etc.).
 * Vert si vérifié, neutre sinon.
 */
export function CertificationBadge({
  type = "custom",
  label,
  verified = true,
  icon,
  className = "",
}: CertificationBadgeProps) {
  const resolvedIcon =
    icon ??
    (type !== "custom" && TYPE_ICONS[type]
      ? React.createElement(TYPE_ICONS[type], { className: "h-3.5 w-3.5" })
      : null);

  const cls = verified
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-slate-100 text-slate-500 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ring-1 ${cls} ${className}`}
    >
      {resolvedIcon && <span className="shrink-0">{resolvedIcon}</span>}
      {verified && !resolvedIcon && <Check className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </span>
  );
}

/**
 * Rangée de badges de certifications — pratique pour le hero d'audit.
 */
export function CertificationRow({
  badges,
  className = "",
}: {
  badges: Array<Omit<CertificationBadgeProps, "className">>;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((b, i) => (
        <CertificationBadge key={`${b.type ?? "c"}-${i}`} {...b} />
      ))}
    </div>
  );
}
