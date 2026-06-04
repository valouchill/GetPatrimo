const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveResilienceScore } = require('../src/utils/resilienceScore');

test('prioritizes cached V2 resilience score over legacy patrimometer score', () => {
  const resolved = resolveResilienceScore({
    aiAuditV2: {
      resilience: { score: 82, level: 'GOLD' },
      cachedAt: '2026-06-02T10:00:00.000Z',
    },
    patrimometer: { score: 68, grade: 'B' },
  });

  assert.equal(resolved.score, 82);
  assert.equal(resolved.level, 'GOLD');
  assert.equal(resolved.source, 'v2');
  assert.equal(resolved.isV2, true);
  assert.equal(resolved.cachedAt, '2026-06-02T10:00:00.000Z');
});

test('falls back to legacy score when V2 audit is absent', () => {
  const resolved = resolveResilienceScore({
    patrimometer: { score: 68, grade: 'B' },
  });

  assert.equal(resolved.score, 68);
  assert.equal(resolved.level, 'SILVER');
  assert.equal(resolved.source, 'legacy');
  assert.equal(resolved.isV2, false);
});

test('falls back to legacy score when V2 score is malformed', () => {
  const resolved = resolveResilienceScore({
    aiAuditV2: { resilience: { score: 'not-a-score', level: 'PLATINUM' } },
    patrimometer: { score: 61, grade: 'C' },
  });

  assert.equal(resolved.score, 61);
  assert.equal(resolved.level, 'SILVER');
  assert.equal(resolved.source, 'legacy');
});

test('uses serialized resilience block before legacy score when no V2 audit exists', () => {
  const resolved = resolveResilienceScore({
    resilience: { score: 77, level: 'GOLD', source: 'v2' },
    patrimometer: { score: 41, grade: 'D' },
  });

  assert.equal(resolved.score, 77);
  assert.equal(resolved.level, 'GOLD');
  assert.equal(resolved.source, 'v2');
});

test('clamps scores between 0 and 100', () => {
  assert.equal(resolveResilienceScore({ aiAuditV2: { resilience: { score: 140 } } }).score, 100);
  assert.equal(resolveResilienceScore({ aiAuditV2: { resilience: { score: -12 } } }).score, 0);
});
