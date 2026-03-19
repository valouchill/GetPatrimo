const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOwnerPropertyFlow } = require('../src/utils/ownerFlowModel');

function buildCandidate(overrides = {}) {
  return {
    id: overrides.id || 'cand-1',
    isSealed: overrides.isSealed ?? false,
    sealedLabel: overrides.sealedLabel || 'A. B.',
    profile: {
      firstName: overrides.firstName || 'Alice',
      lastName: overrides.lastName || 'Bernard',
    },
    documentsCount: overrides.documentsCount ?? 6,
    certifiedDocumentsCount: overrides.certifiedDocumentsCount ?? 5,
    patrimometer: {
      score: overrides.score ?? 82,
      grade: overrides.grade || 'A',
    },
    passport: {
      state: overrides.passportState || 'ready',
      stateLabel: overrides.passportStateLabel || 'Prêt',
    },
    guarantee: {
      mode: overrides.guaranteeMode || 'PHYSICAL',
    },
    ownerInsights: {
      aiAudit: {
        status: overrides.auditStatus || 'CLEAR',
        summary: overrides.auditSummary || 'Lecture IA cohérente.',
        blockers: overrides.auditBlockers || [],
      },
      financial: {
        remainingIncomeLabel: overrides.remainingIncomeLabel || '1 950 €',
        effortRateLabel: overrides.effortRateLabel || '27.0%',
      },
      guarantee: {
        label: overrides.guaranteeLabel || 'Garant certifié',
      },
      contractReadiness: {
        ready: overrides.contractReady ?? true,
        blockers: overrides.contractBlockers || [],
      },
    },
  };
}

test('buildOwnerPropertyFlow marks empty properties as search', () => {
  const flow = buildOwnerPropertyFlow({
    property: {
      _id: 'prop-search',
      applyToken: 'PT-TEST',
      status: 'AVAILABLE',
      managed: false,
    },
    candidates: [],
  });

  assert.equal(flow.stage, 'search');
  assert.equal(flow.stageLabel, 'Recherche');
  assert.equal(flow.nextAction.label, 'Partager le lien candidat');
  assert.equal(flow.totalCandidates, 0);
  assert.equal(flow.selectionState?.defaultTab, 'overview');
  assert.equal(flow.focusCard?.title, 'Recevoir des dossiers');
});

test('buildOwnerPropertyFlow surfaces sealed primary candidates as a selection-stage unlock action', () => {
  const flow = buildOwnerPropertyFlow({
    property: {
      _id: 'prop-selection',
      status: 'CANDIDATE_SELECTION',
      managed: false,
      applyToken: 'PT-SELECTION',
    },
    candidates: [
      buildCandidate({
        id: 'cand-sealed',
        isSealed: true,
        score: 88,
        passportState: 'sealed',
      }),
      buildCandidate({
        id: 'cand-review',
        isSealed: true,
        score: 64,
        passportState: 'review',
        passportStateLabel: 'En revue',
        auditStatus: 'REVIEW',
        contractReady: false,
      }),
    ],
  });

  assert.equal(flow.stage, 'selection');
  assert.equal(flow.primaryCandidateId, 'cand-sealed');
  assert.equal(flow.sealedCount, 2);
  assert.equal(flow.nextAction.label, 'Accéder aux dossiers complets');
  assert.equal(flow.selectionRequired, true);
  assert.equal(flow.topCandidates?.[0]?.rank, 1);
  assert.equal(flow.topCandidates?.[0]?.isTop3, true);
  assert.equal(flow.selectionState?.defaultTab, 'compare');
  assert.match(flow.alerts[0], /masqu/i);
});

test('buildOwnerPropertyFlow moves accepted dossiers to contract', () => {
  const flow = buildOwnerPropertyFlow({
    property: {
      _id: 'prop-contract',
      status: 'LEASE_IN_PROGRESS',
      managed: true,
      acceptedTenantId: 'cand-accepted',
    },
    candidates: [
      buildCandidate({
        id: 'cand-accepted',
        firstName: 'Camille',
        lastName: 'Martin',
        contractReady: true,
      }),
    ],
  });

  assert.equal(flow.stage, 'contract');
  assert.equal(flow.primaryCandidateId, 'cand-accepted');
  assert.equal(flow.selectedCandidateId, 'cand-accepted');
  assert.equal(flow.nextAction.label, 'Préparer le bail');
  assert.equal(flow.readyToContractCount, 1);
  assert.equal(flow.selectionRequired, false);
});

test('buildOwnerPropertyFlow keeps unlock as primary action when contractual dossier is still sealed', () => {
  const flow = buildOwnerPropertyFlow({
    property: {
      _id: 'prop-contract-locked',
      status: 'LEASE_IN_PROGRESS',
      managed: false,
      acceptedTenantId: 'cand-locked',
    },
    candidates: [
      buildCandidate({
        id: 'cand-locked',
        isSealed: true,
        score: 90,
        contractReady: true,
      }),
    ],
  });

  assert.equal(flow.stage, 'contract');
  assert.equal(flow.nextAction.label, 'Accéder au dossier complet');
  assert.equal(flow.nextAction.kind, 'unlock');
  assert.equal(flow.selectionState?.defaultTab, 'selected');
});

test('buildOwnerPropertyFlow keeps unlocked properties in selection until the owner chooses explicitly', () => {
  const flow = buildOwnerPropertyFlow({
    property: {
      _id: 'prop-unlocked-selection',
      status: 'CANDIDATE_SELECTION',
      managed: true,
      acceptedTenantId: null,
    },
    candidates: [
      buildCandidate({
        id: 'cand-top',
        firstName: 'Lea',
        lastName: 'Moreau',
        score: 91,
        contractReady: true,
      }),
      buildCandidate({
        id: 'cand-2',
        firstName: 'Noah',
        lastName: 'Petit',
        score: 78,
      }),
    ],
  });

  assert.equal(flow.stage, 'selection');
  assert.equal(flow.unlocked, true);
  assert.equal(flow.selectionRequired, true);
  assert.equal(flow.nextAction.label, 'Comparer les finalistes');
  assert.match(flow.summary, /comparez|choisi/i);
  assert.ok(flow.alerts.length >= 1);
  assert.equal(flow.selectionState?.mode, 'compare');
  assert.ok(String(flow.compareHref || '').includes('tab=compare'));
});

test('buildOwnerPropertyFlow exposes management summaries for occupied properties', () => {
  const flow = buildOwnerPropertyFlow({
    property: {
      _id: 'prop-managed',
      status: 'OCCUPIED',
      managed: true,
      acceptedTenantId: 'cand-occupied',
    },
    candidates: [
      buildCandidate({
        id: 'cand-occupied',
        firstName: 'Ines',
        lastName: 'Durand',
        guaranteeLabel: 'Visale certifiée',
        guaranteeMode: 'VISALE',
      }),
    ],
  });

  assert.equal(flow.stage, 'management');
  assert.equal(flow.nextAction.label, 'Ouvrir la gestion');
  assert.equal(flow.managementSummary.tenantLabel, 'Ines Durand');
  assert.match(flow.managementSummary.summary, /gestion locative/i);
});
