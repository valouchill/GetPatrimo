/**
 * PatrimoTrust — Icon System
 *
 * Mappers centralisés des icônes Lucide pour les différents états métier :
 *  - ICON_BY_STATUS : statut document (CERTIFIED, ANALYZING, REJECTED…)
 *  - ICON_BY_VERDICT : verdict propriétaire (recommended/review/risky)
 *  - ICON_BY_GUARANTEE : type de garantie (VISALE/PHYSICAL/NONE)
 *
 * Remplace systématiquement les émojis ✓✗⚠️🛡️ par des icônes Lucide
 * sémantiques avec `aria-hidden` ou `aria-label` selon le contexte.
 */

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  User,
  Building2,
  Lock,
  type LucideIcon,
} from 'lucide-react';

import type { ServerVerdict } from './verdict-system';

// ─── Document status ─────────────────────────────────────────────────────────

export type DocumentStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'CERTIFIED'
  | 'NEEDS_REVIEW'
  | 'REJECTED'
  | 'ILLEGIBLE'
  | 'FLAGGED';

export interface StatusVisual {
  icon: LucideIcon;
  /** Tailwind color classes (text + bg + ring) — token-aligned */
  text: string;
  bg: string;
  ring: string;
  /** Human-readable French label */
  label: string;
}

export const ICON_BY_STATUS: Record<DocumentStatus, StatusVisual> = {
  PENDING: {
    icon: AlertCircle,
    text: 'text-slate-600',
    bg: 'bg-slate-50',
    ring: 'ring-slate-200',
    label: 'En attente',
  },
  ANALYZING: {
    icon: Loader2,
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    label: 'Analyse en cours',
  },
  CERTIFIED: {
    icon: ShieldCheck,
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    label: 'Certifié',
  },
  NEEDS_REVIEW: {
    icon: AlertTriangle,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    label: 'À vérifier',
  },
  REJECTED: {
    icon: XCircle,
    text: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-200',
    label: 'Rejeté',
  },
  ILLEGIBLE: {
    icon: EyeOff,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-300',
    label: 'Illisible',
  },
  FLAGGED: {
    icon: AlertCircle,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    label: 'Incohérence',
  },
};

// ─── Verdict ─────────────────────────────────────────────────────────────────

export const ICON_BY_VERDICT: Record<ServerVerdict, LucideIcon> = {
  recommended: ShieldCheck,
  review: AlertTriangle,
  risky: AlertOctagon,
};

// ─── Guarantee ───────────────────────────────────────────────────────────────

export type GuaranteeMode = 'NONE' | 'VISALE' | 'PHYSICAL';

export interface GuaranteeVisual {
  icon: LucideIcon;
  text: string;
  bg: string;
  ring: string;
  dot: string;
  label: string;
  labelShort: string;
}

export const ICON_BY_GUARANTEE: Record<GuaranteeMode, GuaranteeVisual> = {
  NONE: {
    icon: ShieldX,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
    label: 'Sans garant',
    labelShort: 'Sans garant',
  },
  VISALE: {
    icon: ShieldCheck,
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Visale',
    labelShort: 'Visale',
  },
  PHYSICAL: {
    icon: User,
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    dot: 'bg-blue-500',
    label: 'Garant physique',
    labelShort: 'Garant',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise un statut document depuis le backend (peut être mixed-case)
 * vers l'enum strict SCREAMING_SNAKE.
 */
export function normalizeDocumentStatus(raw: string | undefined | null): DocumentStatus {
  if (!raw) return 'PENDING';
  const upper = String(raw).toUpperCase();
  if (
    upper === 'PENDING' ||
    upper === 'ANALYZING' ||
    upper === 'CERTIFIED' ||
    upper === 'NEEDS_REVIEW' ||
    upper === 'REJECTED' ||
    upper === 'ILLEGIBLE' ||
    upper === 'FLAGGED'
  ) {
    return upper as DocumentStatus;
  }
  // Variations connues : 'SCANNING' → 'ANALYZING', 'certified' → 'CERTIFIED'
  if (upper === 'SCANNING') return 'ANALYZING';
  return 'PENDING';
}

/**
 * Icônes utilitaires pour les pages locataire (apply tunnel).
 */
export const UTILITY_ICONS = {
  shield: ShieldCheck,
  shieldAlert: ShieldAlert,
  building: Building2,
  lock: Lock,
  eye: Eye,
  check: CheckCircle2,
} as const;
