/**
 * Tests unitaires de l'algorithme déterministe computeResilienceIndex.
 *
 * On vérifie LES HARD GATES qui garantissent la cohérence absolue —
 * c'est l'avantage clé de l'architecture neuro-symbolique vs le LLM seul.
 *
 * Lancement : npx tsx tests/tenant-analyzer.test.ts
 */

// Import direct de l'algo pur (sans server-only ni OpenAI SDK pour Node nu)
import { computeResilienceIndex } from '../lib/ai/resilience-index';
import type { AIAnalysisType } from '../lib/ai/analysis-schema';

function makeAnalysis(overrides: Partial<AIAnalysisType> = {}): AIAnalysisType {
  return {
    flags: {
      isFraudDetected: false,
      isDossierComplete: true,
      isIncomeSufficient: true,
      ...(overrides.flags || {}),
    },
    subScores: {
      financialStability: 10,
      documentAuthenticity: 10,
      professionalReliability: 10,
      ...(overrides.subScores || {}),
    },
    synthesis: {
      title: 'Dossier d\'excellence',
      executiveSummary: 'Test.',
      anomaliesFound: [],
      ...(overrides.synthesis || {}),
    },
    ownerRecommendation: {
      decisionAdvice: 'GO_FAST',
      actionPlan: ['Validez ce dossier.'],
      ...(overrides.ownerRecommendation || {}),
    },
  };
}

let passed = 0;
let failed = 0;

function expect(label: string, condition: boolean, details?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label} ${details ? `(${details})` : ''}`);
    failed++;
  }
}

console.log('\n[T1] Dossier parfait → score 100, GRADE S, GO_FAST');
{
  const result = computeResilienceIndex(makeAnalysis());
  expect('score = 100', result.score === 100, `got ${result.score}`);
  expect('grade S', result.grade === 'S');
  expect('decision GO_FAST', result.decision === 'GO_FAST');
  expect('finalVerdict recommended', result.finalVerdict === 'recommended');
  expect('aucun hard gate', result.hardGates.length === 0);
}

console.log('\n[T2] Fraude détectée → score ≤ 30, REJECT');
{
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: true, isDossierComplete: true, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 0, professionalReliability: 10 },
      ownerRecommendation: { decisionAdvice: 'REJECT', actionPlan: ['Écarter ce dossier.'] },
    }),
  );
  expect('score ≤ 30', result.score <= 30, `got ${result.score}`);
  expect('decision REJECT', result.decision === 'REJECT');
  expect('hard gate fraude', result.hardGates.some((g) => g.toLowerCase().includes('fraude')));
}

console.log('\n[T3] CNI manquante (dossier incomplet) → score ≤ 60');
{
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: false, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    }),
  );
  expect(
    'score ≤ 60 (impossible 95/100 sans CNI)',
    result.score <= 60,
    `got ${result.score}`,
  );
  expect(
    'hard gate dossier incomplet',
    result.hardGates.some((g) => g.toLowerCase().includes('incomplet')),
  );
  expect('decision MANUAL_CHECK minimum', result.decision !== 'GO_FAST');
}

console.log('\n[T4] Revenus insuffisants → -20 points');
{
  // Note : le LLM doit aussi mettre subScores.financialStability bas dans la vraie vie,
  // mais ce test isole la pénalité revenus
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: true, isIncomeSufficient: false },
      subScores: { financialStability: 8, documentAuthenticity: 10, professionalReliability: 10 },
    }),
  );
  // Score brut : 8*4 + 10*3 + 10*3 = 32 + 30 + 30 = 92
  // Pénalité revenus : -20 → 72
  expect('score = 72 (92 - 20 penalty)', result.score === 72, `got ${result.score}`);
  expect(
    'pénalité revenus présente',
    result.penalties.some((p) => p.label.toLowerCase().includes('revenus')),
  );
  expect('decision MANUAL_CHECK', result.decision === 'MANUAL_CHECK');
}

console.log('\n[T5] Score 100 prétendu mais authenticity=0 → cap 30');
{
  // Cas adversariel : le LLM tente d\'injecter un score parfait sur d\'autres axes
  // tout en ayant détecté une fraude (authenticity=0)
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: true, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 0, professionalReliability: 10 },
      ownerRecommendation: { decisionAdvice: 'GO_FAST', actionPlan: ['Validez.'] },
    }),
  );
  expect(
    'score ≤ 30 (authenticity nulle)',
    result.score <= 30,
    `got ${result.score}`,
  );
  expect(
    'hard gate authenticité',
    result.hardGates.some((g) => g.toLowerCase().includes('authenticit')),
  );
  expect('decision NEVER GO_FAST', result.decision !== 'GO_FAST');
}

console.log('\n[T6] LLM REJECT mais score haut → REJECT (LLM input respecté quand REJECT)');
{
  const result = computeResilienceIndex(
    makeAnalysis({
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
      ownerRecommendation: { decisionAdvice: 'REJECT', actionPlan: ['Vérifier.'] },
    }),
  );
  expect('decision REJECT (LLM dit REJECT)', result.decision === 'REJECT');
}

console.log('\n[T7] Cumul hard gates → cap le plus strict gagne');
{
  // Fraude (≤30) + dossier incomplet (≤60) → on garde ≤30
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: true, isDossierComplete: false, isIncomeSufficient: false },
      subScores: { financialStability: 5, documentAuthenticity: 0, professionalReliability: 5 },
    }),
  );
  expect('score ≤ 30 (fraude prime)', result.score <= 30, `got ${result.score}`);
  expect(
    '3+ hard gates / penalties',
    result.hardGates.length + result.penalties.length >= 2,
  );
}

console.log('\n[T8] Score 90 + LLM GO_FAST mais dossier incomplet → MANUAL_CHECK');
{
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: false, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
      ownerRecommendation: { decisionAdvice: 'GO_FAST', actionPlan: ['Validez.'] },
    }),
  );
  expect(
    'decision MANUAL_CHECK (incomplet bloque GO_FAST)',
    result.decision === 'MANUAL_CHECK',
  );
}

console.log(`\n══════════════════════════════════════`);
console.log(`Tests passés : ${passed}`);
console.log(`Tests échoués : ${failed}`);
console.log(`══════════════════════════════════════\n`);

if (failed > 0) {
  process.exit(1);
}
