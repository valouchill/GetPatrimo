/**
 * Tests unitaires de l'Indice de Résilience V2 (Grades Institutionnels).
 *
 * On valide :
 *   - calculateFinalScore : pondération 4/4/2 + 2 règles défensives
 *   - getGradeFromScore   : mapping 4 grades + couleurs + advice
 *   - computeResilienceIndex : orchestrateur (breakdown, hardGates, verdict)
 *   - AIAnalysisSchema     : conformité Zod stricte (forensicAudit inclus)
 *
 * Lancement : npx tsx tests/tenant-analyzer.test.ts
 */

import {
  calculateFinalScore,
  computeResilienceIndex,
  getGradeFromScore,
} from '../lib/ai/resilience-index';
import {
  AIAnalysisSchema,
  type AIAnalysisType,
} from '../lib/ai/analysis-schema';

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
    forensicAudit: overrides.forensicAudit ?? [
      {
        checkName: 'Métadonnées PDF',
        status: 'VERIFIED',
        details:
          'Auteur et dates de création cohérents avec un éditeur certifié.',
      },
      {
        checkName: "Traces d'édition",
        status: 'VERIFIED',
        details:
          'Aucune trace de Canva, Photoshop, Illustrator ou GIMP détectée.',
      },
      {
        checkName: 'Cohérence mathématique URSSAF',
        status: 'VERIFIED',
        details:
          'Totaux brut/net/cotisations et cumuls annuels recalculés sans écart.',
      },
    ],
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

// ═════════════════════════════════════════════════════════════════════════════
// calculateFinalScore — règles défensives
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n[T1] calculateFinalScore : pondération 4/4/2');
{
  // 10×4 + 10×4 + 10×2 = 40+40+20 = 100
  const score = calculateFinalScore(
    { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    { isFraudDetected: false, isDossierComplete: true },
  );
  expect('subscores parfaits → 100', score === 100, `got ${score}`);
}
{
  // 8×4 + 7×4 + 9×2 = 32+28+18 = 78 → GRADE A
  const score = calculateFinalScore(
    { financialStability: 8, documentAuthenticity: 7, professionalReliability: 9 },
    { isFraudDetected: false, isDossierComplete: true },
  );
  expect('8/7/9 → 78 (GRADE A)', score === 78, `got ${score}`);
}
{
  // 5×4 + 6×4 + 5×2 = 20+24+10 = 54 → GRADE B
  const score = calculateFinalScore(
    { financialStability: 5, documentAuthenticity: 6, professionalReliability: 5 },
    { isFraudDetected: false, isDossierComplete: true },
  );
  expect('5/6/5 → 54 (GRADE B)', score === 54, `got ${score}`);
}

console.log('\n[T2] Règle 1 : tolérance zéro fraude → 15');
{
  // Même avec des subscores parfaits, fraude → 15 forcé
  const score = calculateFinalScore(
    { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    { isFraudDetected: true, isDossierComplete: true },
  );
  expect('fraude détectée → 15 (ALERTE)', score === 15, `got ${score}`);
}
{
  const score = calculateFinalScore(
    { financialStability: 0, documentAuthenticity: 0, professionalReliability: 0 },
    { isFraudDetected: true, isDossierComplete: false },
  );
  expect('fraude prime sur tout → 15', score === 15, `got ${score}`);
}

console.log('\n[T3] Règle 2 : dossier incomplet → plafond 65');
{
  // 10/10/10 = 100 mais incomplet → 65
  const score = calculateFinalScore(
    { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    { isFraudDetected: false, isDossierComplete: false },
  );
  expect('subscores parfaits + incomplet → 65', score === 65, `got ${score}`);
}
{
  // 8/7/9 = 78 mais incomplet → 65
  const score = calculateFinalScore(
    { financialStability: 8, documentAuthenticity: 7, professionalReliability: 9 },
    { isFraudDetected: false, isDossierComplete: false },
  );
  expect('8/7/9 + incomplet → 65 (plafonné)', score === 65, `got ${score}`);
}
{
  // 5/6/5 = 54 + incomplet → 54 (pas de plafond car déjà ≤ 65)
  const score = calculateFinalScore(
    { financialStability: 5, documentAuthenticity: 6, professionalReliability: 5 },
    { isFraudDetected: false, isDossierComplete: false },
  );
  expect('5/6/5 + incomplet → 54 (pas plafonné car < 65)', score === 54, `got ${score}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// getGradeFromScore — mapping institutionnel
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n[T4] getGradeFromScore : 4 paliers');
{
  const s = getGradeFromScore(100);
  expect('100 → GRADE S / SUCCESS / emerald-600 / GO_FAST',
    s.grade === 'GRADE S' && s.status === 'SUCCESS' && s.color === 'emerald-600' && s.advice === 'GO_FAST');
}
{
  const s = getGradeFromScore(90);
  expect('90 (borne basse) → GRADE S', s.grade === 'GRADE S');
}
{
  const s = getGradeFromScore(89);
  expect('89 → GRADE A / emerald-500 / MANUAL_CHECK',
    s.grade === 'GRADE A' && s.color === 'emerald-500' && s.advice === 'MANUAL_CHECK');
}
{
  const s = getGradeFromScore(75);
  expect('75 (borne basse) → GRADE A', s.grade === 'GRADE A');
}
{
  const s = getGradeFromScore(74);
  expect('74 → GRADE B / WARNING / amber-500 / MANUAL_CHECK',
    s.grade === 'GRADE B' && s.status === 'WARNING' && s.color === 'amber-500' && s.advice === 'MANUAL_CHECK');
}
{
  const s = getGradeFromScore(50);
  expect('50 (borne basse) → GRADE B', s.grade === 'GRADE B');
}
{
  const s = getGradeFromScore(49);
  expect('49 → ALERTE / DANGER / red-500 / REJECT',
    s.grade === 'ALERTE' && s.status === 'DANGER' && s.color === 'red-500' && s.advice === 'REJECT');
}
{
  const s = getGradeFromScore(15);
  expect('15 (fraude forcée) → ALERTE / REJECT',
    s.grade === 'ALERTE' && s.advice === 'REJECT');
}
{
  const s = getGradeFromScore(0);
  expect('0 → ALERTE', s.grade === 'ALERTE');
}

// ═════════════════════════════════════════════════════════════════════════════
// computeResilienceIndex — orchestrateur complet
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n[T5] Dossier parfait → 100, GRADE S, GO_FAST');
{
  const result = computeResilienceIndex(makeAnalysis());
  expect('score = 100', result.score === 100, `got ${result.score}`);
  expect('grade GRADE S', result.grade === 'GRADE S');
  expect('decision GO_FAST', result.decision === 'GO_FAST');
  expect('color emerald-600', result.color === 'emerald-600');
  expect('finalVerdict recommended', result.finalVerdict === 'recommended');
  expect('aucun hard gate', result.hardGates.length === 0);
  expect('breakdown financial=40', result.breakdown.financialStability === 40);
  expect('breakdown authenticity=40', result.breakdown.documentAuthenticity === 40);
  expect('breakdown professional=20', result.breakdown.professionalReliability === 20);
  expect('breakdown rawScore=100', result.breakdown.rawScore === 100);
}

console.log('\n[T6] Fraude détectée → 15, ALERTE, REJECT (peu importe les subscores)');
{
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: true, isDossierComplete: true, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
      ownerRecommendation: { decisionAdvice: 'GO_FAST', actionPlan: ['Écarter.'] },
    }),
  );
  expect('score = 15', result.score === 15, `got ${result.score}`);
  expect('grade ALERTE', result.grade === 'ALERTE');
  expect('decision REJECT', result.decision === 'REJECT');
  expect('color red-500', result.color === 'red-500');
  expect('finalVerdict risky', result.finalVerdict === 'risky');
  expect('hard gate fraude présent',
    result.hardGates.some((g) => g.toLowerCase().includes('fraude')));
  // Le LLM disait GO_FAST mais l'algo prime → algo est l'autorité
}

console.log('\n[T7] Dossier incomplet + subscores parfaits → 65 (plafond), GRADE B');
{
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: false, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    }),
  );
  expect('score = 65 (impossible 95/100 sans CNI)',
    result.score === 65, `got ${result.score}`);
  expect('grade GRADE B', result.grade === 'GRADE B');
  expect('decision MANUAL_CHECK', result.decision === 'MANUAL_CHECK');
  expect('hard gate dossier incomplet présent',
    result.hardGates.some((g) => g.toLowerCase().includes('incomplet')));
}

console.log('\n[T8] Authenticité=0 (sans flag fraude) → naturellement plafonné par les poids');
{
  // 10×4 + 0×4 + 10×2 = 40+0+20 = 60 → GRADE B
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: true, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 0, professionalReliability: 10 },
    }),
  );
  expect('score = 60 (40 + 0 + 20)', result.score === 60, `got ${result.score}`);
  expect('grade GRADE B', result.grade === 'GRADE B');
  expect('decision MANUAL_CHECK', result.decision === 'MANUAL_CHECK');
}

console.log('\n[T9] isIncomeSufficient ignoré par l\'algo (V2)');
{
  // En V2, isIncomeSufficient n'est pas dans ScoringFlags — la pondération suffit
  const resWithIncome = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: true, isIncomeSufficient: true },
      subScores: { financialStability: 8, documentAuthenticity: 8, professionalReliability: 8 },
    }),
  );
  const resWithoutIncome = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: true, isIncomeSufficient: false },
      subScores: { financialStability: 8, documentAuthenticity: 8, professionalReliability: 8 },
    }),
  );
  expect('score identique avec/sans isIncomeSufficient (algo ne pénalise plus)',
    resWithIncome.score === resWithoutIncome.score,
    `${resWithIncome.score} vs ${resWithoutIncome.score}`);
  // 8×4 + 8×4 + 8×2 = 32+32+16 = 80 → GRADE A
  expect('score = 80 (GRADE A)', resWithIncome.score === 80);
}

console.log('\n[T10] LLM REJECT mais subscores parfaits → algo prime (GRADE S, GO_FAST)');
{
  // En V2, la décision dérive du grade — l'avis du LLM n'override plus
  const result = computeResilienceIndex(
    makeAnalysis({
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
      ownerRecommendation: { decisionAdvice: 'REJECT', actionPlan: ['Test.'] },
    }),
  );
  expect('decision = GO_FAST (algo prime, ignore LLM REJECT)',
    result.decision === 'GO_FAST', `got ${result.decision}`);
  expect('grade GRADE S', result.grade === 'GRADE S');
}

console.log('\n[T11] Score 78 (GRADE A) → MANUAL_CHECK (plus de GO_FAST hors GRADE S)');
{
  // 8×4 + 7×4 + 9×2 = 78 → GRADE A → MANUAL_CHECK (V2 : seul GRADE S obtient GO_FAST)
  const result = computeResilienceIndex(
    makeAnalysis({
      subScores: { financialStability: 8, documentAuthenticity: 7, professionalReliability: 9 },
    }),
  );
  expect('score = 78', result.score === 78, `got ${result.score}`);
  expect('grade GRADE A', result.grade === 'GRADE A');
  expect('decision MANUAL_CHECK (pas GO_FAST en GRADE A)',
    result.decision === 'MANUAL_CHECK');
  expect('finalVerdict review', result.finalVerdict === 'review');
}

console.log('\n[T12] Cumul fraude + incomplet → fraude prime (score=15)');
{
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: true, isDossierComplete: false, isIncomeSufficient: false },
      subScores: { financialStability: 5, documentAuthenticity: 0, professionalReliability: 5 },
    }),
  );
  expect('score = 15 (fraude prime)', result.score === 15, `got ${result.score}`);
  expect('grade ALERTE', result.grade === 'ALERTE');
  expect('hard gate fraude présent',
    result.hardGates.some((g) => g.toLowerCase().includes('fraude')));
  // On NE LISTE PAS le hard gate "incomplet" quand la fraude écrase déjà tout
  expect('un seul hard gate listé (fraude écrase incomplet)',
    result.hardGates.length === 1);
}

// ═════════════════════════════════════════════════════════════════════════════
// AIAnalysisSchema — conformité Zod stricte
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n[T13] Schéma forensicAudit : conformité Zod stricte');
{
  const valid = AIAnalysisSchema.safeParse(
    makeAnalysis({
      forensicAudit: [
        { checkName: 'Métadonnées PDF', status: 'VERIFIED', details: 'OK.' },
        { checkName: 'Édition', status: 'WARNING', details: 'Photoshop détecté.' },
        { checkName: 'Math', status: 'ALERT', details: 'Cumul faux.' },
      ],
    }),
  );
  expect('safeParse OK avec 3 contrôles forensic valides',
    valid.success, valid.success ? undefined : valid.error.message);

  const invalid = AIAnalysisSchema.safeParse({
    ...makeAnalysis(),
    forensicAudit: [{ checkName: 'X', status: 'GREEN', details: 'Test.' }],
  } as unknown);
  expect('safeParse rejette un status hors enum (GREEN)', !invalid.success);

  const missingField = AIAnalysisSchema.safeParse({
    ...makeAnalysis(),
    forensicAudit: [{ checkName: 'X', status: 'VERIFIED' }],
  } as unknown);
  expect('safeParse rejette un contrôle sans details', !missingField.success);

  const emptyOk = AIAnalysisSchema.safeParse(
    makeAnalysis({ forensicAudit: [] }),
  );
  expect('safeParse accepte forensicAudit vide (consigne LLM uniquement)',
    emptyOk.success);
}

console.log(`\n══════════════════════════════════════`);
console.log(`Tests passés : ${passed}`);
console.log(`Tests échoués : ${failed}`);
console.log(`══════════════════════════════════════\n`);

if (failed > 0) {
  process.exit(1);
}
