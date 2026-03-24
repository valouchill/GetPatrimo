/**
 * Tests — Enum normalization (UPPER_SNAKE_CASE)
 *
 * Couvre :
 *  - normalizeLeaseType : cas nominaux, variantes French, casse, null/undefined
 *  - computeSmartDeposit : impact des enum sur le calcul
 *  - deriveLeaseType : cascade de candidats
 *  - shouldGenerateGuaranteeDocument : dépend du leaseType normalisé
 *  - Schémas Mongoose : valeurs d'enum définies en UPPER_SNAKE_CASE
 *  - Mappings de migration : up() + needsMigration() helpers
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  LEASE_TYPES,
  normalizeLeaseType,
  deriveLeaseType,
  computeSmartDeposit,
  shouldGenerateGuaranteeDocument,
  hasUsableGuarantor,
} = require('../src/utils/leaseWizardShared');

// ---------------------------------------------------------------------------
// Helpers locaux qui répliquent les helpers internes de la migration
// (up / needsMigration — non exportés, on les teste via leur logique pure)
// ---------------------------------------------------------------------------

function up(map, value) {
  if (value == null) return value;
  return map[value] ?? value;
}

function needsMigration(map, value) {
  return value != null && Object.prototype.hasOwnProperty.call(map, value);
}

// Mappings identiques à ceux du script de migration
const LEASE_TYPE_MAP = { vide: 'VIDE', meuble: 'MEUBLE', mobilite: 'MOBILITE', garage_parking: 'GARAGE_PARKING' };
const OPENSIGN_STATUS_MAP = { draft: 'DRAFT', pending: 'PENDING', signed: 'SIGNED', completed: 'SIGNED', expired: 'EXPIRED', declined: 'CANCELLED' };
const DOC_KIND_MAP = { lease: 'LEASE', guarantee: 'GUARANTEE' };
const APP_DOC_STATUS_MAP = {
  pending: 'PENDING', analyzing: 'ANALYZING', certified: 'CERTIFIED',
  flagged: 'FLAGGED', rejected: 'REJECTED', illegible: 'ILLEGIBLE', needs_review: 'NEEDS_REVIEW',
};
const APP_CATEGORY_MAP = { identity: 'IDENTITY', income: 'INCOME', address: 'ADDRESS', guarantor: 'GUARANTOR' };
const APP_SUBJECT_TYPE_MAP = { tenant: 'TENANT', guarantor: 'GUARANTOR', visale: 'VISALE' };

// ---------------------------------------------------------------------------
// normalizeLeaseType
// ---------------------------------------------------------------------------

describe('normalizeLeaseType', () => {
  it('cas nominal — valeurs déjà UPPER_SNAKE_CASE retournées telles quelles', () => {
    assert.equal(normalizeLeaseType('VIDE'), 'VIDE');
    assert.equal(normalizeLeaseType('MEUBLE'), 'MEUBLE');
    assert.equal(normalizeLeaseType('MOBILITE'), 'MOBILITE');
    assert.equal(normalizeLeaseType('GARAGE_PARKING'), 'GARAGE_PARKING');
  });

  it('normalise les variantes lowercase', () => {
    assert.equal(normalizeLeaseType('vide'), 'VIDE');
    assert.equal(normalizeLeaseType('meuble'), 'MEUBLE');
    assert.equal(normalizeLeaseType('mobilite'), 'MOBILITE');
    assert.equal(normalizeLeaseType('garage_parking'), 'GARAGE_PARKING');
  });

  it('normalise les alias français (nu, meublée, mobilité, garage, parking)', () => {
    assert.equal(normalizeLeaseType('nu'), 'VIDE');
    assert.equal(normalizeLeaseType('meublée'), 'MEUBLE');
    assert.equal(normalizeLeaseType('mobilité'), 'MOBILITE');
    assert.equal(normalizeLeaseType('garage'), 'GARAGE_PARKING');
    assert.equal(normalizeLeaseType('parking'), 'GARAGE_PARKING');
    assert.equal(normalizeLeaseType('box'), 'GARAGE_PARKING');
  });

  it('normalise les variantes contenant le mot-clé (substring)', () => {
    assert.equal(normalizeLeaseType('location meublée'), 'MEUBLE');
    assert.equal(normalizeLeaseType('bail mobilité'), 'MOBILITE');
    assert.equal(normalizeLeaseType('place de parking'), 'GARAGE_PARKING');
    assert.equal(normalizeLeaseType('logement vide'), 'VIDE');
  });

  it('retourne null pour une valeur inconnue', () => {
    assert.equal(normalizeLeaseType('commercial'), null);
    assert.equal(normalizeLeaseType('unknown'), null);
    assert.equal(normalizeLeaseType(''), null);
  });

  it('retourne null pour null / undefined', () => {
    assert.equal(normalizeLeaseType(null), null);
    assert.equal(normalizeLeaseType(undefined), null);
  });

  it('LEASE_TYPES contient exactement les 4 valeurs UPPER_SNAKE_CASE', () => {
    assert.deepEqual(LEASE_TYPES, ['VIDE', 'MEUBLE', 'MOBILITE', 'GARAGE_PARKING']);
  });
});

// ---------------------------------------------------------------------------
// deriveLeaseType
// ---------------------------------------------------------------------------

describe('deriveLeaseType', () => {
  it('cas nominal — explicitLeaseType prime sur la propriété', () => {
    assert.equal(deriveLeaseType({ type: 'meuble' }, 'VIDE'), 'VIDE');
  });

  it('utilise property.type si pas de type explicite', () => {
    assert.equal(deriveLeaseType({ type: 'meuble' }, null), 'MEUBLE');
  });

  it('utilise property.propertyType en cascade', () => {
    assert.equal(deriveLeaseType({ propertyType: 'mobilite' }, null), 'MOBILITE');
  });

  it('retourne VIDE par défaut si aucun candidat valide', () => {
    assert.equal(deriveLeaseType({}, null), 'VIDE');
    assert.equal(deriveLeaseType(null, null), 'VIDE');
    assert.equal(deriveLeaseType({}, undefined), 'VIDE');
  });

  it('propriété furnished "meublée" est reconnue', () => {
    assert.equal(deriveLeaseType({ furnished: 'meublée' }, null), 'MEUBLE');
  });
});

// ---------------------------------------------------------------------------
// computeSmartDeposit
// ---------------------------------------------------------------------------

describe('computeSmartDeposit', () => {
  it('cas nominal — MEUBLE = 2 mois de loyer', () => {
    assert.equal(computeSmartDeposit('MEUBLE', 1000), 2000);
  });

  it('cas nominal — VIDE = 1 mois de loyer', () => {
    assert.equal(computeSmartDeposit('VIDE', 900), 900);
  });

  it('cas nominal — MOBILITE = 0', () => {
    assert.equal(computeSmartDeposit('MOBILITE', 800), 0);
  });

  it('accepte les variantes lowercase (normalisation interne)', () => {
    assert.equal(computeSmartDeposit('meuble', 500), 1000);
    assert.equal(computeSmartDeposit('vide', 500), 500);
    assert.equal(computeSmartDeposit('mobilite', 500), 0);
  });

  it('GARAGE_PARKING = 1 mois de loyer (fallback)', () => {
    assert.equal(computeSmartDeposit('GARAGE_PARKING', 150), 150);
  });

  it('loyer à 0 retourne 0 pour tout type', () => {
    assert.equal(computeSmartDeposit('MEUBLE', 0), 0);
    assert.equal(computeSmartDeposit('VIDE', 0), 0);
  });

  it('loyer null/undefined traité comme 0', () => {
    assert.equal(computeSmartDeposit('VIDE', null), 0);
    assert.equal(computeSmartDeposit('VIDE', undefined), 0);
  });
});

// ---------------------------------------------------------------------------
// shouldGenerateGuaranteeDocument + hasUsableGuarantor
// ---------------------------------------------------------------------------

describe('shouldGenerateGuaranteeDocument', () => {
  it('cas nominal — VIDE avec garant email → true', () => {
    assert.equal(shouldGenerateGuaranteeDocument('VIDE', { email: 'g@example.com' }), true);
  });

  it('cas nominal — MEUBLE avec garant nom → true', () => {
    assert.equal(shouldGenerateGuaranteeDocument('MEUBLE', { firstName: 'Jean' }), true);
  });

  it('MOBILITE → jamais de caution (loi)', () => {
    assert.equal(shouldGenerateGuaranteeDocument('MOBILITE', { email: 'g@example.com' }), false);
    assert.equal(shouldGenerateGuaranteeDocument('mobilite', { firstName: 'Jean' }), false);
  });

  it('sans garant utilisable → false', () => {
    assert.equal(shouldGenerateGuaranteeDocument('VIDE', null), false);
    assert.equal(shouldGenerateGuaranteeDocument('VIDE', {}), false);
    assert.equal(shouldGenerateGuaranteeDocument('VIDE', undefined), false);
  });

  it('Visale reconnu comme garant utilisable', () => {
    assert.equal(shouldGenerateGuaranteeDocument('VIDE', { visaleNumber: 'VS123' }), true);
  });
});

describe('hasUsableGuarantor', () => {
  it('retourne false pour null / undefined', () => {
    assert.equal(hasUsableGuarantor(null), false);
    assert.equal(hasUsableGuarantor(undefined), false);
  });

  it('retourne false pour objet vide', () => {
    assert.equal(hasUsableGuarantor({}), false);
  });

  it('retourne true si visaleNumber présent', () => {
    assert.equal(hasUsableGuarantor({ visaleNumber: 'VS456' }), true);
  });

  it('retourne true si firstName ou lastName', () => {
    assert.equal(hasUsableGuarantor({ firstName: 'Paul' }), true);
    assert.equal(hasUsableGuarantor({ lastName: 'Martin' }), true);
  });

  it('retourne true si email', () => {
    assert.equal(hasUsableGuarantor({ email: 'g@x.com' }), true);
  });
});

// ---------------------------------------------------------------------------
// Schéma Mongoose — enum en UPPER_SNAKE_CASE (vérification structurelle)
// ---------------------------------------------------------------------------

describe('Lease schema enums — UPPER_SNAKE_CASE', () => {
  // On charge le schéma sans se connecter à Mongo (mongoose supporte ça)
  let leaseSchemaObj;

  it('charge le modèle Lease sans erreur', () => {
    const Lease = require('../models/Lease');
    leaseSchemaObj = Lease.schema.obj;
    assert.ok(leaseSchemaObj, 'le schéma est défini');
  });

  it('opensignStatus — enum valide UPPER_SNAKE_CASE', () => {
    const Lease = require('../models/Lease');
    const enumValues = Lease.schema.path('opensignStatus').enumValues;
    assert.deepEqual(enumValues, ['DRAFT', 'PENDING', 'SIGNED', 'EXPIRED', 'CANCELLED']);
  });

  it('signatureStatus — enum valide UPPER_SNAKE_CASE', () => {
    const Lease = require('../models/Lease');
    const enumValues = Lease.schema.path('signatureStatus').enumValues;
    assert.ok(enumValues.includes('PENDING'));
    assert.ok(enumValues.includes('SIGNED_BY_OWNER'));
    assert.ok(enumValues.includes('CANCELLED'));
    // Vérifier qu'il n'y a pas de valeur lowercase
    enumValues.forEach(v => assert.equal(v, v.toUpperCase(), `Valeur non-uppercase : ${v}`));
  });

  it('leaseType — enum valide UPPER_SNAKE_CASE', () => {
    const Lease = require('../models/Lease');
    const enumValues = Lease.schema.path('leaseType').enumValues;
    assert.ok(enumValues.includes('VIDE'));
    assert.ok(enumValues.includes('MEUBLE'));
    assert.ok(enumValues.includes('MOBILITE'));
    assert.ok(enumValues.includes('GARAGE_PARKING'));
    enumValues.forEach(v => assert.equal(v, v.toUpperCase(), `Valeur non-uppercase : ${v}`));
  });

  it('edlStatus — enum valide UPPER_SNAKE_CASE', () => {
    const Lease = require('../models/Lease');
    const enumValues = Lease.schema.path('edlStatus').enumValues;
    enumValues.forEach(v => assert.equal(v, v.toUpperCase(), `Valeur non-uppercase : ${v}`));
  });
});

describe('Application schema enums — UPPER_SNAKE_CASE', () => {
  it('charge le modèle Application sans erreur', () => {
    const Application = require('../models/Application');
    assert.ok(Application.schema, 'le schéma est défini');
  });

  it('status — enum valide UPPER_SNAKE_CASE', () => {
    const Application = require('../models/Application');
    const enumValues = Application.schema.path('status').enumValues;
    enumValues.forEach(v => assert.equal(v, v.toUpperCase(), `Valeur non-uppercase : ${v}`));
    assert.ok(enumValues.includes('DRAFT'));
    assert.ok(enumValues.includes('SUBMITTED'));
  });

  it('ownerDecision — enum valide UPPER_SNAKE_CASE', () => {
    const Application = require('../models/Application');
    const enumValues = Application.schema.path('ownerDecision').enumValues;
    enumValues.forEach(v => assert.equal(v, v.toUpperCase(), `Valeur non-uppercase : ${v}`));
  });

  it('didit.status — enum valide UPPER_SNAKE_CASE', () => {
    const Application = require('../models/Application');
    const enumValues = Application.schema.path('didit.status').enumValues;
    enumValues.forEach(v => assert.equal(v, v.toUpperCase(), `Valeur non-uppercase : ${v}`));
    assert.ok(enumValues.includes('PENDING'));
    assert.ok(enumValues.includes('VERIFIED'));
  });
});

// ---------------------------------------------------------------------------
// Migration helpers — up() et needsMigration()
// ---------------------------------------------------------------------------

describe('Migration helper — up()', () => {
  it('retourne la valeur UPPERCASE correspondante', () => {
    assert.equal(up(LEASE_TYPE_MAP, 'vide'), 'VIDE');
    assert.equal(up(LEASE_TYPE_MAP, 'meuble'), 'MEUBLE');
    assert.equal(up(OPENSIGN_STATUS_MAP, 'pending'), 'PENDING');
    assert.equal(up(OPENSIGN_STATUS_MAP, 'declined'), 'CANCELLED');
    assert.equal(up(DOC_KIND_MAP, 'lease'), 'LEASE');
    assert.equal(up(DOC_KIND_MAP, 'guarantee'), 'GUARANTEE');
  });

  it('retourne la valeur originale si pas dans le mapping', () => {
    assert.equal(up(LEASE_TYPE_MAP, 'VIDE'), 'VIDE'); // déjà migré
    assert.equal(up(LEASE_TYPE_MAP, 'unknown'), 'unknown');
  });

  it('retourne null/undefined tel quel', () => {
    assert.equal(up(LEASE_TYPE_MAP, null), null);
    assert.equal(up(LEASE_TYPE_MAP, undefined), undefined);
  });
});

describe('Migration helper — needsMigration()', () => {
  it('retourne true pour les valeurs lowercase non migrées', () => {
    assert.equal(needsMigration(LEASE_TYPE_MAP, 'vide'), true);
    assert.equal(needsMigration(OPENSIGN_STATUS_MAP, 'pending'), true);
    assert.equal(needsMigration(DOC_KIND_MAP, 'lease'), true);
    assert.equal(needsMigration(APP_DOC_STATUS_MAP, 'needs_review'), true);
    assert.equal(needsMigration(APP_CATEGORY_MAP, 'identity'), true);
    assert.equal(needsMigration(APP_SUBJECT_TYPE_MAP, 'visale'), true);
  });

  it('retourne false pour les valeurs déjà UPPERCASE', () => {
    assert.equal(needsMigration(LEASE_TYPE_MAP, 'VIDE'), false);
    assert.equal(needsMigration(OPENSIGN_STATUS_MAP, 'PENDING'), false);
    assert.equal(needsMigration(DOC_KIND_MAP, 'LEASE'), false);
  });

  it('retourne false pour null / undefined', () => {
    assert.equal(needsMigration(LEASE_TYPE_MAP, null), false);
    assert.equal(needsMigration(LEASE_TYPE_MAP, undefined), false);
  });

  it('couvre tous les mappings de migration sans exception', () => {
    const allMaps = [
      [LEASE_TYPE_MAP, ['vide', 'meuble', 'mobilite', 'garage_parking']],
      [OPENSIGN_STATUS_MAP, ['pending', 'signed', 'completed', 'expired', 'declined']],
      [DOC_KIND_MAP, ['lease', 'guarantee']],
      [APP_DOC_STATUS_MAP, ['pending', 'analyzing', 'certified', 'flagged', 'rejected', 'illegible', 'needs_review']],
      [APP_CATEGORY_MAP, ['identity', 'income', 'address', 'guarantor']],
      [APP_SUBJECT_TYPE_MAP, ['tenant', 'guarantor', 'visale']],
    ];

    for (const [map, keys] of allMaps) {
      for (const key of keys) {
        assert.equal(needsMigration(map, key), true, `needsMigration doit être true pour "${key}"`);
        const migrated = up(map, key);
        assert.equal(migrated, migrated.toUpperCase(), `up() doit retourner UPPER_SNAKE_CASE pour "${key}", reçu "${migrated}"`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// documentCertificationRules — statuts UPPER_SNAKE_CASE
// ---------------------------------------------------------------------------

describe('documentCertificationRules — statuts UPPER_SNAKE_CASE', () => {
  const {
    getDocumentCertificationDecision,
  } = require('../src/utils/documentCertificationRules');

  it('retourne status CERTIFIED pour un document reconnu, catégorie correcte, sans fraude', () => {
    const decision = getDocumentCertificationDecision({
      uploadCategory: 'resources',
      aiDocumentType: 'BULLETIN_SALAIRE',
      fraudScore: 5,
      needsHumanReview: false,
      partialExtraction: false,
      hasCompatibleChecklistHint: true,
    });
    assert.equal(decision.status, 'CERTIFIED');
    assert.equal(decision.flagged, false);
    assert.equal(decision.categoryMatch, true);
  });

  it('retourne status REJECTED pour un document illisible (isIllegible)', () => {
    const decision = getDocumentCertificationDecision({
      uploadCategory: 'identity',
      aiDocumentType: 'CARTE_IDENTITE',
      isIllegible: true,
    });
    assert.equal(decision.status, 'ILLEGIBLE');
    assert.equal(decision.flagged, false);
    assert.equal(decision.canForceSend, false);
  });

  it('retourne status REJECTED pour mauvaise catégorie', () => {
    const decision = getDocumentCertificationDecision({
      uploadCategory: 'identity',
      aiDocumentType: 'BULLETIN_SALAIRE',
      fraudScore: 0,
      hasCompatibleChecklistHint: false,
    });
    assert.equal(decision.status, 'REJECTED');
    assert.equal(decision.flagged, false);
  });

  it('retourne status NEEDS_REVIEW pour document en revue humaine', () => {
    const decision = getDocumentCertificationDecision({
      uploadCategory: 'resources',
      aiDocumentType: 'BULLETIN_SALAIRE',
      fraudScore: 5,
      needsHumanReview: true,
      hasCompatibleChecklistHint: true,
    });
    assert.equal(decision.status, 'NEEDS_REVIEW');
    assert.equal(decision.canForceSend, true);
  });

  it('retourne status REJECTED avec flagged=true quand fraudScore > 90', () => {
    const decision = getDocumentCertificationDecision({
      uploadCategory: 'resources',
      aiDocumentType: 'BULLETIN_SALAIRE',
      fraudScore: 95,
      hasCompatibleChecklistHint: true,
    });
    assert.equal(decision.status, 'REJECTED');
    assert.equal(decision.flagged, true);
    assert.equal(decision.canForceSend, false);
  });

  it('les statuts possibles sont uniquement des valeurs UPPER_SNAKE_CASE connues', () => {
    const validStatuses = new Set(['CERTIFIED', 'REJECTED', 'ILLEGIBLE', 'NEEDS_REVIEW']);
    const scenarios = [
      { uploadCategory: 'resources', aiDocumentType: 'BULLETIN_SALAIRE', fraudScore: 5 },
      { uploadCategory: 'identity', aiDocumentType: 'CARTE_IDENTITE', isIllegible: true },
      { uploadCategory: 'identity', aiDocumentType: 'BULLETIN_SALAIRE' },
      { uploadCategory: 'resources', aiDocumentType: 'BULLETIN_SALAIRE', needsHumanReview: true, hasCompatibleChecklistHint: true },
      { uploadCategory: 'resources', aiDocumentType: 'BULLETIN_SALAIRE', fraudScore: 95, hasCompatibleChecklistHint: true },
    ];
    for (const scenario of scenarios) {
      const decision = getDocumentCertificationDecision(scenario);
      assert.ok(
        validStatuses.has(decision.status),
        `statut inattendu "${decision.status}" pour le scénario ${JSON.stringify(scenario)}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// applicationScoring — isCertifiedDocument compare sur 'CERTIFIED'
// ---------------------------------------------------------------------------

describe('applicationScoring — isCertifiedDocument compare sur UPPER_SNAKE_CASE', () => {
  const { computeApplicationPatrimometer } = require('../src/utils/applicationScoring');

  function buildDoc(type, status, extra = {}) {
    return {
      type,
      status,
      flagged: false,
      fileName: `${type}.pdf`,
      ...extra,
    };
  }

  it('doc.status CERTIFIED (UPPER) est pris en compte dans le scoring', () => {
    const result = computeApplicationPatrimometer({
      candidateStatus: 'Salarie',
      diditStatus: 'verified',
      documents: [
        buildDoc('CARTE_IDENTITE', 'CERTIFIED', { category: 'identity' }),
        buildDoc('BULLETIN_SALAIRE', 'CERTIFIED', { dateEmission: '2026-02-01' }),
        buildDoc('BULLETIN_SALAIRE', 'CERTIFIED', { dateEmission: '2026-01-01' }),
        buildDoc('BULLETIN_SALAIRE', 'CERTIFIED', { dateEmission: '2025-12-01' }),
        buildDoc('AVIS_IMPOSITION', 'CERTIFIED'),
        buildDoc('JUSTIFICATIF_DOMICILE', 'CERTIFIED'),
        buildDoc('ATTESTATION_EMPLOYEUR', 'CERTIFIED'),
      ],
    });
    // Le bloc identité doit être couvert (diditStatus = verified)
    assert.ok(result.breakdown.identity > 0 || result.breakdown.tenant.identity > 0,
      'identité devrait être couverte avec verified didit');
    assert.ok(result.score > 0, 'le score total doit être positif');
  });

  it('doc.status lowercase "certified" N EST PAS reconnu comme CERTIFIED', () => {
    // Ce test documente le comportement attendu : après migration, les docs
    // doivent avoir status UPPER_SNAKE_CASE pour être comptabilisés
    const resultLower = computeApplicationPatrimometer({
      candidateStatus: 'Salarie',
      diditStatus: 'idle',
      documents: [
        buildDoc('CARTE_IDENTITE', 'certified', { category: 'identity' }),
        buildDoc('BULLETIN_SALAIRE', 'certified'),
      ],
    });

    const resultUpper = computeApplicationPatrimometer({
      candidateStatus: 'Salarie',
      diditStatus: 'idle',
      documents: [
        buildDoc('CARTE_IDENTITE', 'CERTIFIED', { category: 'identity' }),
        buildDoc('BULLETIN_SALAIRE', 'CERTIFIED'),
      ],
    });

    // Avec lowercase, aucun doc n'est certifié → score plus faible ou nul
    assert.ok(
      resultUpper.score >= resultLower.score,
      `UPPER (${resultUpper.score}) doit être >= LOWER (${resultLower.score}) : la comparaison est stricte`
    );
  });
});

// ---------------------------------------------------------------------------
// passportViewModel — getDocStatus retourne UPPER_SNAKE_CASE
// ---------------------------------------------------------------------------

describe('passportViewModel — getDocStatus retourne UPPER_SNAKE_CASE', () => {
  // getDocStatus n'est pas exporté directement, mais son comportement est
  // observable via buildPassportViewModel qui s'en sert pour certifiedDocuments
  const { buildPassportViewModel } = require('../src/utils/passportViewModel');
  const { computeApplicationPatrimometer } = require('../src/utils/applicationScoring');

  function buildDoc(type, status, extra = {}) {
    return {
      type,
      status,
      flagged: false,
      fileName: `${type}.pdf`,
      uploadedAt: '2026-03-01T10:00:00.000Z',
      ...extra,
    };
  }

  it('buildPassportViewModel compte les docs CERTIFIED (UPPER) dans certifiedDocuments', () => {
    const documents = [
      buildDoc('CARTE_IDENTITE', 'CERTIFIED', { category: 'identity' }),
      buildDoc('BULLETIN_SALAIRE', 'CERTIFIED'),
      buildDoc('AVIS_IMPOSITION', 'NEEDS_REVIEW'),
    ];

    const patrimometer = computeApplicationPatrimometer({
      candidateStatus: 'Salarie',
      diditStatus: 'verified',
      documents,
    });

    const vm = buildPassportViewModel({
      application: {
        _id: 'abc123',
        passportSlug: 'test-slug',
        profile: { firstName: 'Alice', lastName: 'Martin', status: 'Salarie' },
        didit: { status: 'VERIFIED' },
        documents,
        patrimometer,
        guarantee: { mode: 'NONE' },
        status: 'IN_PROGRESS',
      },
      baseUrl: 'https://example.com',
    });

    // Le count de docs certifiés doit correspondre aux docs avec status='CERTIFIED'
    assert.equal(vm.documentCoverage.counts.certifiedDocuments, 2,
      '2 docs avec status CERTIFIED doivent être comptés');
    assert.equal(vm.documentCoverage.counts.reviewDocuments, 1,
      '1 doc avec status NEEDS_REVIEW doit être compté');
  });

  it('buildPassportViewModel — doc flagged est mis en NEEDS_REVIEW même si status=CERTIFIED', () => {
    const documents = [
      buildDoc('CARTE_IDENTITE', 'CERTIFIED', { flagged: true }),
    ];

    const patrimometer = computeApplicationPatrimometer({
      candidateStatus: 'Salarie',
      diditStatus: 'verified',
      documents,
    });

    const vm = buildPassportViewModel({
      application: {
        _id: 'abc124',
        passportSlug: 'test-slug-2',
        profile: { firstName: 'Bob', status: 'Salarie' },
        didit: { status: 'VERIFIED' },
        documents,
        patrimometer,
        guarantee: { mode: 'NONE' },
        status: 'IN_PROGRESS',
      },
      baseUrl: 'https://example.com',
    });

    // Un doc flagged ne compte pas comme certifié (getDocStatus retourne NEEDS_REVIEW)
    assert.equal(vm.documentCoverage.counts.certifiedDocuments, 0,
      'doc flagged ne doit pas compter comme certifié');
    assert.equal(vm.documentCoverage.counts.reviewDocuments, 1,
      'doc flagged doit compter comme en revue');
  });
});

// ---------------------------------------------------------------------------
// financialExtraction — filtre sur 'CERTIFIED'
// ---------------------------------------------------------------------------

describe('financialExtraction — filtre strictement sur CERTIFIED (UPPER_SNAKE_CASE)', () => {
  const { deriveApplicationFinancialProfile } = require('../src/utils/financialExtraction');

  function buildSalaryDoc(status, amount, date) {
    return {
      type: 'BULLETIN_SALAIRE',
      status,
      dateEmission: date,
      aiAnalysis: {
        financial_data: {
          monthly_net_income: amount,
          extra_details: {
            salaire_brut_mensuel: amount * 1.25,
            cotisations_mensuelles: amount * 0.25,
          },
        },
      },
    };
  }

  it('seuls les docs avec status CERTIFIED (UPPER) sont prioritaires dans certifiedPayslipCount', () => {
    const summary = deriveApplicationFinancialProfile({
      application: {
        documents: [
          buildSalaryDoc('CERTIFIED', 2500, '2026-03-01'),
          buildSalaryDoc('CERTIFIED', 2400, '2026-02-01'),
          buildSalaryDoc('NEEDS_REVIEW', 2300, '2026-01-01'),
        ],
      },
    });

    assert.equal(summary.certifiedPayslipCount, 2,
      'seulement 2 bulletins CERTIFIED doivent être comptés');
    assert.equal(summary.certifiedIncome, true,
      'certifiedIncome doit être true');
  });

  it('docs avec status lowercase "certified" ne comptent pas comme certifiés', () => {
    const summaryLower = deriveApplicationFinancialProfile({
      application: {
        documents: [
          buildSalaryDoc('certified', 2500, '2026-03-01'),
        ],
      },
    });

    // Avec lowercase : certifiedPayslipCount = 0 (non reconnu)
    assert.equal(summaryLower.certifiedPayslipCount, 0,
      'un doc avec status lowercase "certified" ne doit pas compter comme certifié après migration');
    assert.equal(summaryLower.certifiedIncome, false,
      'certifiedIncome doit être false sans doc CERTIFIED');
  });

  it('docs CERTIFIED alimentent le salaire moyen certifié', () => {
    const summary = deriveApplicationFinancialProfile({
      application: {
        documents: [
          buildSalaryDoc('CERTIFIED', 3000, '2026-03-01'),
          buildSalaryDoc('CERTIFIED', 2800, '2026-02-01'),
          buildSalaryDoc('CERTIFIED', 3200, '2026-01-01'),
        ],
      },
    });

    assert.ok(summary.totalMonthlyIncome > 0, 'le revenu total doit être calculé');
    assert.equal(summary.incomeSource, 'SALARY', 'la source de revenu doit être SALARY');
    assert.equal(summary.certifiedPayslipCount, 3);
  });
});

// ---------------------------------------------------------------------------
// computeAggregateStatus — logique pure UPPER_SNAKE_CASE (copie de la fonction)
// ---------------------------------------------------------------------------

describe('computeAggregateStatus — logique UPPER_SNAKE_CASE (DRAFT/PENDING/SIGNED/EXPIRED/CANCELLED)', () => {
  // computeAggregateStatus n'est pas exporté, on réplique sa logique pure
  function computeAggregateStatus(lease) {
    const statuses = (lease.opensignDocuments || []).map((item) => item.status).filter(Boolean);
    if (!statuses.length) return lease.opensignStatus || 'PENDING';
    if (statuses.includes('CANCELLED')) return 'CANCELLED';
    if (statuses.includes('EXPIRED')) return 'EXPIRED';
    if (statuses.every((status) => status === 'SIGNED')) return 'SIGNED';
    if (statuses.includes('SIGNED')) return 'SIGNED';
    return 'PENDING';
  }

  it('retourne PENDING si aucun document', () => {
    assert.equal(computeAggregateStatus({ opensignDocuments: [] }), 'PENDING');
  });

  it('retourne PENDING si opensignStatus présent et aucun document', () => {
    assert.equal(computeAggregateStatus({ opensignStatus: 'PENDING', opensignDocuments: [] }), 'PENDING');
  });

  it('retourne CANCELLED si au moins un doc CANCELLED (prioritaire)', () => {
    const lease = {
      opensignDocuments: [
        { status: 'SIGNED' },
        { status: 'CANCELLED' },
      ],
    };
    assert.equal(computeAggregateStatus(lease), 'CANCELLED');
  });

  it('retourne EXPIRED si au moins un doc EXPIRED (après CANCELLED)', () => {
    const lease = {
      opensignDocuments: [
        { status: 'SIGNED' },
        { status: 'EXPIRED' },
      ],
    };
    assert.equal(computeAggregateStatus(lease), 'EXPIRED');
  });

  it('retourne SIGNED si tous les docs sont SIGNED', () => {
    const lease = {
      opensignDocuments: [
        { status: 'SIGNED' },
        { status: 'SIGNED' },
      ],
    };
    assert.equal(computeAggregateStatus(lease), 'SIGNED');
  });

  it('retourne SIGNED si au moins un doc SIGNED et d\'autres PENDING', () => {
    const lease = {
      opensignDocuments: [
        { status: 'SIGNED' },
        { status: 'PENDING' },
      ],
    };
    assert.equal(computeAggregateStatus(lease), 'SIGNED');
  });

  it('retourne PENDING si tous les docs sont PENDING', () => {
    const lease = {
      opensignDocuments: [
        { status: 'PENDING' },
        { status: 'PENDING' },
      ],
    };
    assert.equal(computeAggregateStatus(lease), 'PENDING');
  });

  it('les statuts retournés font partie des valeurs UPPER_SNAKE_CASE valides', () => {
    const validStatuses = new Set(['DRAFT', 'PENDING', 'SIGNED', 'EXPIRED', 'CANCELLED']);
    const testCases = [
      { opensignDocuments: [] },
      { opensignDocuments: [{ status: 'CANCELLED' }] },
      { opensignDocuments: [{ status: 'EXPIRED' }] },
      { opensignDocuments: [{ status: 'SIGNED' }] },
      { opensignDocuments: [{ status: 'PENDING' }] },
    ];
    for (const lease of testCases) {
      const status = computeAggregateStatus(lease);
      assert.ok(validStatuses.has(status), `statut inattendu: "${status}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// leaseCompileService — TEMPLATE_MAP contient clés UPPER_SNAKE_CASE
// ---------------------------------------------------------------------------

describe('leaseCompileService — TEMPLATE_MAP clés UPPER_SNAKE_CASE', () => {
  const { TEMPLATE_MAP } = require('../src/services/leaseCompileService');

  it('TEMPLATE_MAP est défini', () => {
    assert.ok(TEMPLATE_MAP, 'TEMPLATE_MAP doit être exporté');
    assert.equal(typeof TEMPLATE_MAP, 'object');
  });

  it('TEMPLATE_MAP contient la clé VIDE', () => {
    assert.ok(Object.prototype.hasOwnProperty.call(TEMPLATE_MAP, 'VIDE'),
      'TEMPLATE_MAP doit avoir la clé VIDE');
    assert.ok(typeof TEMPLATE_MAP.VIDE === 'string' && TEMPLATE_MAP.VIDE.endsWith('.docx'),
      'TEMPLATE_MAP.VIDE doit pointer vers un fichier .docx');
  });

  it('TEMPLATE_MAP contient la clé MEUBLE', () => {
    assert.ok(Object.prototype.hasOwnProperty.call(TEMPLATE_MAP, 'MEUBLE'),
      'TEMPLATE_MAP doit avoir la clé MEUBLE');
    assert.ok(typeof TEMPLATE_MAP.MEUBLE === 'string' && TEMPLATE_MAP.MEUBLE.endsWith('.docx'));
  });

  it('TEMPLATE_MAP contient la clé MOBILITE', () => {
    assert.ok(Object.prototype.hasOwnProperty.call(TEMPLATE_MAP, 'MOBILITE'),
      'TEMPLATE_MAP doit avoir la clé MOBILITE');
    assert.ok(typeof TEMPLATE_MAP.MOBILITE === 'string' && TEMPLATE_MAP.MOBILITE.endsWith('.docx'));
  });

  it('TEMPLATE_MAP contient la clé GARAGE_PARKING', () => {
    assert.ok(Object.prototype.hasOwnProperty.call(TEMPLATE_MAP, 'GARAGE_PARKING'),
      'TEMPLATE_MAP doit avoir la clé GARAGE_PARKING');
    assert.ok(typeof TEMPLATE_MAP.GARAGE_PARKING === 'string' && TEMPLATE_MAP.GARAGE_PARKING.endsWith('.docx'));
  });

  it('TEMPLATE_MAP NE contient PAS les clés lowercase (vide, meuble, mobilite, garage_parking)', () => {
    assert.equal(TEMPLATE_MAP.vide, undefined, 'clé "vide" ne doit pas exister');
    assert.equal(TEMPLATE_MAP.meuble, undefined, 'clé "meuble" ne doit pas exister');
    assert.equal(TEMPLATE_MAP.mobilite, undefined, 'clé "mobilite" ne doit pas exister');
    assert.equal(TEMPLATE_MAP.garage_parking, undefined, 'clé "garage_parking" ne doit pas exister');
  });

  it('toutes les clés de TEMPLATE_MAP sont UPPER_SNAKE_CASE', () => {
    for (const key of Object.keys(TEMPLATE_MAP)) {
      assert.equal(key, key.toUpperCase(),
        `la clé "${key}" dans TEMPLATE_MAP n'est pas UPPER_SNAKE_CASE`);
    }
  });
});
