/**
 * Lexique produit PatrimoTrust — terminologie officielle "Banque Privée de l'Immobilier".
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
