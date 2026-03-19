const test = require('node:test');
const assert = require('node:assert/strict');

const { computeApplicationPatrimometer } = require('../src/utils/applicationScoring');
const { buildPassportViewModel } = require('../src/utils/passportViewModel');

function buildDoc({
  id,
  category = 'income',
  subjectType = 'tenant',
  subjectSlot,
  type,
  status = 'certified',
  fileName,
  dateEmission,
  flagged = false,
  aiAnalysis,
}) {
  return {
    id,
    category,
    subjectType,
    subjectSlot,
    type,
    fileName: fileName || `${type}_${id}.pdf`,
    status,
    flagged,
    dateEmission,
    uploadedAt: dateEmission || '2026-03-16T10:00:00.000Z',
    aiAnalysis,
  };
}

function buildApplication({
  candidateStatus = 'Salarie',
  diditStatus = 'VERIFIED',
  propertyRentAmount = 1000,
  detectedIncome = 3800,
  guarantee = { mode: 'NONE' },
  documents = [],
  status = 'IN_PROGRESS',
  firstName = 'Alice',
  lastName = 'Martin',
} = {}) {
  const computed = computeApplicationPatrimometer({
    candidateStatus,
    diditStatus: diditStatus.toLowerCase(),
    propertyRentAmount,
    detectedIncome,
    guarantee,
    documents,
  });

  return {
    _id: '67d6e8f0c0ffee1234567890',
    status,
    profile: {
      firstName,
      lastName,
      status: candidateStatus,
    },
    didit: {
      status: diditStatus,
      verifiedAt: '2026-03-16T09:00:00.000Z',
      identityData: {
        firstName,
        lastName,
      },
    },
    documents,
    guarantee: computed.guarantee,
    financialSummary: {
      totalMonthlyIncome: detectedIncome,
      certifiedIncome: true,
    },
    patrimometer: {
      score: computed.score,
      grade: computed.grade,
      breakdown: computed.breakdown,
      warnings: computed.warnings,
      nextAction: computed.nextAction,
      chapterStates: computed.chapterStates,
    },
    property: {
      name: 'Appartement Rivoli',
      address: 'Paris, Ile-de-France',
      rentAmount: propertyRentAmount,
    },
    passportSlug: 'alice-martin-demo',
    passportViewCount: 2,
    passportShareCount: 1,
    createdAt: '2026-03-15T10:00:00.000Z',
    updatedAt: '2026-03-16T10:30:00.000Z',
  };
}

function buildStrongTenantDocs() {
  return [
    buildDoc({ id: 'id', category: 'identity', type: 'CARTE_IDENTITE', dateEmission: '2026-03-01' }),
    buildDoc({ id: 'salary-1', type: 'BULLETIN_SALAIRE', dateEmission: '2026-02-28' }),
    buildDoc({ id: 'salary-2', type: 'BULLETIN_SALAIRE', dateEmission: '2026-01-28' }),
    buildDoc({ id: 'salary-3', type: 'BULLETIN_SALAIRE', dateEmission: '2025-12-28' }),
    buildDoc({ id: 'tax', type: 'AVIS_IMPOSITION', dateEmission: '2025-09-01' }),
    buildDoc({ id: 'employment', type: 'ATTESTATION_EMPLOYEUR', fileName: 'attestation_employeur.pdf', dateEmission: '2026-03-01' }),
    buildDoc({ id: 'home', category: 'address', type: 'JUSTIFICATIF_DOMICILE', dateEmission: '2026-03-03' }),
  ];
}

test('Passport stays draft when essential tenant blocks are missing', () => {
  const application = buildApplication({
    candidateStatus: 'Salarie',
    diditStatus: 'PENDING',
    detectedIncome: 0,
    documents: [
      buildDoc({ id: 'random', category: 'income', type: 'AUTRE', fileName: 'image_lambda.jpg', status: 'needs_review' }),
    ],
  });

  const passport = buildPassportViewModel({
    application,
    audience: 'candidate',
    baseUrl: 'https://doc2loc.com',
    slug: application.passportSlug,
  });

  assert.equal(passport.state, 'draft');
  assert.equal(passport.shareEnabled, false);
  assert.ok(passport.readinessReasons.some((reason) => reason.includes('Identité')));
});

test('Passport enters review when a secondary document remains under manual review', () => {
  const application = buildApplication({
    documents: [
      ...buildStrongTenantDocs(),
      buildDoc({ id: 'optional-income', type: 'ATTESTATION_BOURSE', status: 'needs_review', dateEmission: '2026-03-05' }),
    ],
  });

  const passport = buildPassportViewModel({
    application,
    audience: 'candidate',
    baseUrl: 'https://doc2loc.com',
    slug: application.passportSlug,
  });

  assert.equal(passport.state, 'review');
  assert.equal(passport.shareEnabled, false);
  assert.ok(passport.readinessReasons.some((reason) => reason.includes('Revenus') || reason.includes('Garantie') || reason.includes('revue')));
});

test('Passport becomes ready when the dossier is complete and stable', () => {
  const application = buildApplication({
    documents: buildStrongTenantDocs(),
  });

  const passport = buildPassportViewModel({
    application,
    audience: 'candidate',
    baseUrl: 'https://doc2loc.com',
    slug: application.passportSlug,
  });

  assert.equal(passport.state, 'ready');
  assert.equal(passport.shareEnabled, true);
  assert.equal(passport.previewUrl, 'https://doc2loc.com/p/alice-martin-demo?preview=1');
  assert.equal(passport.shareUrl, 'https://doc2loc.com/p/alice-martin-demo');
});

test('Passport becomes sealed after submission without changing the public model shape', () => {
  const application = buildApplication({
    documents: buildStrongTenantDocs(),
    status: 'SUBMITTED',
  });

  const passport = buildPassportViewModel({
    application,
    audience: 'candidate',
    baseUrl: 'https://doc2loc.com',
    slug: application.passportSlug,
  });

  assert.equal(passport.state, 'sealed');
  assert.equal(passport.shareEnabled, true);
  assert.equal(passport.metrics.passportId, 'PT-2026-34567890');
});

test('Public audience masks identity and rounds income', () => {
  const application = buildApplication({
    documents: buildStrongTenantDocs(),
    firstName: 'Camille',
    lastName: 'Durand',
    detectedIncome: 3865,
  });

  const passport = buildPassportViewModel({
    application,
    audience: 'public',
    baseUrl: 'https://doc2loc.com',
    slug: application.passportSlug,
  });

  assert.equal(passport.hero.name, 'Camille D.');
  assert.equal(passport.solvency.monthlyIncome, 3900);
  assert.equal(passport.hero.region, 'Paris, Ile-de-France');
});
