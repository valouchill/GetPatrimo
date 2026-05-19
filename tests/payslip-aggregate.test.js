// tests/payslip-aggregate.test.js
// Tests de l'agrégation des bulletins de paie (Phase BB)

const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregatePayslips, median, stdDeviation } = require('../src/utils/financialExtraction');

// ── Helpers ────────────────────────────────────────────────────────────────

function payslip(amount, status = 'CERTIFIED', dateOffset = 0, extra = {}) {
  // dateOffset = mois en arrière par rapport à mars 2026
  const d = new Date(2026, 2 - dateOffset, 15);
  return {
    amount,
    status,
    date: d.toISOString(),
    period: `${['Janvier','Février','Mars','Avril','Mai'][2 - dateOffset] || 'Inconnu'} 2026`,
    source: extra.source || 'ai_direct',
    confidence: extra.confidence || 0.9,
  };
}

// ── median / stdDev ────────────────────────────────────────────────────────

test('median: nombre pair → moyenne des 2 centraux', () => {
  assert.equal(median([1000, 2000, 3000, 4000]), 2500);
});

test('median: nombre impair → valeur centrale', () => {
  assert.equal(median([2500, 2480, 2520]), 2500);
});

test('median: ignore les 0', () => {
  assert.equal(median([0, 2500, 2520, 0]), 2510);
});

test('stdDeviation: 0 si tous identiques', () => {
  assert.equal(stdDeviation([2500, 2500, 2500]), 0);
});

test('stdDeviation: > 0 si variabilité', () => {
  assert.ok(stdDeviation([2500, 2400, 2600]) > 0);
});

// ── aggregatePayslips : 4 scénarios principaux ─────────────────────────────

test('agg: 3 bulletins certifiés cohérents → mean retenu, varianceHigh=false', () => {
  const r = aggregatePayslips([
    payslip(2500, 'CERTIFIED', 0),
    payslip(2480, 'CERTIFIED', 1),
    payslip(2520, 'CERTIFIED', 2),
  ]);
  assert.equal(r.mean, 2500);
  assert.equal(r.median, 2500);
  assert.equal(r.varianceHigh, false);
  assert.equal(r.usedMethod, 'mean');
  assert.equal(r.primaryAmount, 2500);
  assert.equal(r.certifiedCount, 3);
  assert.equal(r.breakdown.length, 3);
});

test('agg: 3 bulletins avec outlier (prime) → médiane retenue, varianceHigh=true', () => {
  const r = aggregatePayslips([
    payslip(2500, 'CERTIFIED', 0),
    payslip(2480, 'CERTIFIED', 1),
    payslip(5000, 'CERTIFIED', 2), // prime ou rappel
  ]);
  assert.equal(r.varianceHigh, true);
  assert.equal(r.usedMethod, 'median');
  assert.equal(r.median, 2500);
  assert.equal(r.primaryAmount, 2500);
  assert.ok(r.mean > 2500, 'mean doit être supérieure à 2500 à cause de l\'outlier');
});

test('agg: 1 bulletin certifié + 2 review → utilise les 3', () => {
  const r = aggregatePayslips([
    payslip(2500, 'CERTIFIED', 0),
    payslip(2480, 'NEEDS_REVIEW', 1),
    payslip(2520, 'NEEDS_REVIEW', 2),
  ]);
  assert.equal(r.totalCount, 3);
  assert.equal(r.certifiedCount, 1);
  assert.equal(r.breakdown.length, 3);
  assert.equal(r.primaryAmount, 2500);
});

test('agg: 0 bulletin certifié + 3 review → fallback REVIEW', () => {
  const r = aggregatePayslips([
    payslip(2500, 'NEEDS_REVIEW', 0),
    payslip(2480, 'NEEDS_REVIEW', 1),
    payslip(2520, 'NEEDS_REVIEW', 2),
  ]);
  assert.equal(r.certifiedCount, 0);
  assert.equal(r.breakdown.length, 3);
  assert.equal(r.primaryAmount, 2500);
});

// ── Edge cases ─────────────────────────────────────────────────────────────

test('agg: 1 seul bulletin → primaryAmount = amount, pas de variance', () => {
  const r = aggregatePayslips([payslip(2500, 'CERTIFIED', 0)]);
  assert.equal(r.primaryAmount, 2500);
  assert.equal(r.mean, 2500);
  assert.equal(r.median, 2500);
  assert.equal(r.stdDev, 0);
  assert.equal(r.varianceHigh, false);
});

test('agg: 0 bulletin → all zeros, usedMethod="none"', () => {
  const r = aggregatePayslips([]);
  assert.equal(r.primaryAmount, 0);
  assert.equal(r.usedMethod, 'none');
  assert.deepEqual(r.breakdown, []);
});

test('agg: 5 bulletins → ne garde que 3 plus récents', () => {
  const r = aggregatePayslips([
    payslip(2500, 'CERTIFIED', 0),
    payslip(2480, 'CERTIFIED', 1),
    payslip(2520, 'CERTIFIED', 2),
    payslip(2400, 'CERTIFIED', 3),
    payslip(2350, 'CERTIFIED', 4),
  ]);
  assert.equal(r.breakdown.length, 3);
  // Les 3 plus récents sont conservés (dates plus récentes en tête)
  // payslip(0) = Mars (le plus récent)
  assert.equal(r.breakdown[0].amount, 2500);
});

test('agg: breakdown contient period/source/confidence/status', () => {
  const r = aggregatePayslips([
    payslip(2500, 'CERTIFIED', 0, { source: 'ai_direct', confidence: 0.95 }),
  ]);
  assert.equal(r.breakdown[0].period, 'Mars 2026');
  assert.equal(r.breakdown[0].source, 'ai_direct');
  assert.equal(r.breakdown[0].confidence, 0.95);
  assert.equal(r.breakdown[0].status, 'CERTIFIED');
});

test('agg: variance limite à 5% → mean encore retenu', () => {
  // mean=2500, stdDev assez petit pour varianceRatio < 5%
  const r = aggregatePayslips([
    payslip(2500, 'CERTIFIED', 0),
    payslip(2510, 'CERTIFIED', 1),
    payslip(2490, 'CERTIFIED', 2),
  ]);
  assert.equal(r.varianceHigh, false);
  assert.equal(r.usedMethod, 'mean');
});

test('agg: variance > 5% → bascule en médiane', () => {
  // mean ~2700, stdDev ~245 → varianceRatio ~9% donc > 5%
  const r = aggregatePayslips([
    payslip(2500, 'CERTIFIED', 0),
    payslip(2700, 'CERTIFIED', 1),
    payslip(3000, 'CERTIFIED', 2),
  ]);
  assert.equal(r.varianceHigh, true);
  assert.equal(r.usedMethod, 'median');
});
