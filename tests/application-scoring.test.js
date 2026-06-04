const test = require('node:test');
const assert = require('node:assert/strict');

const { computeApplicationPatrimometer } = require('../src/utils/applicationScoring');

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
    aiAnalysis,
  };
}

test('Visale compatible fills the full guarantee block', () => {
  const result = computeApplicationPatrimometer({
    candidateStatus: 'Salarie',
    diditStatus: 'verified',
    propertyRentAmount: 1200,
    detectedIncome: 3800,
    guarantee: {
      mode: 'VISALE',
      visale: {
        certified: true,
        maxRent: 1400,
        compatibleWithRent: true,
      },
    },
    documents: [
      buildDoc({ id: 'id', category: 'IDENTITY', type: 'CARTE_IDENTITE' }),
      buildDoc({ id: 'salary-1', type: 'BULLETIN_SALAIRE', dateEmission: '2026-02-28' }),
      buildDoc({ id: 'salary-2', type: 'BULLETIN_SALAIRE', dateEmission: '2026-01-28' }),
      buildDoc({ id: 'salary-3', type: 'BULLETIN_SALAIRE', dateEmission: '2025-12-28' }),
      buildDoc({ id: 'tax', type: 'AVIS_IMPOSITION' }),
      buildDoc({ id: 'employment', type: 'ATTESTATION_EMPLOYEUR', fileName: 'attestation_employeur.pdf', dateEmission: '2026-03-01' }),
      buildDoc({ id: 'home', category: 'ADDRESS', type: 'JUSTIFICATIF_DOMICILE' }),
      buildDoc({
        id: 'visale',
        category: 'INCOME',
        subjectType: 'VISALE',
        type: 'CERTIFICAT_VISALE',
        aiAnalysis: {
          trust_and_security: {
            digital_seal_authenticated: true,
          },
          financial_data: {
            extra_details: {
              visale: {
                loyer_maximum_garanti: 1400,
              },
            },
          },
        },
      }),
    ],
  });

  assert.equal(result.guarantee.mode, 'VISALE');
  assert.equal(result.breakdown.guarantee.total, 30);
  assert.equal(result.chapterStates.guarantee.satisfied, true);
  assert.equal(result.chapterStates.passport.ready, true);
});

test('Two physical guarantors aggregate the best sub-blocks with a 30-point cap', () => {
  const result = computeApplicationPatrimometer({
    candidateStatus: 'Etudiant',
    diditStatus: 'verified',
    propertyRentAmount: 1000,
    detectedIncome: 850,
    guarantee: {
      mode: 'PHYSICAL',
      guarantors: [
        { slot: 1, profile: 'Salarie', status: 'CERTIFIED', certificationMethod: 'DIDIT' },
        { slot: 2, profile: 'Retraite', status: 'AUDITED', certificationMethod: 'AUDIT' },
      ],
    },
    documents: [
      buildDoc({ id: 'id', category: 'IDENTITY', type: 'CARTE_IDENTITE' }),
      buildDoc({ id: 'student', type: 'ATTESTATION_BOURSE', fileName: 'bourse.pdf' }),
      buildDoc({ id: 'school', type: 'CONTRAT_TRAVAIL', fileName: 'certificat_scolarite.pdf' }),
      buildDoc({ id: 'home', category: 'ADDRESS', type: 'JUSTIFICATIF_DOMICILE' }),
      buildDoc({ id: 'g1-id', category: 'GUARANTOR', subjectType: 'GUARANTOR', subjectSlot: 1, type: 'CARTE_IDENTITE' }),
      buildDoc({ id: 'g1-salary-1', category: 'GUARANTOR', subjectType: 'GUARANTOR', subjectSlot: 1, type: 'BULLETIN_SALAIRE', dateEmission: '2026-02-28' }),
      buildDoc({ id: 'g1-salary-2', category: 'GUARANTOR', subjectType: 'GUARANTOR', subjectSlot: 1, type: 'BULLETIN_SALAIRE', dateEmission: '2026-01-28' }),
      buildDoc({ id: 'g1-salary-3', category: 'GUARANTOR', subjectType: 'GUARANTOR', subjectSlot: 1, type: 'BULLETIN_SALAIRE', dateEmission: '2025-12-28' }),
      buildDoc({ id: 'g1-tax', category: 'GUARANTOR', subjectType: 'GUARANTOR', subjectSlot: 1, type: 'AVIS_IMPOSITION' }),
      buildDoc({ id: 'g2-home', category: 'GUARANTOR', subjectType: 'GUARANTOR', subjectSlot: 2, type: 'JUSTIFICATIF_DOMICILE' }),
      buildDoc({ id: 'g2-pension', category: 'GUARANTOR', subjectType: 'GUARANTOR', subjectSlot: 2, type: 'PENSION', fileName: 'attestation_retraite.pdf' }),
      buildDoc({ id: 'g2-tax', category: 'GUARANTOR', subjectType: 'GUARANTOR', subjectSlot: 2, type: 'AVIS_IMPOSITION' }),
    ],
  });

  assert.equal(result.guarantee.mode, 'PHYSICAL');
  assert.equal(result.breakdown.guarantee.total, 30);
  assert.equal(result.chapterStates.guarantee.requirement, 'required');
  assert.equal(result.chapterStates.guarantee.satisfied, true);
  assert.equal(result.guarantee.guarantors.length, 2);
});

test('Legacy guarantor state infers physical mode even before migration', () => {
  const result = computeApplicationPatrimometer({
    candidateStatus: 'Salarie',
    diditStatus: 'verified',
    detectedIncome: 3500,
    documents: [
      buildDoc({ id: 'id', category: 'IDENTITY', type: 'CARTE_IDENTITE' }),
      buildDoc({ id: 'salary-1', type: 'BULLETIN_SALAIRE', dateEmission: '2026-02-28' }),
      buildDoc({ id: 'salary-2', type: 'BULLETIN_SALAIRE', dateEmission: '2026-01-28' }),
      buildDoc({ id: 'salary-3', type: 'BULLETIN_SALAIRE', dateEmission: '2025-12-28' }),
      buildDoc({ id: 'tax', type: 'AVIS_IMPOSITION' }),
      buildDoc({ id: 'employment', type: 'ATTESTATION_EMPLOYEUR', fileName: 'attestation_employeur.pdf', dateEmission: '2026-03-01' }),
      buildDoc({ id: 'home', category: 'ADDRESS', type: 'JUSTIFICATIF_DOMICILE' }),
    ],
    legacyGuarantor: {
      hasGuarantor: true,
      status: 'CERTIFIED',
      certificationMethod: 'AUDIT',
    },
  });

  assert.equal(result.guarantee.mode, 'PHYSICAL');
  assert.equal(result.legacyGuarantor.hasGuarantor, true);
});

test('No guarantor remains a first-class mode for a strong tenant dossier', () => {
  const result = computeApplicationPatrimometer({
    candidateStatus: 'Salarie',
    diditStatus: 'verified',
    propertyRentAmount: 950,
    detectedIncome: 4200,
    guarantee: {
      mode: 'NONE',
    },
    documents: [
      buildDoc({ id: 'id', category: 'IDENTITY', type: 'CARTE_IDENTITE' }),
      buildDoc({ id: 'salary-1', type: 'BULLETIN_SALAIRE', dateEmission: '2026-02-28' }),
      buildDoc({ id: 'salary-2', type: 'BULLETIN_SALAIRE', dateEmission: '2026-01-28' }),
      buildDoc({ id: 'salary-3', type: 'BULLETIN_SALAIRE', dateEmission: '2025-12-28' }),
      buildDoc({ id: 'tax', type: 'AVIS_IMPOSITION' }),
      buildDoc({ id: 'employment', type: 'ATTESTATION_EMPLOYEUR', fileName: 'attestation_employeur.pdf', dateEmission: '2026-03-01' }),
      buildDoc({ id: 'home', category: 'ADDRESS', type: 'JUSTIFICATIF_DOMICILE' }),
    ],
  });

  assert.equal(result.guarantee.mode, 'NONE');
  assert.equal(result.breakdown.guarantee.total, 0);
  assert.equal(result.chapterStates.guarantee.requirement, 'optional');
  assert.equal(result.chapterStates.guarantee.satisfied, true);
});

test('concordance identité — golden OFF (byte-identique) vs ON (malus + gate + warning)', () => {
  const named = (opts, ownerName) =>
    buildDoc({ ...opts, aiAnalysis: { document_metadata: { type: opts.type, owner_name: ownerName } } });
  const input = {
    candidateStatus: 'Salarie',
    diditStatus: 'verified',
    diditIdentity: { firstName: 'Jean', lastName: 'Martin' },
    profile: { firstName: 'Jean', lastName: 'Martin' },
    propertyRentAmount: 1200,
    detectedIncome: 3800,
    guarantee: { mode: 'VISALE', visale: { certified: true, maxRent: 1400, compatibleWithRent: true } },
    documents: [
      named({ id: 'id', category: 'IDENTITY', type: 'CARTE_IDENTITE' }, 'Jean MARTIN'),
      named({ id: 'salary-1', type: 'BULLETIN_SALAIRE', dateEmission: '2026-02-28' }, 'Paul DURAND'), // ← doc d'un tiers
      named({ id: 'salary-2', type: 'BULLETIN_SALAIRE', dateEmission: '2026-01-28' }, 'Jean MARTIN'),
      named({ id: 'salary-3', type: 'BULLETIN_SALAIRE', dateEmission: '2025-12-28' }, 'Jean MARTIN'),
      named({ id: 'tax', type: 'AVIS_IMPOSITION' }, 'Jean MARTIN'),
      named({ id: 'employment', type: 'ATTESTATION_EMPLOYEUR', fileName: 'attestation_employeur.pdf', dateEmission: '2026-03-01' }, 'Jean MARTIN'),
      buildDoc({ id: 'home', category: 'ADDRESS', type: 'JUSTIFICATIF_DOMICILE' }),
      buildDoc({
        id: 'visale',
        category: 'INCOME',
        subjectType: 'VISALE',
        type: 'CERTIFICAT_VISALE',
        aiAnalysis: {
          trust_and_security: { digital_seal_authenticated: true },
          financial_data: { extra_details: { visale: { loyer_maximum_garanti: 1400 } } },
        },
      }),
    ],
  };

  const prev = process.env.IDENTITY_CONCORDANCE_ENABLED;

  delete process.env.IDENTITY_CONCORDANCE_ENABLED;
  const off = computeApplicationPatrimometer(input);
  assert.equal(off.concordance, null, 'OFF: pas de concordance');
  assert.equal(off.chapterStates.concordance, undefined, 'OFF: aucun chapitre concordance');
  assert.equal(off.chapterStates.passport.ready, true, 'OFF: la non-concordance est ignorée');

  process.env.IDENTITY_CONCORDANCE_ENABLED = 'true';
  const on = computeApplicationPatrimometer(input);
  assert.equal(on.chapterStates.concordance.needsHumanReview, true);
  assert.equal(on.chapterStates.passport.ready, false, 'ON: passeport gaté');
  assert.equal(on.score, off.score - 30, 'ON: malus critique de 30 appliqué');
  assert.ok(on.warnings.some((w) => /oncordance/.test(w)), 'ON: warning présent');
  assert.ok((on.concordance.flaggedDocumentIds || []).includes('salary-1'));

  if (prev === undefined) delete process.env.IDENTITY_CONCORDANCE_ENABLED;
  else process.env.IDENTITY_CONCORDANCE_ENABLED = prev;
});
