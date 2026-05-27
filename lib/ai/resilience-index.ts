/**
 * resilience-index.ts — Indice de Résilience V2 (Grades Institutionnels).
 *
 * Algorithme déterministe pur (sans server-only ni OpenAI). Extrait du
 * tenant-analyzer pour permettre l'utilisation côté tests (Node nu).
 *
 * Architecture neuro-symbolique :
 *   - Le LLM produit des observations factuelles (flags + sub-scores 0-10)
 *   - CE module calcule un score déterministe 0-100 + mapping en grade
 *
 * Garantie : cohérence absolue (impossible 95/100 sans CNI, score
 * critique forcé sur fraude détectée).
 */

import type { AIAnalysisType } from './analysis-schema';

// ─── Types publics ───────────────────────────────────────────────────────────

export interface SubScores {
  /** Note 0-10 de la stabilité financière */
  financialStability: number;
  /** Note 0-10 de l'authenticité documentaire */
  documentAuthenticity: number;
  /** Note 0-10 de la fiabilité professionnelle */
  professionalReliability: number;
}

export interface ScoringFlags {
  isFraudDetected: boolean;
  isDossierComplete: boolean;
}

/** Grade institutionnel (4 niveaux) */
export type Grade = 'GRADE S' | 'GRADE A' | 'GRADE B' | 'ALERTE';
/** Statut UI haut niveau */
export type GradeStatus = 'SUCCESS' | 'WARNING' | 'DANGER';
/** Décision normalisée recommandée au propriétaire */
export type GradeAdvice = 'GO_FAST' | 'MANUAL_CHECK' | 'REJECT';

export interface GradeInfo {
  grade: Grade;
  status: GradeStatus;
  /** Token Tailwind (sans préfixe : "emerald-600", "amber-500", …) */
  color: string;
  advice: GradeAdvice;
}

export interface ResilienceResult {
  /** Indice de Résilience final 0-100 (entier) */
  score: number;
  /** Grade institutionnel (GRADE S / A / B / ALERTE) */
  grade: Grade;
  /** Statut UI (SUCCESS / WARNING / DANGER) */
  status: GradeStatus;
  /** Couleur Tailwind associée */
  color: string;
  /** Décision normalisée — dérivée du grade uniquement */
  decision: GradeAdvice;
  /** Verdict frontend (recommended / review / risky) */
  finalVerdict: 'recommended' | 'review' | 'risky';
  /** Détail par pilier (points pondérés) + raw avant plafonnement */
  breakdown: {
    financialStability: number; // 0-40
    documentAuthenticity: number; // 0-40
    professionalReliability: number; // 0-20
    rawScore: number; // 0-100 avant règles défensives
  };
  /** Hard gates appliqués (raisons humainement lisibles) */
  hardGates: string[];
}

// ─── Algorithmes purs (les briques exportées) ────────────────────────────────

/**
 * Calcule l'Indice de Résilience final 0-100 selon les règles métier
 * PatrimoTrust V2 (algorithme défensif).
 *
 * Pondération : financialStability×4 + documentAuthenticity×4 + professionalReliability×2
 *   Max théorique : 10×4 + 10×4 + 10×2 = 100
 *
 * Règles défensives (dans l'ordre) :
 *   1. Tolérance zéro fraude  : isFraudDetected=true → return 15 (ALERTE)
 *   2. Plafond dossier incomplet : !isDossierComplete && score>65 → return 65
 */
export function calculateFinalScore(
  subScores: SubScores,
  flags: ScoringFlags,
): number {
  // Règle 1 : Tolérance zéro fraude
  if (flags.isFraudDetected) {
    return 15; // Forcé en statut ALERTE critique
  }

  // Calcul de la moyenne pondérée de base (Total sur 100)
  let baseScore =
    subScores.financialStability * 4 +
    subScores.documentAuthenticity * 4 +
    subScores.professionalReliability * 2;
  baseScore = Math.round(baseScore);

  // Règle 2 : Plafond de dossier incomplet
  if (!flags.isDossierComplete && baseScore > 65) {
    return 65; // Plafonné au maximum du GRADE B tant qu'il manque des pièces
  }

  return baseScore;
}

/**
 * Mapping déterministe score → grade institutionnel.
 *
 *   90-100 : GRADE S — SUCCESS, emerald-600, GO_FAST
 *   75-89  : GRADE A — SUCCESS, emerald-500, MANUAL_CHECK
 *   50-74  : GRADE B — WARNING, amber-500,   MANUAL_CHECK
 *   0-49   : ALERTE  — DANGER,  red-500,     REJECT
 */
export function getGradeFromScore(score: number): GradeInfo {
  if (score >= 90) {
    return {
      grade: 'GRADE S',
      status: 'SUCCESS',
      color: 'emerald-600',
      advice: 'GO_FAST',
    };
  }
  if (score >= 75) {
    return {
      grade: 'GRADE A',
      status: 'SUCCESS',
      color: 'emerald-500',
      advice: 'MANUAL_CHECK',
    };
  }
  if (score >= 50) {
    return {
      grade: 'GRADE B',
      status: 'WARNING',
      color: 'amber-500',
      advice: 'MANUAL_CHECK',
    };
  }
  return {
    grade: 'ALERTE',
    status: 'DANGER',
    color: 'red-500',
    advice: 'REJECT',
  };
}

// ─── Orchestrateur (sortie riche pour API + UI) ─────────────────────────────

/**
 * Pipeline complet : applique calculateFinalScore + getGradeFromScore
 * sur la sortie LLM et construit un ResilienceResult riche (breakdown,
 * hardGates, verdict frontend).
 *
 * Le LLM ne décide PAS — la décision provient exclusivement du grade.
 * `ownerRecommendation.decisionAdvice` (LLM) reste disponible en lecture
 * dans `analysis.ownerRecommendation` pour comparaison, mais n'altère
 * jamais le résultat de cet algo (garantie déterministe).
 */
export function computeResilienceIndex(analysis: AIAnalysisType): ResilienceResult {
  const { flags, subScores } = analysis;

  const scoringFlags: ScoringFlags = {
    isFraudDetected: flags.isFraudDetected,
    isDossierComplete: flags.isDossierComplete,
  };

  // Pondérations effectives pour le breakdown (avant règles défensives)
  const financialPts = Math.round(subScores.financialStability * 4);
  const authenticityPts = Math.round(subScores.documentAuthenticity * 4);
  const professionalPts = Math.round(subScores.professionalReliability * 2);
  const rawScore = financialPts + authenticityPts + professionalPts;

  // Score final via les règles défensives
  const score = calculateFinalScore(subScores, scoringFlags);
  const gradeInfo = getGradeFromScore(score);

  // Hard gates appliqués (audit humain)
  const hardGates: string[] = [];
  if (flags.isFraudDetected) {
    hardGates.push('Fraude détectée — score forcé à 15 (ALERTE critique)');
  }
  if (!flags.isDossierComplete && rawScore > 65 && !flags.isFraudDetected) {
    hardGates.push(
      'Dossier incomplet — score plafonné à 65 (haut de GRADE B)',
    );
  }

  const finalVerdict: ResilienceResult['finalVerdict'] =
    gradeInfo.advice === 'GO_FAST'
      ? 'recommended'
      : gradeInfo.advice === 'REJECT'
      ? 'risky'
      : 'review';

  return {
    score,
    grade: gradeInfo.grade,
    status: gradeInfo.status,
    color: gradeInfo.color,
    decision: gradeInfo.advice,
    finalVerdict,
    breakdown: {
      financialStability: financialPts,
      documentAuthenticity: authenticityPts,
      professionalReliability: professionalPts,
      rawScore,
    },
    hardGates,
  };
}
