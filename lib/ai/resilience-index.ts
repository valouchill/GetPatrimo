/**
 * resilience-index.ts — Algorithme déterministe pur (partie "Symbolique").
 *
 * Extrait du tenant-analyzer pour permettre l'utilisation côté tests
 * (Node pur, sans Next.js server-only ni OpenAI SDK). Ce module ne fait
 * AUCUN appel réseau et n'importe AUCUNE dépendance serveur.
 *
 * Garantit la cohérence absolue de l'Indice de Résilience : impossible
 * d'avoir 95/100 sans CNI (hard gates appliqués sur l'output du LLM).
 */

import type { AIAnalysisType } from './analysis-schema';

export interface ResilienceResult {
  /** Indice de Résilience final 0-100 (entier) */
  score: number;
  /** Grade lettre S / A / B / C / D */
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  /** Label affichable (ex: "GRADE S — Souverain") */
  gradeLabel: string;
  /** Verdict final croisé LLM + score */
  finalVerdict: 'recommended' | 'review' | 'risky';
  /** Décision normalisée (GO_FAST / MANUAL_CHECK / REJECT) */
  decision: 'GO_FAST' | 'MANUAL_CHECK' | 'REJECT';
  /** Détail par pilier (points pondérés) */
  breakdown: {
    financialStability: number; // 0-40
    documentAuthenticity: number; // 0-30
    professionalReliability: number; // 0-30
    rawScore: number; // 0-100 avant plafonnement
  };
  /** Hard gates appliqués (raisons humainement lisibles) */
  hardGates: string[];
  /** Pénalités souples appliquées */
  penalties: { label: string; points: number }[];
}

const GRADE_LABELS: Record<ResilienceResult['grade'], string> = {
  S: 'GRADE S — Souverain',
  A: 'GRADE A — Excellent',
  B: 'GRADE B — Solide',
  C: 'GRADE C — Vigilance',
  D: 'ALERTE',
};

function scoreToGrade(score: number): ResilienceResult['grade'] {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Calcule l'Indice de Résilience de manière déterministe.
 *
 * Pondération de base (rawScore 0-100) :
 *   - financialStability     × 4   (max 40 points)
 *   - documentAuthenticity   × 3   (max 30 points)
 *   - professionalReliability × 3  (max 30 points)
 *
 * Hard gates (plafonnement strict — garantit la cohérence) :
 *   1. isFraudDetected = true                        → score ≤ 30
 *   2. documentAuthenticity = 0                      → score ≤ 30
 *   3. isDossierComplete = false                     → score ≤ 60
 *
 * Pénalités souples (cumulables) :
 *   - isIncomeSufficient = false → -20 points
 *
 * Décision finale (croisée LLM + score) :
 *   - REJECT  si LLM REJECT, score < 40, ou fraude détectée
 *   - GO_FAST si score ≥ 75, LLM GO_FAST, pas de hard gate, dossier complet
 *   - MANUAL_CHECK sinon (mode sécuritaire par défaut)
 */
export function computeResilienceIndex(analysis: AIAnalysisType): ResilienceResult {
  const { flags, subScores, ownerRecommendation } = analysis;

  const financial = clamp(subScores.financialStability * 4, 0, 40);
  const authenticity = clamp(subScores.documentAuthenticity * 3, 0, 30);
  const professional = clamp(subScores.professionalReliability * 3, 0, 30);
  let rawScore = financial + authenticity + professional;

  const hardGates: string[] = [];
  const penalties: { label: string; points: number }[] = [];

  // Hard gates
  if (flags.isFraudDetected) {
    rawScore = Math.min(rawScore, 30);
    hardGates.push('Fraude détectée — score plafonné à 30');
  }
  if (subScores.documentAuthenticity === 0) {
    rawScore = Math.min(rawScore, 30);
    hardGates.push("Authenticité documentaire nulle — score plafonné à 30");
  }
  if (!flags.isDossierComplete) {
    rawScore = Math.min(rawScore, 60);
    hardGates.push('Dossier incomplet (pièce majeure manquante) — score plafonné à 60');
  }

  // Pénalités souples
  if (!flags.isIncomeSufficient) {
    const penalty = 20;
    rawScore = Math.max(0, rawScore - penalty);
    penalties.push({
      label: 'Revenus insuffisants au regard du loyer (taux d\'effort élevé)',
      points: -penalty,
    });
  }

  const finalScore = Math.round(clamp(rawScore, 0, 100));
  const grade = scoreToGrade(finalScore);

  // Décision finale (l'algo a la priorité — sécurité)
  let decision: ResilienceResult['decision'];
  if (
    ownerRecommendation.decisionAdvice === 'REJECT' ||
    finalScore < 40 ||
    flags.isFraudDetected
  ) {
    decision = 'REJECT';
  } else if (
    finalScore >= 75 &&
    ownerRecommendation.decisionAdvice === 'GO_FAST' &&
    hardGates.length === 0 &&
    flags.isDossierComplete
  ) {
    decision = 'GO_FAST';
  } else {
    decision = 'MANUAL_CHECK';
  }

  const finalVerdict: ResilienceResult['finalVerdict'] =
    decision === 'GO_FAST'
      ? 'recommended'
      : decision === 'REJECT'
      ? 'risky'
      : 'review';

  return {
    score: finalScore,
    grade,
    gradeLabel: GRADE_LABELS[grade],
    finalVerdict,
    decision,
    breakdown: {
      financialStability: Math.round(financial),
      documentAuthenticity: Math.round(authenticity),
      professionalReliability: Math.round(professional),
      rawScore: Math.round(financial + authenticity + professional),
    },
    hardGates,
    penalties,
  };
}
