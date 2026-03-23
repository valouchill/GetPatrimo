const test = require('node:test');
const assert = require('node:assert/strict');

const { computeApplicationPatrimometer } = require('../src/utils/applicationScoring');
const { buildOwnerApplicationInsights } = require('../src/utils/ownerApplicationInsights');

function buildDoc({
  id,
  category = 'INCOME',
  subjectType = 'TENANT',
  subjectSlot,
  type,
  status = 'CERTIFIED',
  fileName,
  dateEmission,
  flagged = false,
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
  };
}

function buildStrongDocs() {
  return [
    buildDoc({ id: 'id', category: 'IDENTITY', type: 'CARTE_IDENTITE', dateEmission: '2026-03-01' }),
    buildDoc({ id: 'salary-1', type: 'BULLETIN_SALAIRE', dateEmission: '2026-02-28' }),
    buildDoc({ id: 'salary-2', type: 'BULLETIN_SALAIRE', dateEmission: '2026-01-28' }),
    buildDoc({ id: 'salary-3', type: 'BULLETIN_SALAIRE', dateEmission: '2025-12-28' }),
    buildDoc({ id: 'tax', type: 'AVIS_IMPOSITION', dateEmission: '2025-09-01' }),
    buildDoc({ id: 'employment', type: 'ATTESTATION_EMPLOYEUR', fileName: 'attestation_employeur.pdf', dateEmission: '2026-03-01' }),
    buildDoc({ id: 'home', category: 'ADDRESS', type: 'JUSTIFICATIF_DOMICILE', dateEmission: '2026-03-03' }),
  ];
}

function buildApplication({
  candidateStatus = 'Salarie',
  diditStatus = 'VERIFIED',
  propertyRentAmount = 1000,
  detectedIncome = 3800,
  guarantee = { mode: 'NONE' },
  documents = [],
  status = 'COMPLETE',
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
      firstName: 'Alice',
      lastName: 'Martin',
      status: candidateStatus,
      phone: '0600000000',
    },
    userEmail: 'alice@example.com',
    didit: {
      status: diditStatus,
      verifiedAt: '2026-03-16T09:00:00.000Z',
      identityData: {
        firstName: 'Alice',
        lastName: 'Martin',
      },
    },
    documents,
    guarantee: computed.guarantee,
    financialSummary: {
      totalMonthlyIncome: detectedIncome,
      certifiedIncome: true,
      incomeSource: 'SALARY',
    },
    patrimometer: {
      score: computed.score,
      grade: computed.grade,
      breakdown: computed.breakdown,
      warnings: computed.warnings,
      nextAction: computed.nextAction,
      chapterStates: computed.chapterStates,
    },
    passportSlug: 'alice-martin-demo',
    passportViewCount: 2,
    passportShareCount: 1,
    createdAt: '2026-03-15T10:00:00.000Z',
    updatedAt: '2026-03-16T10:30:00.000Z',
  };
}

test('owner insights mark a strong dossier as clear and lease-ready', () => {
  const application = buildApplication({
    propertyRentAmount: 980,
    detectedIncome: 4200,
    documents: buildStrongDocs(),
  });

  const insights = buildOwnerApplicationInsights({
    application,
    property: {
      rentAmount: 980,
      address: 'Paris',
      name: 'Appartement Rivoli',
    },
    baseUrl: 'https://doc2loc.com',
    isSealed: false,
  });

  assert.equal(insights.aiAudit.status, 'CLEAR');
  assert.equal(insights.contractReadiness.ready, true);
  assert.equal(insights.tunnel.steps.find((step) => step.id === 'lease').status, 'ready');
  assert.equal(insights.passport.state, 'ready');
  assert.equal(insights.decisionSummary.readyToLease, true);
  assert.equal(insights.comparison.identityVerifiedLabel, 'Oui');
  assert.match(insights.decisionSummary.headline, /rassurant/i);
});

test('owner insights keep a dossier in review when secondary pieces remain under review', () => {
  const application = buildApplication({
    documents: [
      ...buildStrongDocs(),
      buildDoc({ id: 'optional-income', type: 'ATTESTATION_BOURSE', status: 'NEEDS_REVIEW', dateEmission: '2026-03-05' }),
    ],
  });

  const insights = buildOwnerApplicationInsights({
    application,
    property: {
      rentAmount: 1000,
      address: 'Lyon',
      name: 'Quai de Saone',
    },
    baseUrl: 'https://doc2loc.com',
    isSealed: false,
  });

  assert.equal(insights.aiAudit.status, 'REVIEW');
  assert.equal(insights.passport.state, 'review');
  assert.ok((insights.aiAudit.reviewReasons || []).length > 0);
  assert.ok((insights.decisionSummary.watchouts || []).length > 0);
  assert.equal(insights.comparison.auditLabel, 'Revue conseillée');
});

test('owner insights block lease readiness when identity is not verified and core blocks are missing', () => {
  const application = buildApplication({
    diditStatus: 'PENDING',
    detectedIncome: 0,
    documents: [
      buildDoc({ id: 'random', category: 'income', type: 'AUTRE', fileName: 'random.jpg', status: 'NEEDS_REVIEW' }),
    ],
  });

  const insights = buildOwnerApplicationInsights({
    application,
    property: {
      rentAmount: 1200,
      address: 'Marseille',
      name: 'Residence Sud',
    },
    baseUrl: 'https://doc2loc.com',
    isSealed: false,
  });

  assert.equal(insights.aiAudit.status, 'ALERT');
  assert.equal(insights.contractReadiness.ready, false);
  assert.ok(insights.contractReadiness.blockers.some((blocker) => blocker.includes('identité') || blocker.includes('Identité')));
  assert.equal(insights.tunnel.steps.find((step) => step.id === 'lease').status, 'blocked');
  assert.equal(insights.decisionSummary.readyToLease, false);
  assert.equal(insights.comparison.readyToLeaseLabel, 'À compléter');
});

test('owner insights rebuild monthly income from certified payslips when the stored summary is empty', () => {
  const application = buildApplication({
    propertyRentAmount: 1100,
    detectedIncome: 0,
    documents: buildStrongDocs().map((doc, index) => {
      if (doc.type !== 'BULLETIN_SALAIRE') return doc;
      const nets = [2480, 2520, 2500];
      return {
        ...doc,
        aiAnalysis: {
          financial_data: {
            monthly_net_income: nets[index - 1],
            extra_details: {
              salaire_brut_mensuel: 3200,
              cotisations_mensuelles: 3200 - nets[index - 1],
            },
          },
        },
      };
    }),
  });

  application.financialSummary = {
    totalMonthlyIncome: 0,
    certifiedIncome: false,
    incomeSource: '',
  };

  const insights = buildOwnerApplicationInsights({
    application,
    property: {
      rentAmount: 1100,
      address: 'Nantes',
      name: 'Place Royale',
    },
    baseUrl: 'https://doc2loc.com',
    isSealed: false,
  });

  assert.equal(insights.financial.monthlyIncomeLabel, '2 500 €');
  assert.equal(insights.financial.incomeSource, 'SALARY');
  assert.match(insights.financial.summary, /Base de calcul retenue/i);
  assert.equal(insights.comparison.monthlyIncomeLabel, '2 500 €');
});
