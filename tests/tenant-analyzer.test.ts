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

console.log('\n[T4] getGradeFromScore : 4 paliers métaux précieux');
{
  const s = getGradeFromScore(100);
  expect('100 → PLATINUM / SUCCESS / GO_FAST',
    s.level === 'PLATINUM' && s.status === 'SUCCESS' && s.advice === 'GO_FAST');
  expect('100 → color PLATINUM (slate-900 + amber-500)',
    s.color === 'bg-slate-900 text-amber-500 ring-slate-800');
}
{
  const s = getGradeFromScore(90);
  expect('90 (borne basse) → PLATINUM', s.level === 'PLATINUM');
}
{
  const s = getGradeFromScore(89);
  expect('89 → GOLD / SUCCESS / MANUAL_CHECK',
    s.level === 'GOLD' && s.status === 'SUCCESS' && s.advice === 'MANUAL_CHECK');
  expect('89 → color GOLD (amber-100)',
    s.color === 'bg-amber-100 text-amber-800 ring-amber-200');
}
{
  const s = getGradeFromScore(75);
  expect('75 (borne basse) → GOLD', s.level === 'GOLD');
}
{
  const s = getGradeFromScore(74);
  expect('74 → SILVER / WARNING / MANUAL_CHECK',
    s.level === 'SILVER' && s.status === 'WARNING' && s.advice === 'MANUAL_CHECK');
  expect('74 → color SILVER (slate-100)',
    s.color === 'bg-slate-100 text-slate-700 ring-slate-200');
}
{
  const s = getGradeFromScore(50);
  expect('50 (borne basse) → SILVER', s.level === 'SILVER');
}
{
  const s = getGradeFromScore(49);
  expect('49 → ALERTE / DANGER / REJECT',
    s.level === 'ALERTE' && s.status === 'DANGER' && s.advice === 'REJECT');
  expect('49 → color ALERTE (red-50)',
    s.color === 'bg-red-50 text-red-700 ring-red-200');
}
{
  const s = getGradeFromScore(15);
  expect('15 (fraude forcée) → ALERTE / REJECT',
    s.level === 'ALERTE' && s.advice === 'REJECT');
}
{
  const s = getGradeFromScore(0);
  expect('0 → ALERTE', s.level === 'ALERTE');
}

// ═════════════════════════════════════════════════════════════════════════════
// computeResilienceIndex — orchestrateur complet
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n[T5] Dossier parfait → 100, PLATINUM, GO_FAST');
{
  const result = computeResilienceIndex(makeAnalysis());
  expect('score = 100', result.score === 100, `got ${result.score}`);
  expect('level PLATINUM', result.level === 'PLATINUM');
  expect('decision GO_FAST', result.decision === 'GO_FAST');
  expect('color = badge PLATINUM (slate-900 + amber-500)',
    result.color === 'bg-slate-900 text-amber-500 ring-slate-800');
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
  expect('level ALERTE', result.level === 'ALERTE');
  expect('decision REJECT', result.decision === 'REJECT');
  expect('color = badge ALERTE (red-50)',
    result.color === 'bg-red-50 text-red-700 ring-red-200');
  expect('finalVerdict risky', result.finalVerdict === 'risky');
  expect('hard gate fraude présent',
    result.hardGates.some((g) => g.toLowerCase().includes('fraude')));
  // Le LLM disait GO_FAST mais l'algo prime → algo est l'autorité
}

console.log('\n[T7] Dossier incomplet + subscores parfaits → 65 (plafond), SILVER');
{
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: false, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    }),
  );
  expect('score = 65 (impossible 95/100 sans CNI)',
    result.score === 65, `got ${result.score}`);
  expect('level SILVER', result.level === 'SILVER');
  expect('decision MANUAL_CHECK', result.decision === 'MANUAL_CHECK');
  expect('hard gate dossier incomplet présent',
    result.hardGates.some((g) => g.toLowerCase().includes('incomplet')));
}

console.log('\n[T8] Authenticité=0 (sans flag fraude) → naturellement plafonné par les poids');
{
  // 10×4 + 0×4 + 10×2 = 40+0+20 = 60 → SILVER
  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: true, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 0, professionalReliability: 10 },
    }),
  );
  expect('score = 60 (40 + 0 + 20)', result.score === 60, `got ${result.score}`);
  expect('level SILVER', result.level === 'SILVER');
  expect('decision MANUAL_CHECK', result.decision === 'MANUAL_CHECK');
}

console.log('\n[T9] isIncomeSufficient ignoré par l\'algo');
{
  // isIncomeSufficient n'est pas dans ScoringFlags — la pondération suffit
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
  // 8×4 + 8×4 + 8×2 = 32+32+16 = 80 → GOLD
  expect('score = 80 (GOLD)', resWithIncome.score === 80);
  expect('level GOLD', resWithIncome.level === 'GOLD');
}

console.log('\n[T10] LLM REJECT mais subscores parfaits → algo prime (PLATINUM, GO_FAST)');
{
  // La décision dérive du niveau — l'avis du LLM n'override plus
  const result = computeResilienceIndex(
    makeAnalysis({
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
      ownerRecommendation: { decisionAdvice: 'REJECT', actionPlan: ['Test.'] },
    }),
  );
  expect('decision = GO_FAST (algo prime, ignore LLM REJECT)',
    result.decision === 'GO_FAST', `got ${result.decision}`);
  expect('level PLATINUM', result.level === 'PLATINUM');
}

console.log('\n[T11] Score 78 (GOLD) → MANUAL_CHECK (seul PLATINUM ouvre GO_FAST)');
{
  // 8×4 + 7×4 + 9×2 = 78 → GOLD → MANUAL_CHECK (seul PLATINUM ≥90 obtient GO_FAST)
  const result = computeResilienceIndex(
    makeAnalysis({
      subScores: { financialStability: 8, documentAuthenticity: 7, professionalReliability: 9 },
    }),
  );
  expect('score = 78', result.score === 78, `got ${result.score}`);
  expect('level GOLD', result.level === 'GOLD');
  expect('decision MANUAL_CHECK (pas GO_FAST en GOLD)',
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
  expect('level ALERTE', result.level === 'ALERTE');
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

// ═════════════════════════════════════════════════════════════════════════════
// V8.2 — Exception biométrique Didit (eIDAS)
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n[T14] Biométrie Didit + dossier incomplet → PAS de plafond 65');
{
  // 10/10/10 = 100, incomplet, MAIS biométrie validée → pas de cap (reste 100)
  const score = calculateFinalScore(
    { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    { isFraudDetected: false, isDossierComplete: false, isBiometricVerified: true },
  );
  expect('biométrie + incomplet → 100 (plafond CNI levé)', score === 100, `got ${score}`);

  const result = computeResilienceIndex(
    makeAnalysis({
      flags: { isFraudDetected: false, isDossierComplete: false, isIncomeSufficient: true },
      subScores: { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    }),
    { isBiometricVerified: true },
  );
  expect('computeResilienceIndex biométrie → 100', result.score === 100, `got ${result.score}`);
  expect('level PLATINUM (pas SILVER)', result.level === 'PLATINUM');
  expect('hard gate biométrie présent',
    result.hardGates.some((g) => g.toLowerCase().includes('biométrique') || g.toLowerCase().includes('eidas')));
  expect('pas de hard gate "incomplet"',
    !result.hardGates.some((g) => g.toLowerCase().includes('incomplet')));
}

console.log('\n[T15] SANS biométrie + dossier incomplet → plafond 65 (régression)');
{
  // Même dossier mais SANS biométrie → le cap 65 s'applique toujours
  const score = calculateFinalScore(
    { financialStability: 10, documentAuthenticity: 10, professionalReliability: 10 },
    { isFraudDetected: false, isDossierComplete: false, isBiometricVerified: false },
  );
  expect('sans biométrie + incomplet → 65 (cap maintenu)', score === 65, `got ${score}`);
}

console.log('\n[T16] Biométrie NE COUVRE PAS la fraude (paie falsifiée) → 15');
{
  // Biométrie validée MAIS fraude détectée sur fiche de paie → toujours ALERTE
  const score = calculateFinalScore(
    { financialStability: 10, documentAuthenticity: 0, professionalReliability: 10 },
    { isFraudDetected: true, isDossierComplete: true, isBiometricVerified: true },
  );
  expect('biométrie + fraude → 15 (la biométrie n\'excuse pas la fraude)', score === 15, `got ${score}`);
}

console.log(`\n══════════════════════════════════════`);
console.log(`Tests passés : ${passed}`);
console.log(`Tests échoués : ${failed}`);
console.log(`══════════════════════════════════════\n`);

if (failed > 0) {
  process.exit(1);
}
