const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildExpectedIdentityTarget,
  compareIdentityToExpected,
  extractIdentityCandidate,
} = require('../src/utils/documentSubjectIdentity');

test('buildExpectedIdentityTarget maps guarantor slots and tenant subjects correctly', () => {
  const tenantTarget = buildExpectedIdentityTarget({
    subjectType: 'tenant',
    tenant: { firstName: 'Alice', lastName: 'Martin' },
    guarantorOne: { firstName: 'Paul', lastName: 'Durand' },
    guarantorTwo: { firstName: 'Lea', lastName: 'Bernard' },
  });

  const guarantorTwoTarget = buildExpectedIdentityTarget({
    subjectType: 'guarantor',
    subjectSlot: 2,
    tenant: { firstName: 'Alice', lastName: 'Martin' },
    guarantorOne: { firstName: 'Paul', lastName: 'Durand' },
    guarantorTwo: { firstName: 'Lea', lastName: 'Bernard' },
  });

  assert.deepEqual(tenantTarget, {
    firstName: 'Alice',
    lastName: 'Martin',
    label: 'locataire',
  });
  assert.deepEqual(guarantorTwoTarget, {
    firstName: 'Lea',
    lastName: 'Bernard',
    label: 'garant 2',
  });
});

test('extractIdentityCandidate falls back to document owner name when OCR names are absent', () => {
  const identity = extractIdentityCandidate({
    document_metadata: {
      owner_name: 'Claire Dubois',
    },
  });

  assert.equal(identity.firstName, 'Claire');
  assert.equal(identity.lastName, 'Dubois');
  assert.equal(identity.fullName, 'Claire Dubois');
});

test('compareIdentityToExpected catches guarantor/tenant swaps', () => {
  const comparison = compareIdentityToExpected(
    { firstName: 'Paul', lastName: 'Durand' },
    { firstName: 'Alice', lastName: 'Martin' }
  );

  assert.equal(comparison.comparable, true);
  assert.equal(comparison.matches, false);
  assert.equal(comparison.confidence, 0);
});

test('compareIdentityToExpected accepts one matching first name among multiple official first names', () => {
  const comparison = compareIdentityToExpected(
    { firstName: 'Jean', lastName: 'Martin' },
    { firstName: 'Jean Marc Pierre', lastName: 'Martin' }
  );

  assert.equal(comparison.comparable, true);
  assert.equal(comparison.matches, true);
  assert.equal(comparison.confidence, 100);
});

test('compareIdentityToExpected accepts a usage first name from a multi-first-name Didit identity', () => {
  const comparison = compareIdentityToExpected(
    { firstName: 'Marc', lastName: 'Martin' },
    { firstName: 'Jean Marc Pierre', lastName: 'Martin' }
  );

  assert.equal(comparison.comparable, true);
  assert.equal(comparison.matches, true);
  assert.equal(comparison.confidence, 100);
});
