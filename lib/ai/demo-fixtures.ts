/**
 * demo-fixtures.ts — Dossiers exemples pour le mode « Tester avec un dossier exemple ».
 *
 * Permet à un propriétaire fraîchement inscrit de vivre le « aha moment »
 * (Indice de Résilience + audit forensic anti-fraude) SANS locataire réel,
 * SANS consommer de quota ni d'essai gratuit, et SANS appel Didit.
 * Seul le scoring LLM (~0,04 €) est réellement exécuté ; son coût est taggé
 * `isSample` (cf. demo-analysis/route.ts) pour être exclu de la marge/COGS
 * dans le cockpit admin.
 */

import type { AnalysisInputType } from './analysis-schema';

export type DemoVariant = 'clean' | 'fraud';

/** Dossier exemplaire — vise un score élevé (PLATINUM/GOLD), décision GO_FAST. */
const CLEAN_FIXTURE: AnalysisInputType = {
  applicationId: 'demo-clean',
  candidate: {
    firstName: 'Camille',
    lastName: 'Durand',
    profession: 'Ingénieure logiciel',
    employer: 'Atos',
    contractType: 'CDI',
    seniorityMonths: 48,
  },
  financial: {
    // Dossier volontairement "d'exception" (revenus élevés, taux d'effort bas,
    // ancienneté forte) pour verrouiller un niveau haut (PLATINUM/GOLD) même
    // avec un LLM prudent — le but de la démo est de montrer un beau résultat.
    monthlyIncomeNet: 4200,
    targetRent: 950,
    effortRatePercent: 22.6,
    incomeStabilityMonths: 24,
    taxIncomeAnnual: 48000,
    incomeSource: 'PAYSLIP',
  },
  identity: { diditVerified: true, cniPresent: true },
  guarantee: { mode: 'NONE', guarantorIncomeNet: null, coverage: null },
  documents: {
    identityProvided: true,
    payslipsCount: 3,
    taxNoticeProvided: true,
    addressProofProvided: true,
    employerCertificateProvided: true,
    rejectedCount: 0,
    forensicAlertCount: 0,
  },
  forensic: {
    globalStatus: 'CLEAR',
    suspiciousSoftwareDetected: false,
    mathematicalInconsistencies: false,
  },
};

/**
 * Dossier frauduleux — bulletin de paie retouché (trace logicielle) + revenus
 * déclarés (4 200 €/mois) incohérents avec l'avis d'imposition (18 000 €/an
 * ≈ 1 500 €/mois) → isFraudDetected=true, decisionAdvice=REJECT.
 */
const FRAUD_FIXTURE: AnalysisInputType = {
  applicationId: 'demo-fraud',
  candidate: {
    firstName: 'Kevin',
    lastName: 'Martin',
    profession: 'Consultant',
    employer: 'Auto-entrepreneur',
    contractType: 'CDI',
    seniorityMonths: 4,
  },
  financial: {
    monthlyIncomeNet: 4200,
    targetRent: 1150,
    effortRatePercent: 27.4,
    incomeStabilityMonths: 3,
    taxIncomeAnnual: 18000,
    incomeSource: 'PAYSLIP',
  },
  // diditVerified=false sur le dossier frauduleux : sinon le moteur force un
  // contrôle « Identité certifiée eIDAS — sécurité maximale » qui s'afficherait
  // de façon incohérente à côté de « Fraude détectée » (cf. revue pré-ship).
  identity: { diditVerified: false, cniPresent: true },
  guarantee: { mode: 'NONE', guarantorIncomeNet: null, coverage: null },
  documents: {
    identityProvided: true,
    payslipsCount: 3,
    taxNoticeProvided: true,
    addressProofProvided: false,
    employerCertificateProvided: false,
    rejectedCount: 1,
    forensicAlertCount: 2,
  },
  forensic: {
    globalStatus: 'ALERT',
    suspiciousSoftwareDetected: true,
    mathematicalInconsistencies: true,
  },
};

const FIXTURES: Record<DemoVariant, AnalysisInputType> = {
  clean: CLEAN_FIXTURE,
  fraud: FRAUD_FIXTURE,
};

/** Retourne la fixture de la variante demandée, ou null si inconnue. */
export function getDemoFixture(variant: string): AnalysisInputType | null {
  return FIXTURES[variant as DemoVariant] ?? null;
}
