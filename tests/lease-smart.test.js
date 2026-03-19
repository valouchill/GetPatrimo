const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INPUT_LINE_FALLBACK,
  TEXT_SOFT_FALLBACK,
  buildLeaseArtifacts,
  buildLeaseData,
  getSoftFallbackValue,
} = require('../src/utils/leaseDataBuilder');
const { extractTemplateVariables } = require('../src/utils/leaseTemplateInventory');
const {
  computeSmartDeposit,
  getTomorrowDateInputValue,
  shouldGenerateGuaranteeDocument,
} = require('../src/utils/leaseWizardShared');

test('buildLeaseData maps landlord checkboxes and french words', () => {
  const data = buildLeaseData(
    {
      address: '12 rue de Paris, 75010 Paris',
      rentAmount: 1200,
      chargesAmount: 150,
      surfaceM2: 42,
      city: 'Paris',
      zipCode: '75010',
      constructionYear: 1982,
    },
    {
      firstName: 'Alice',
      lastName: 'Martin',
      email: 'alice@example.com',
      guarantor: {
        firstName: 'Paul',
        lastName: 'Martin',
        email: 'paul@example.com',
      },
    },
    {
      firstName: 'Luc',
      lastName: 'Durand',
      email: 'luc@example.com',
      city: 'Paris',
      type: 'person',
    },
    {
      leaseType: 'vide',
      startDate: '2026-03-13',
      paymentDay: 5,
      rentHC: 1200,
      charges: 150,
      deposit: 1200,
    }
  );

  assert.equal(data.coche_bailleur_personne_physique, '☒');
  assert.equal(data.coche_bailleur_personne_morale, '☐');
  assert.equal(data.loyer_chiffres, '1200.00');
  assert.match(data.loyer_lettres, /mille/i);
  assert.equal(data.locataire_nom_prenom, 'Alice Martin');
  assert.equal(data.caution_nom_prenom, 'Paul Martin');
});

test('buildLeaseData maps company landlord and mobility-specific defaults', () => {
  const data = buildLeaseData(
    {
      address: '5 avenue Foch, 75016 Paris',
      rentAmount: 900,
      chargesAmount: 0,
      surfaceM2: 24,
      city: 'Paris',
      zipCode: '75016',
      constructionYear: 1930,
    },
    {
      firstName: 'Nina',
      lastName: 'Petit',
      email: 'nina@example.com',
    },
    {
      companyName: 'SCI Opale',
      email: 'contact@sci-opale.fr',
      city: 'Paris',
      type: 'company',
    },
    {
      leaseType: 'mobilite',
      startDate: '2026-03-13',
      durationMonths: 8,
      mobilityReason: 'stage en entreprise',
    }
  );

  assert.equal(data.coche_bailleur_personne_physique, '☐');
  assert.equal(data.coche_bailleur_personne_morale, '☒');
  assert.equal(data.depot_garantie, '0.00');
  assert.equal(data.coche_situation_stage, '☒');
  assert.equal(data.coche_avant_1949, '☒');
});

test('shared wizard helpers compute deposit, tomorrow date and guarantee rules', () => {
  assert.equal(computeSmartDeposit('meuble', 980), 1960);
  assert.equal(computeSmartDeposit('vide', 980), 980);
  assert.equal(computeSmartDeposit('mobilite', 980), 0);
  assert.equal(getTomorrowDateInputValue(new Date('2026-03-12T10:00:00.000Z')), '2026-03-13');
  assert.equal(shouldGenerateGuaranteeDocument('vide', { email: 'g@example.com' }), true);
  assert.equal(shouldGenerateGuaranteeDocument('mobilite', { email: 'g@example.com' }), false);
});

test('template inventory extracts placeholders from lease templates', () => {
  const variables = extractTemplateVariables('Modele_Bail_Type_Location_Meublee_loi_Alur_template.docx');

  assert.ok(variables.length > 100);
  assert.ok(variables.includes('surface_habitable_m2'));
  assert.ok(variables.includes('dpe_classe'));
  assert.ok(variables.includes('duree_contrat'));
});

test('buildLeaseArtifacts replaces missing values with visible soft fallbacks and warnings', () => {
  const templateVariables = [
    'surface_habitable_m2',
    'date_dpe',
    'dernier_loyer_infos',
    'coche_mandataire_oui',
    'autres_conditions_particulieres_ligne_1',
  ];

  const artifacts = buildLeaseArtifacts(
    {
      address: '10 rue des Tests, 75011 Paris',
      rentAmount: 980,
      chargesAmount: 45,
      city: 'Paris',
      zipCode: '75011',
    },
    {
      firstName: 'Lea',
      lastName: 'Bernard',
      email: 'lea@example.com',
    },
    {
      firstName: 'Hugo',
      lastName: 'Morel',
      email: 'hugo@example.com',
      type: 'person',
      city: 'Paris',
    },
    {
      leaseType: 'vide',
      startDate: '2026-03-13',
    },
    templateVariables,
  );

  assert.equal(artifacts.mergeData.surface_habitable_m2, TEXT_SOFT_FALLBACK);
  assert.equal(artifacts.mergeData.date_dpe, INPUT_LINE_FALLBACK);
  assert.equal(artifacts.mergeData.dernier_loyer_infos, TEXT_SOFT_FALLBACK);
  assert.equal(artifacts.mergeData.coche_mandataire_oui, '☐');
  assert.equal(artifacts.mergeData.autres_conditions_particulieres_ligne_1, INPUT_LINE_FALLBACK);
  assert.ok(artifacts.warnings.includes('Surface habitable'));
  assert.ok(artifacts.warnings.includes('Date DPE'));
  assert.ok(artifacts.warnings.includes('Montant du dernier loyer'));
});

test('soft fallback helper uses empty box for checkboxes and visible placeholders for text', () => {
  assert.equal(getSoftFallbackValue('coche_chauffage_individuel'), '☐');
  assert.equal(getSoftFallbackValue('date_dpe'), INPUT_LINE_FALLBACK);
  assert.equal(getSoftFallbackValue('dpe_classe'), TEXT_SOFT_FALLBACK);
});
