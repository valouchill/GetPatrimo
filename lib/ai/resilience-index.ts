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

/**
 * Niveaux institutionnels inspirés des cartes bancaires haut de gamme :
 *   PLATINUM > GOLD > SILVER > ALERTE
 */
export type Level = 'PLATINUM' | 'GOLD' | 'SILVER' | 'ALERTE';
/** Statut UI haut niveau */
export type LevelStatus = 'SUCCESS' | 'WARNING' | 'DANGER';
/** Décision normalisée recommandée au propriétaire */
export type LevelAdvice = 'GO_FAST' | 'MANUAL_CHECK' | 'REJECT';

export interface LevelInfo {
  level: Level;
  status: LevelStatus;
  /**
   * Chaîne de classes Tailwind prête à appliquer sur un badge / chip
   * (bg + text + ring). Exemples :
   *   PLATINUM : "bg-slate-900 text-amber-500 ring-slate-800"
   *   GOLD     : "bg-amber-100 text-amber-800 ring-amber-200"
   *   SILVER   : "bg-slate-100 text-slate-700 ring-slate-200"
   *   ALERTE   : "bg-red-50 text-red-700 ring-red-200"
   */
  color: string;
  advice: LevelAdvice;
}

export interface ResilienceResult {
  /** Indice de Résilience final 0-100 (entier) */
  score: number;
  /** Niveau institutionnel (PLATINUM / GOLD / SILVER / ALERTE) */
  level: Level;
  /** Statut UI (SUCCESS / WARNING / DANGER) */
  status: LevelStatus;
  /** Chaîne de classes Tailwind (bg + text + ring) pour le badge */
  color: string;
  /** Décision normalisée — dérivée du niveau uniquement */
  decision: LevelAdvice;
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

// ─── Alias rétrocompat (à supprimer si plus jamais consommés) ──────────────
/** @deprecated Utiliser `Level`. */
export type Grade = Level;
/** @deprecated Utiliser `LevelStatus`. */
export type GradeStatus = LevelStatus;
/** @deprecated Utiliser `LevelAdvice`. */
export type GradeAdvice = LevelAdvice;
/** @deprecated Utiliser `LevelInfo`. */
export type GradeInfo = LevelInfo;

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
    return 65; // Plafonné au maximum du palier SILVER tant qu'il manque des pièces
  }

  return baseScore;
}

/**
 * Mapping déterministe score → niveau institutionnel "carte privée".
 *
 *   90-100 : PLATINUM — SUCCESS, badge noir/or,   GO_FAST
 *   75-89  : GOLD     — SUCCESS, badge ambre,     MANUAL_CHECK
 *   50-74  : SILVER   — WARNING, badge gris,      MANUAL_CHECK
 *   0-49   : ALERTE   — DANGER,  badge rouge,     REJECT
 *
 * La chaîne `color` est directement applicable sur un badge Tailwind
 * (bg + text + ring en une seule classe composite).
 */
export function getGradeFromScore(score: number): LevelInfo {
  if (score >= 90) {
    return {
      level: 'PLATINUM',
      status: 'SUCCESS',
      color: 'bg-slate-900 text-amber-500 ring-slate-800',
      advice: 'GO_FAST',
    };
  }
  if (score >= 75) {
    return {
      level: 'GOLD',
      status: 'SUCCESS',
      color: 'bg-amber-100 text-amber-800 ring-amber-200',
      advice: 'MANUAL_CHECK',
    };
  }
  if (score >= 50) {
    return {
      level: 'SILVER',
      status: 'WARNING',
      color: 'bg-slate-100 text-slate-700 ring-slate-200',
      advice: 'MANUAL_CHECK',
    };
  }
  return {
    level: 'ALERTE',
    status: 'DANGER',
    color: 'bg-red-50 text-red-700 ring-red-200',
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
  const levelInfo = getGradeFromScore(score);

  // Hard gates appliqués (audit humain)
  const hardGates: string[] = [];
  if (flags.isFraudDetected) {
    hardGates.push('Fraude détectée — score forcé à 15 (ALERTE critique)');
  }
  if (!flags.isDossierComplete && rawScore > 65 && !flags.isFraudDetected) {
    hardGates.push(
      'Dossier incomplet — score plafonné à 65 (haut de palier SILVER)',
    );
  }

  const finalVerdict: ResilienceResult['finalVerdict'] =
    levelInfo.advice === 'GO_FAST'
      ? 'recommended'
      : levelInfo.advice === 'REJECT'
      ? 'risky'
      : 'review';

  return {
    score,
    level: levelInfo.level,
    status: levelInfo.status,
    color: levelInfo.color,
    decision: levelInfo.advice,
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
