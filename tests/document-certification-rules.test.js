const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getChecklistIdForDocumentType,
  getDocumentCertificationDecision,
  inferAnalysisDocumentTypeFromSignals,
  isChecklistItemCompatibleWithUploadCategory,
  normalizeAnalysisDocumentType,
} = require('../src/utils/documentCertificationRules');

test('normalizeAnalysisDocumentType recognises normalized legacy labels', () => {
  assert.equal(normalizeAnalysisDocumentType('carte_identite'), 'CARTE_IDENTITE');
  assert.equal(normalizeAnalysisDocumentType('bulletin_salaire'), 'BULLETIN_SALAIRE');
  assert.equal(normalizeAnalysisDocumentType('avis d\'imposition'), 'AVIS_IMPOSITION');
  assert.equal(normalizeAnalysisDocumentType('attestation assurance habitation'), 'JUSTIFICATIF_DOMICILE');
  assert.equal(normalizeAnalysisDocumentType('avis d\'échéance'), 'JUSTIFICATIF_DOMICILE');
  assert.equal(normalizeAnalysisDocumentType('facture orange fibre'), 'JUSTIFICATIF_DOMICILE');
});

test('getChecklistIdForDocumentType maps AI types to the correct upload checklist', () => {
  assert.equal(getChecklistIdForDocumentType('CARTE_IDENTITE', 'identity'), 'cni');
  assert.equal(getChecklistIdForDocumentType('BULLETIN_SALAIRE', 'resources'), 'salaire');
  assert.equal(getChecklistIdForDocumentType('BULLETIN_SALAIRE', 'guarantor'), 'garant_salaires');
  assert.equal(getChecklistIdForDocumentType('JUSTIFICATIF_DOMICILE', 'resources'), 'domicile');
});

test('isChecklistItemCompatibleWithUploadCategory rejects hints from the wrong bucket', () => {
  assert.equal(
    isChecklistItemCompatibleWithUploadCategory({ id: 'cni', category: 'Identité' }, 'resources'),
    false
  );
  assert.equal(
    isChecklistItemCompatibleWithUploadCategory({ id: 'domicile', category: 'Domicile' }, 'resources'),
    true
  );
});

test('unrelated files are rejected instead of certified', () => {
  const decision = getDocumentCertificationDecision({
    uploadCategory: 'resources',
    aiDocumentType: 'AUTRE',
    fraudScore: 0,
    hasCompatibleChecklistHint: false,
  });

  assert.equal(decision.status, 'REJECTED');
  assert.equal(decision.flagged, false);
  assert.equal(decision.canForceSend, false);
  assert.equal(decision.isRelevantDocument, false);
});

test('recognized documents in the right category can be certified', () => {
  const decision = getDocumentCertificationDecision({
    uploadCategory: 'resources',
    aiDocumentType: 'BULLETIN_SALAIRE',
    fraudScore: 6,
    needsHumanReview: false,
    partialExtraction: false,
    hasCompatibleChecklistHint: true,
  });

  assert.equal(decision.status, 'CERTIFIED');
  assert.equal(decision.flagged, false);
  assert.equal(decision.categoryMatch, true);
});

test('ambiguous but plausible documents are routed to review instead of certified', () => {
  const decision = getDocumentCertificationDecision({
    uploadCategory: 'identity',
    aiDocumentType: 'AUTRE',
    fraudScore: 8,
    needsHumanReview: false,
    partialExtraction: true,
    hasCompatibleChecklistHint: true,
  });

  assert.equal(decision.status, 'NEEDS_REVIEW');
  assert.equal(decision.canForceSend, true);
  assert.equal(decision.flagged, false);
});

test('category mismatches are rejected with a helpful message', () => {
  const decision = getDocumentCertificationDecision({
    uploadCategory: 'identity',
    aiDocumentType: 'BULLETIN_SALAIRE',
    fraudScore: 0,
    hasCompatibleChecklistHint: false,
  });

  assert.equal(decision.status, 'REJECTED');
  assert.match(decision.reason, /Identite/i);
});

test('inferAnalysisDocumentTypeFromSignals rescues proof of address documents from weak AI labels', () => {
  const inferredFromFileName = inferAnalysisDocumentTypeFromSignals({
    aiDocumentType: 'AUTRE',
    fileName: 'attestation_assurance_habitation_mars_2026.pdf',
  });

  const inferredFromSignals = inferAnalysisDocumentTypeFromSignals({
    aiDocumentType: 'AUTRE',
    rawText: 'Facture Orange fibre de moins de 3 mois au nom du locataire',
  });

  assert.equal(inferredFromFileName, 'JUSTIFICATIF_DOMICILE');
  assert.equal(inferredFromSignals, 'JUSTIFICATIF_DOMICILE');
});
