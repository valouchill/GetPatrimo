/**
 * getpatrimo — Verdict System (source unique de vérité UI)
 *
 * Ce module centralise toute la logique d'affichage du verdict propriétaire :
 *  - VERDICT_STYLES : tokens visuels (icon, couleurs, label) par verdict
 *  - resolveVerdict : helper unique qui consomme le verdict serveur OU
 *    dérive un fallback depuis le score (compatibilité dossiers anciens)
 *
 * Le verdict est calculé côté serveur dans :
 *   /opt/doc2loc/src/utils/ownerApplicationInsights.js (computeOwnerVerdict)
 * Les composants UI (TopCandidateCard, DecisionVerdict, CandidateAuditModal,
 * CandidateDetailDrawer, SelectionConfirmModal, VerdictBadge…) consomment ce
 * fichier au lieu de redéfinir leurs propres styles.
 *
 * Note de migration : `verdict-reasons.ts` reste un re-export léger pour
 * éviter les breaking changes sur les imports `labelForReason`.
 */

import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ServerVerdict = 'recommended' | 'review' | 'risky';

export interface VerdictStyle {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tailwind classes for icon background */
  iconBg: string;
  /** Tailwind classes for icon foreground */
  iconText: string;
  /** Human-readable French label */
  label: string;
  /** Tailwind classes for badge background */
  badgeBg: string;
  /** Tailwind classes for badge text */
  badgeText: string;
  /** Tailwind classes for badge ring/border */
  badgeRing: string;
  /** Tailwind gradient for hero/premium usage */
  gradient: string;
}

// ─── Verdict styles (single source of truth) ─────────────────────────────────

export const VERDICT_STYLES: Record<ServerVerdict, VerdictStyle> = {
  recommended: {
    icon: ShieldCheck,
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-700',
    label: 'Recommandé',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeRing: 'ring-emerald-200',
    gradient: 'from-emerald-50 via-white to-white',
  },
  review: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-700',
    label: 'À vérifier',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeRing: 'ring-amber-200',
    gradient: 'from-amber-50 via-white to-white',
  },
  risky: {
    icon: AlertOctagon,
    iconBg: 'bg-red-50',
    iconText: 'text-red-700',
    label: 'Risqué',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
    badgeRing: 'ring-red-200',
    gradient: 'from-red-50 via-white to-white',
  },
} as const;

// ─── Verdict labels (re-export pour cohérence) ───────────────────────────────

export const VERDICT_LABELS: Record<ServerVerdict, string> = {
  recommended: VERDICT_STYLES.recommended.label,
  review: VERDICT_STYLES.review.label,
  risky: VERDICT_STYLES.risky.label,
} as const;

// ─── Fallback depuis le score (dossiers anciens / verdict non calculé) ───────

/**
 * Dérive un verdict depuis le score et le statut audit.
 * À utiliser UNIQUEMENT si `candidate.verdict` (serveur) est absent.
 * Préférez toujours le verdict serveur pour cohérence.
 */
export function verdictFromScore(
  score: number,
  auditStatus?: string,
): ServerVerdict {
  if (auditStatus === 'ALERT' || score < 45) return 'risky';
  if (auditStatus === 'REVIEW' || score < 70) return 'review';
  return 'recommended';
}

// ─── Helper unique : résout le verdict avec fallback ─────────────────────────

/**
 * Récupère le verdict d'un candidat en privilégiant la source serveur.
 * Fallback automatique sur `verdictFromScore` si non défini (dossiers anciens).
 *
 * Usage :
 *   const verdict = resolveVerdict(candidate);
 *   const style = VERDICT_STYLES[verdict];
 */
export function resolveVerdict(candidate: {
  verdict?: ServerVerdict | null;
  score?: number | null;
  auditStatus?: string | null;
  ownerInsights?: {
    decisionSummary?: { verdict?: ServerVerdict | null } | null;
  } | null;
}): ServerVerdict {
  // 1. Priorité : verdict serveur dans `ownerInsights.decisionSummary.verdict`
  const serverVerdict =
    candidate.ownerInsights?.decisionSummary?.verdict ?? candidate.verdict;
  if (
    serverVerdict === 'recommended' ||
    serverVerdict === 'review' ||
    serverVerdict === 'risky'
  ) {
    return serverVerdict;
  }
  // 2. Fallback : dérivation depuis le score
  return verdictFromScore(
    Number(candidate.score || 0),
    candidate.auditStatus || undefined,
  );
}

// ─── Re-export labelForReason pour rétrocompat ───────────────────────────────

export { labelForReason, REASON_LABELS } from './verdict-reasons';
export type { ReasonCode } from './verdict-reasons';
