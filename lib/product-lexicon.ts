/**
 * Lexique produit Maison Patrimo — terminologie officielle "Banque Privée de l'Immobilier".
 *
 * Source unique de vérité pour tous les composants UI :
 * pas de chaînes brutes "score", "audit", "passeport" dans les composants.
 */

// ── Grades ───────────────────────────────────────────────────────────────────
// Indice de Résilience → grade
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export function getGrade(score: number): Grade {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export const GRADE_LABELS: Record<Grade, string> = {
  S: 'Grade S — Souverain',
  A: 'Grade A — Excellent',
  B: 'Grade B — Solide',
  C: 'Grade C — À vérifier',
  D: 'Grade D — Risqué',
};

export const GRADE_SHORT: Record<Grade, string> = {
  S: 'Grade S',
  A: 'Grade A',
  B: 'Grade B',
  C: 'Grade C',
  D: 'Grade D',
};

export const GRADE_DESCRIPTION: Record<Grade, string> = {
  S: 'Dossier parfait et certifié. Aucune réserve.',
  A: 'Dossier très solide. Recommandé.',
  B: 'Dossier acceptable. Points d\'attention mineurs.',
  C: 'Dossier à examiner. Vérifications recommandées.',
  D: 'Dossier risqué. Plusieurs alertes.',
};

// Couleurs Tailwind par grade (cohérent avec emerald/amber/red)
export const GRADE_COLORS: Record<Grade, { bg: string; text: string; ring: string }> = {
  S: { bg: 'bg-emerald-50',  text: 'text-emerald-700', ring: 'ring-emerald-200' },
  A: { bg: 'bg-emerald-50',  text: 'text-emerald-600', ring: 'ring-emerald-200' },
  B: { bg: 'bg-amber-50',    text: 'text-amber-700',   ring: 'ring-amber-200' },
  C: { bg: 'bg-orange-50',   text: 'text-orange-700',  ring: 'ring-orange-200' },
  D: { bg: 'bg-red-50',      text: 'text-red-700',     ring: 'ring-red-200' },
};

// ── Métaux précieux (V6.4) ──────────────────────────────────────────────────
// Source de vérité unique pour le rendu UI du niveau institutionnel.
// Aligné sur lib/ai/resilience-index.ts (getGradeFromScore) mais utilisable
// sans dépendre du module AI (pas de Zod / OpenAI / server-only).
export type MetalLevel = 'PLATINUM' | 'GOLD' | 'SILVER' | 'ALERTE';

/** Mapping déterministe score → niveau métal (mêmes seuils que V2 algo). */
export function getMetalLevel(score: number): MetalLevel {
  if (score >= 90) return 'PLATINUM';
  if (score >= 75) return 'GOLD';
  if (score >= 50) return 'SILVER';
  return 'ALERTE';
}

export const METAL_LABELS: Record<MetalLevel, string> = {
  PLATINUM: 'PLATINUM',
  GOLD: 'GOLD',
  SILVER: 'SILVER',
  ALERTE: 'ALERTE',
};

export const METAL_DESCRIPTIONS: Record<MetalLevel, string> = {
  PLATINUM: 'Dossier d\'exception — validation rapide possible.',
  GOLD: 'Dossier solide — revue manuelle recommandée.',
  SILVER: 'Dossier acceptable — vérifications complémentaires.',
  ALERTE: 'Dossier à écarter — alertes critiques détectées.',
};

/**
 * Classes Tailwind structurées par niveau (utilisables avec ring-1, etc.).
 * Pour un badge complet pré-composé, voir METAL_BADGE_CLASS ci-dessous.
 */
export const METAL_COLORS: Record<
  MetalLevel,
  { bg: string; text: string; ring: string; barFill: string }
> = {
  PLATINUM: {
    bg: 'bg-slate-900',
    text: 'text-amber-500',
    ring: 'ring-slate-800',
    barFill: 'bg-amber-500',
  },
  GOLD: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    ring: 'ring-amber-200',
    barFill: 'bg-amber-400',
  },
  SILVER: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    ring: 'ring-slate-200',
    barFill: 'bg-slate-400',
  },
  ALERTE: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-200',
    barFill: 'bg-red-500',
  },
};

/** Chaîne pré-composée prête à coller sur un badge (bg + text + ring). */
export const METAL_BADGE_CLASS: Record<MetalLevel, string> = {
  PLATINUM: 'bg-slate-900 text-amber-500 ring-slate-800',
  GOLD: 'bg-amber-100 text-amber-800 ring-amber-200',
  SILVER: 'bg-slate-100 text-slate-700 ring-slate-200',
  ALERTE: 'bg-red-50 text-red-700 ring-red-200',
};

// ── Audit Forensic ──────────────────────────────────────────────────────────
export type AuditStatus = 'CLEAR' | 'REVIEW' | 'ALERT' | 'PENDING';

export const AUDIT_LABELS: Record<AuditStatus, string> = {
  CLEAR: 'Audit Forensic ✓ Validé',
  REVIEW: 'Audit Forensic · À réviser',
  ALERT: 'Audit Forensic ⚠ Alerte',
  PENDING: 'Audit Forensic · En cours',
};

export const AUDIT_SHORT: Record<AuditStatus, string> = {
  CLEAR: 'Validé',
  REVIEW: 'À réviser',
  ALERT: 'Alerte',
  PENDING: 'En cours',
};

export const AUDIT_COLORS: Record<AuditStatus, { bg: string; text: string }> = {
  CLEAR: { bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  REVIEW: { bg: 'bg-amber-50',   text: 'text-amber-700' },
  ALERT: { bg: 'bg-red-50',      text: 'text-red-700' },
  PENDING: { bg: 'bg-slate-50',  text: 'text-slate-600' },
};

// ── Concepts produit ─────────────────────────────────────────────────────────
export const PRODUCT = {
  /** Le score 0-100 du locataire */
  INDICE: 'Indice de Résilience',
  INDICE_SHORT: 'Indice',
  /** Le dossier certifié du locataire */
  PASSEPORT: 'Passeport Locatif',
  /** L'analyse anti-fraude des documents */
  AUDIT: 'Audit Forensic',
  /** Le lien de candidature à partager (LeBonCoin, etc.) */
  SESAME: 'Sésame',
  /** L'espace sécurisé du propriétaire */
  COFFRE_FORT: 'Coffre-Fort',
  /** Statut premium du propriétaire (V2) */
  STATUT: 'Statut Souverain',
} as const;

// ── Helpers d'affichage ─────────────────────────────────────────────────────
export function formatResilience(score: number): string {
  return `${Math.round(score)}%`;
}

export function gradeLabel(score: number): string {
  return GRADE_SHORT[getGrade(score)];
}

export function gradeColors(score: number) {
  return GRADE_COLORS[getGrade(score)];
}

// ── Formatters localisation française ───────────────────────────────────────

/**
 * Formate un prix en français : "1 234 €" ou "1 234,56 €" si décimales.
 * Toujours avec le symbole €, jamais "EUR".
 */
export function formatPrice(amount: number, opts?: { decimals?: boolean }): string {
  const showDecimals = opts?.decimals ?? false;
  const value = amount.toLocaleString('fr-FR', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  return `${value} €`;
}

/**
 * Formate une date en français long : "15 mars 2026".
 * Accepte Date | string | undefined ; renvoie '—' si invalide.
 */
export function formatDate(input: Date | string | null | undefined): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Formate une date courte : "15/03/2026".
 */
export function formatDateShort(input: Date | string | null | undefined): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR');
}

/**
 * Pluralisation simple : `pluralize(2, 'candidature')` → "2 candidatures".
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const p = plural ?? `${singular}s`;
  return `${count.toLocaleString('fr-FR')} ${count > 1 ? p : singular}`;
}
