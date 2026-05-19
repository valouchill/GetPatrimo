// tests/owner-verdict.test.js
// Tests du verdict propriétaire centralisé serveur (Phase U)
// Couvre les 4 scénarios mentionnés dans le plan V1.3.

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeOwnerVerdict } = require('../src/utils/ownerApplicationInsights');

// ── Helpers ────────────────────────────────────────────────────────────────

function buildContext(overrides = {}) {
  return {
    aiAudit: { status: 'CLEAR' },
    financial: {
      monthlyIncome: 3000,
      certifiedIncome: true,
      effortRate: 28,
    },
    quality: { rejectedDocuments: 0, reviewDocuments: 0 },
    contractReadiness: { blockers: [] },
    guarantee: { mode: 'VISALE' },
    scoringFlags: [],
    hardGateTriggered: false,
    ...overrides,
  };
}

// ── Scénario 1 : score élevé + CLEAR + sans garant + sans certifiedIncome ──
// ATTENDU : verdict 'review' avec NO_CERTIFIED_SOLVENCY + NO_GUARANTEE
test('verdict: score élevé CLEAR sans garant sans certifié → review', () => {
  const v = computeOwnerVerdict(buildContext({
    aiAudit: { status: 'CLEAR' },
    financial: { monthlyIncome: 3500, certifiedIncome: false, effortRate: null },
    guarantee: { mode: 'NONE' },
  }));
  assert.equal(v.verdict, 'review');
  assert.equal(v.verdictLabel, 'À vérifier');
  assert.ok(v.reasonCodes.includes('NO_CERTIFIED_SOLVENCY'),
    `reasonCodes manque NO_CERTIFIED_SOLVENCY : ${v.reasonCodes}`);
  assert.ok(v.reasonCodes.includes('NO_GUARANTEE'),
    `reasonCodes manque NO_GUARANTEE : ${v.reasonCodes}`);
  assert.notEqual(v.verdict, 'recommended');
});

// ── Scénario 2 : salarié solide + Visale + certifiedIncome + effortRate 28% ──
// ATTENDU : verdict 'recommended', reasonCodes vide
test('verdict: salarié CDI + Visale + certifié + effortRate 28% → recommended', () => {
  const v = computeOwnerVerdict(buildContext({
    aiAudit: { status: 'CLEAR' },
    financial: { monthlyIncome: 3000, certifiedIncome: true, effortRate: 28 },
    guarantee: { mode: 'VISALE' },
  }));
  assert.equal(v.verdict, 'recommended');
  assert.equal(v.verdictLabel, 'Recommandé');
  assert.deepEqual(v.reasonCodes, []);
});

// ── Scénario 3 : profil freelance + sans garant + sans certifié ──
// ATTENDU : verdict 'review' (sélection toujours possible)
test('verdict: freelance sans garant sans certifié → review (sélection possible)', () => {
  const v = computeOwnerVerdict(buildContext({
    aiAudit: { status: 'CLEAR' },
    financial: { monthlyIncome: 2500, certifiedIncome: false, effortRate: null },
    guarantee: { mode: 'NONE' },
    scoringFlags: ['limited_profile_no_guarantee'],
  }));
  assert.equal(v.verdict, 'review');
  assert.ok(v.reasonCodes.includes('NO_CERTIFIED_SOLVENCY'));
  assert.ok(v.reasonCodes.includes('NO_GUARANTEE'));
  assert.ok(v.reasonCodes.includes('LIMITED_PROFILE_NO_GUARANTEE'));
});

// ── Scénario 4 : audit ALERT + effortRate 45% ──
// ATTENDU : verdict 'risky', plusieurs reasonCodes bloquants
test('verdict: audit ALERT + effortRate critique → risky', () => {
  const v = computeOwnerVerdict(buildContext({
    aiAudit: { status: 'ALERT' },
    financial: { monthlyIncome: 2000, certifiedIncome: true, effortRate: 45 },
    guarantee: { mode: 'VISALE' },
  }));
  assert.equal(v.verdict, 'risky');
  assert.equal(v.verdictLabel, 'Risqué');
  assert.ok(v.reasonCodes.includes('FORENSIC_ALERT'));
  assert.ok(v.reasonCodes.includes('HIGH_EFFORT_RATE'));
});

// ── Scénarios complémentaires de non-régression ────────────────────────────

test('verdict: pièces essentielles manquantes → risky', () => {
  const v = computeOwnerVerdict(buildContext({
    hardGateTriggered: true,
    financial: { monthlyIncome: 0, certifiedIncome: false, effortRate: null },
  }));
  assert.equal(v.verdict, 'risky');
  assert.ok(v.reasonCodes.includes('MISSING_ESSENTIAL_DOCS'));
});

test('verdict: documents rejetés → risky', () => {
  const v = computeOwnerVerdict(buildContext({
    quality: { rejectedDocuments: 1, reviewDocuments: 0 },
  }));
  assert.equal(v.verdict, 'risky');
  assert.ok(v.reasonCodes.includes('DOCUMENTS_REJECTED'));
});

test('verdict: blockers contractuels → risky', () => {
  const v = computeOwnerVerdict(buildContext({
    contractReadiness: { blockers: ['Document expiré'] },
  }));
  assert.equal(v.verdict, 'risky');
  assert.ok(v.reasonCodes.includes('CONTRACT_BLOCKED'));
});

test('verdict: effortRate dans la zone 33-38% → review (ELEVATED_EFFORT_RATE)', () => {
  const v = computeOwnerVerdict(buildContext({
    financial: { monthlyIncome: 3000, certifiedIncome: true, effortRate: 36 },
    guarantee: { mode: 'VISALE' },
  }));
  assert.equal(v.verdict, 'review');
  assert.ok(v.reasonCodes.includes('ELEVATED_EFFORT_RATE'));
});

test('verdict: garantie PHYSICAL acceptée comme strong', () => {
  const v = computeOwnerVerdict(buildContext({
    guarantee: { mode: 'PHYSICAL' },
  }));
  assert.equal(v.verdict, 'recommended');
});

test('verdict: aucune info financière → risky (MISSING_ESSENTIAL_DOCS)', () => {
  const v = computeOwnerVerdict(buildContext({
    financial: { monthlyIncome: 0, certifiedIncome: false, effortRate: null },
    guarantee: { mode: 'NONE' },
  }));
  assert.equal(v.verdict, 'risky');
  assert.ok(v.reasonCodes.includes('MISSING_ESSENTIAL_DOCS'));
});

test('verdict: audit REVIEW + certifié + Visale → review (AUDIT_REVIEW)', () => {
  const v = computeOwnerVerdict(buildContext({
    aiAudit: { status: 'REVIEW' },
  }));
  assert.equal(v.verdict, 'review');
  assert.ok(v.reasonCodes.includes('AUDIT_REVIEW'));
});
