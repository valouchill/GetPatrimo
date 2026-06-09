'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateDossierIdentityConcordance,
  isConcordanceEnabled,
} = require('../src/utils/dossierIdentityConcordance');

function buildDoc({ id, type, subjectType = 'TENANT', subjectSlot, ownerName, prenom, nom, category }) {
  const aiAnalysis = { document_metadata: { type, owner_name: ownerName || '' } };
  if (prenom || nom) aiAnalysis.extractedData = { prenom: prenom || '', nom: nom || '' };
  return { id, type, subjectType, subjectSlot, category, fileName: `${type}_${id}.pdf`, aiAnalysis };
}

const DIDIT = { firstName: 'Jean', lastName: 'Martin' };

test('match — tous les docs concordent avec l’ancre Didit', () => {
  const res = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    tenant: { firstName: 'Jean', lastName: 'Martin' },
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'pay1', type: 'BULLETIN_SALAIRE', ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'tax1', type: 'AVIS_IMPOSITION', ownerName: 'Jean MARTIN' }),
    ],
  });
  assert.equal(res.evaluated, true);
  assert.equal(res.matches, true);
  assert.equal(res.needsHumanReview, false);
  assert.equal(res.scoreMalus, 0);
  assert.deepEqual(res.findings, []);
});

test('mismatch vs Didit — fiche de paie d’un tiers (malus 30 critique, doc flaggé)', () => {
  const res = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'pay1', type: 'BULLETIN_SALAIRE', ownerName: 'Paul DURAND' }),
    ],
  });
  assert.equal(res.matches, false);
  assert.equal(res.needsHumanReview, true);
  assert.equal(res.scoreMalus, 30);
  assert.deepEqual(res.flaggedDocumentIds, ['pay1']);
  const f = res.findings.find((x) => x.docId === 'pay1');
  assert.equal(f.code, 'IDENTITY_DOC_VS_DIDIT_MISMATCH');
  assert.equal(f.severity, 'critical');
});

test('Didit vérifié — la pièce d’identité n’est PAS pénalisée même si son OCR diffère', () => {
  const res = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', ownerName: 'Jean MARTAN' }), // OCR ≠ Didit
      buildDoc({ id: 'pay1', type: 'BULLETIN_SALAIRE', ownerName: 'Jean MARTIN' }), // concorde
    ],
  });
  assert.equal(res.matches, true);
  assert.equal(res.scoreMalus, 0);
  assert.equal(res.flaggedDocumentIds.length, 0);
});

test('fallback cross-doc quand Didit absent — ID vs avis', () => {
  const res = evaluateDossierIdentityConcordance({
    diditStatus: 'idle',
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'tax1', type: 'AVIS_IMPOSITION', ownerName: 'Paul DURAND' }),
    ],
  });
  assert.equal(res.matches, false);
  assert.equal(res.needsHumanReview, true);
  assert.equal(res.findings[0].code, 'CROSS_DOCUMENT_IDENTITY_MISMATCH');
  assert.deepEqual(res.flaggedDocumentIds, ['tax1']);
});

test('non-bloquant — un doc sans nom exploitable est ignoré (pas de faux positif)', () => {
  const res = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'pay1', type: 'BULLETIN_SALAIRE', ownerName: '' }),
    ],
  });
  assert.equal(res.matches, true);
  assert.equal(res.findings.length, 0);
});

test('isolation colocataire — slot 2 comparé à SA propre identité, jamais au slot 1', () => {
  const ok = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    coTenants: [{ slot: 2, firstName: 'Alice', lastName: 'Bernard' }],
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', subjectType: 'TENANT', subjectSlot: 1, ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'coloc-id', type: 'CARTE_IDENTITE', subjectType: 'TENANT', subjectSlot: 2, ownerName: 'Alice BERNARD' }),
    ],
  });
  assert.equal(ok.matches, true);

  const ko = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    coTenants: [{ slot: 2, firstName: 'Alice', lastName: 'Bernard' }],
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', subjectType: 'TENANT', subjectSlot: 1, ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'coloc-pay', type: 'BULLETIN_SALAIRE', subjectType: 'TENANT', subjectSlot: 2, ownerName: 'Bob LEROY' }),
    ],
  });
  assert.equal(ko.matches, false);
  assert.ok(ko.findings.length >= 1);
  assert.ok(ko.findings.every((x) => x.subjectSlot === 2), 'aucun finding ne doit référencer le slot 1');
});

test('colocataire au nom inconnu — comparaison neutralisée (skip)', () => {
  const res = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    coTenants: [],
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', subjectType: 'TENANT', subjectSlot: 1, ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'coloc-pay', type: 'BULLETIN_SALAIRE', subjectType: 'TENANT', subjectSlot: 2, ownerName: 'Alice BERNARD' }),
    ],
  });
  assert.equal(res.matches, true);
});

test('garant — recoupement croisé intra-sujet (noms garant non stockés)', () => {
  const ko = evaluateDossierIdentityConcordance({
    documents: [
      buildDoc({ id: 'g-id', type: 'CARTE_IDENTITE', subjectType: 'GUARANTOR', subjectSlot: 1, ownerName: 'Paul DURAND' }),
      buildDoc({ id: 'g-pay', type: 'BULLETIN_SALAIRE', subjectType: 'GUARANTOR', subjectSlot: 1, ownerName: 'Marie CLAIRE' }),
    ],
  });
  assert.equal(ko.matches, false);
  assert.equal(ko.findings[0].subjectType, 'guarantor');

  const ok = evaluateDossierIdentityConcordance({
    documents: [
      buildDoc({ id: 'g-id', type: 'CARTE_IDENTITE', subjectType: 'GUARANTOR', subjectSlot: 1, ownerName: 'Paul DURAND' }),
      buildDoc({ id: 'g-pay', type: 'BULLETIN_SALAIRE', subjectType: 'GUARANTOR', subjectSlot: 1, ownerName: 'Paul DURAND' }),
    ],
  });
  assert.equal(ok.matches, true);
});

test('garant CERTIFIÉ Didit — ancre forte : mismatch revenu = critique, pièce d’ID non pénalisée', () => {
  const guarantorOne = {
    firstName: 'Paul',
    lastName: 'Durand',
    status: 'CERTIFIED',
    identityVerification: { status: 'CERTIFIEE' },
  };
  const res = evaluateDossierIdentityConcordance({
    guarantorOne,
    documents: [
      // ID du garant (OCR approximatif) : NON pénalisée — ancre Didit forte (skip, comme le locataire).
      buildDoc({ id: 'g-id', type: 'CARTE_IDENTITE', subjectType: 'GUARANTOR', subjectSlot: 1, ownerName: 'P DURAND' }),
      // Fiche de paie d’un TIERS → mismatch CRITIQUE (malus 30, et non 18 « warning »).
      buildDoc({ id: 'g-pay', type: 'BULLETIN_SALAIRE', subjectType: 'GUARANTOR', subjectSlot: 1, ownerName: 'Marie CLAIRE' }),
    ],
  });
  assert.equal(res.matches, false);
  assert.equal(res.scoreMalus, 30); // critique (parité locataire), pas 18
  assert.equal(res.findings.some((f) => f.docId === 'g-id'), false); // ID vérifiée non pénalisée
  const pay = res.findings.find((f) => f.docId === 'g-pay');
  assert.ok(pay && pay.severity === 'critical');
});

test('garant NON vérifié — comportement inchangé (recoupement croisé, pas d’ancre forte)', () => {
  const guarantorOne = { firstName: 'Paul', lastName: 'Durand', status: 'PENDING' };
  const res = evaluateDossierIdentityConcordance({
    guarantorOne,
    documents: [
      buildDoc({ id: 'g-id', type: 'CARTE_IDENTITE', subjectType: 'GUARANTOR', subjectSlot: 1, ownerName: 'Paul DURAND' }),
      buildDoc({ id: 'g-pay', type: 'BULLETIN_SALAIRE', subjectType: 'GUARANTOR', subjectSlot: 1, ownerName: 'Paul DURAND' }),
    ],
  });
  // Garant non certifié + docs cohérents entre eux → pas de flag (cross-doc OK).
  assert.equal(res.matches, true);
});

test('Visale — le nom du certificat doit concorder avec le locataire principal', () => {
  const ko = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    documents: [
      buildDoc({ id: 'id1', type: 'CARTE_IDENTITE', ownerName: 'Jean MARTIN' }),
      buildDoc({ id: 'visale1', type: 'CERTIFICAT_VISALE', subjectType: 'VISALE', ownerName: 'Paul DURAND' }),
    ],
  });
  assert.equal(ko.matches, false);
  assert.equal(ko.findings.find((x) => x.docId === 'visale1').code, 'VISALE_HOLDER_MISMATCH');
});

test('accents + prénoms d’usage', () => {
  const accents = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    documents: [buildDoc({ id: 'id1', type: 'BULLETIN_SALAIRE', ownerName: 'Jéan MARTÎN' })],
  });
  assert.equal(accents.matches, true);

  const usage = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: { firstName: 'Jean Marc Pierre', lastName: 'Martin' },
    documents: [buildDoc({ id: 'pay1', type: 'BULLETIN_SALAIRE', prenom: 'Marc', nom: 'Martin' })],
  });
  assert.equal(usage.matches, true);
});

test('malus = la non-concordance la plus sévère, jamais sommé', () => {
  const res = evaluateDossierIdentityConcordance({
    diditStatus: 'verified',
    diditIdentity: DIDIT,
    documents: [
      buildDoc({ id: 'd1', type: 'BULLETIN_SALAIRE', ownerName: 'Paul DURAND' }),
      buildDoc({ id: 'd2', type: 'AVIS_IMPOSITION', ownerName: 'Marc PETIT' }),
      buildDoc({ id: 'd3', type: 'BULLETIN_SALAIRE', ownerName: 'Luc MOREAU' }),
    ],
  });
  assert.equal(res.findings.length, 3);
  assert.equal(res.scoreMalus, 30);
});

test('aucun document → résultat neutre non-évalué', () => {
  const res = evaluateDossierIdentityConcordance({ documents: [] });
  assert.equal(res.evaluated, false);
  assert.equal(res.matches, true);
  assert.equal(res.scoreMalus, 0);
});

test('isConcordanceEnabled lit le flag d’env', () => {
  const prev = process.env.IDENTITY_CONCORDANCE_ENABLED;
  delete process.env.IDENTITY_CONCORDANCE_ENABLED;
  assert.equal(isConcordanceEnabled(), false);
  process.env.IDENTITY_CONCORDANCE_ENABLED = 'true';
  assert.equal(isConcordanceEnabled(), true);
  if (prev === undefined) delete process.env.IDENTITY_CONCORDANCE_ENABLED;
  else process.env.IDENTITY_CONCORDANCE_ENABLED = prev;
});
