/**
 * Mapping FR des reasonCodes du verdict propriétaire.
 *
 * Le verdict est calculé côté serveur dans
 * /opt/doc2loc/src/utils/ownerApplicationInsights.js (computeOwnerVerdict).
 * Ces labels sont consommés par l'UI propriétaire (DecisionVerdict +
 * SelectionConfirmModal) pour expliquer les raisons en clair au bailleur.
 */

export type ReasonCode =
  // — Bloquants (verdict = 'risky') —
  | 'FORENSIC_ALERT'
  | 'HIGH_EFFORT_RATE'
  | 'MISSING_ESSENTIAL_DOCS'
  | 'CONTRACT_BLOCKED'
  | 'DOCUMENTS_REJECTED'
  // — Vigilances (verdict = 'review') —
  | 'NO_CERTIFIED_SOLVENCY'
  | 'NO_GUARANTEE'
  | 'ELEVATED_EFFORT_RATE'
  | 'AUDIT_REVIEW'
  | 'SECONDARY_DOCS_IN_REVIEW'
  | 'LIMITED_PROFILE_NO_GUARANTEE';

export const REASON_LABELS: Record<ReasonCode, string> = {
  // Bloquants
  FORENSIC_ALERT: 'Audit Forensic en alerte — vérification manuelle requise',
  HIGH_EFFORT_RATE: "Taux d'effort > 38% — risque d'impayé majeur",
  MISSING_ESSENTIAL_DOCS: 'Pièces essentielles manquantes',
  CONTRACT_BLOCKED: 'Blocages contractuels détectés',
  DOCUMENTS_REJECTED: "Documents rejetés par l'audit IA",
  // Vigilances
  NO_CERTIFIED_SOLVENCY: 'Solvabilité non certifiée — revenus à vérifier',
  NO_GUARANTEE: 'Aucune garantie détectée — Visale fortement recommandée',
  ELEVATED_EFFORT_RATE: "Taux d'effort entre 33% et 38% — garant recommandé",
  AUDIT_REVIEW: 'Audit Forensic à examiner',
  SECONDARY_DOCS_IN_REVIEW: 'Pièces secondaires en cours de revue',
  LIMITED_PROFILE_NO_GUARANTEE: 'Profil CDD/freelance/étudiant sans garant solide',
};

export const VERDICT_LABELS = {
  recommended: 'Recommandé',
  review: 'À vérifier',
  risky: 'Risqué',
} as const;

export type ServerVerdict = keyof typeof VERDICT_LABELS;

export function labelForReason(code: string): string {
  return (REASON_LABELS as Record<string, string>)[code] || code;
}
