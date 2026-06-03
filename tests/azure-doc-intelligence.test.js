const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  isAzureConfigured,
  pickAzureModel,
  mapAzurePayslipToRaw,
  mapAzureAvisToRaw,
  mapAzureLayoutIdToRaw,
  mapAzureToRaw,
  parseFrenchNumber,
} = require('../src/services/azureDocIntelligenceService');

const readFixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

const payslip = readFixture('azure-layout-payslip.json');
const avis = readFixture('azure-layout-avis.json');
const cni = readFixture('azure-layout-cni.json');

test('parseFrenchNumber handles French thousands/decimals (incl. spaced)', () => {
  assert.equal(parseFrenchNumber('4.131,45'), 4131.45);
  assert.equal(parseFrenchNumber('927,93'), 927.93);
  assert.equal(parseFrenchNumber('20.351,99'), 20351.99);
  assert.equal(parseFrenchNumber('35 334'), 35334); // séparateur de milliers = espace
  assert.equal(parseFrenchNumber('rien'), null);
});

test('mapAzurePayslipToRaw extracts real values from a prebuilt-layout payslip', () => {
  const raw = mapAzurePayslipToRaw(payslip.analyzeResult, { fileName: 'paie.pdf' });
  const ed = raw.financial_data.extra_details;

  assert.equal(raw.document_metadata.type, 'BULLETIN_SALAIRE');
  assert.equal(ed.salaire_brut_mensuel, 4131.45);
  assert.equal(ed.cotisations_mensuelles, 927.93);
  assert.equal(ed.net_fiscal, 3359.07);
  assert.equal(ed.net_social, 3203.52);
  assert.equal(ed.net_a_payer, 3012.71);
  // Net retenu = net à payer après impôt
  assert.equal(raw.financial_data.monthly_net_income, 3012.71);
  // Contrôle math déterministe : Brut − Charges = Net social
  assert.equal(raw.trust_and_security.math_validation, true);
  // Identité
  assert.match(raw.document_metadata.owner_name, /VETTESE/);
  assert.match(raw.document_metadata.owner_name, /Valentin/);
  // Période → date d'émission = fin de période
  assert.equal(raw.document_metadata.date_emission, '30.04.2026');
  assert.equal(raw.analysisMethod, 'azure_doc_intelligence');
});

test('mapAzureAvisToRaw extracts the sealed RFR + fiscal IDs from a real avis', () => {
  const raw = mapAzureAvisToRaw(avis.analyzeResult, { fileName: 'avis.pdf' });
  const ed = raw.financial_data.extra_details;

  assert.equal(raw.document_metadata.type, 'AVIS_IMPOSITION');
  assert.equal(ed.revenu_fiscal_reference, 35334);
  assert.equal(ed.numero_fiscal, '3012534769188');
  assert.equal(ed.reference_avis, '2375036155182');
  assert.equal(ed.nombre_parts, 1);
  assert.equal(ed.annee_revenus, 2022);
  // Proxy mensuel = RFR / 12
  assert.ok(Math.abs(raw.financial_data.monthly_net_income - 35334 / 12) < 0.01);
  // Identité du déclarant
  assert.match(raw.document_metadata.owner_name, /VETTESE/);
  assert.match(raw.document_metadata.owner_name, /Valentin/);
  assert.equal(raw.analysisMethod, 'azure_doc_intelligence');
});

test('mapAzureLayoutIdToRaw parses a real CNI via the TD1 MRZ (prebuilt-layout)', () => {
  const raw = mapAzureLayoutIdToRaw(cni.analyzeResult, { fileName: 'cni.jpg' });
  const ts = raw.trust_and_security;
  const ed = raw.financial_data.extra_details;

  assert.equal(raw.document_metadata.type, 'CARTE_IDENTITE');
  assert.match(raw.document_metadata.owner_name, /MARTIN/);
  assert.match(raw.document_metadata.owner_name, /Maelys/);
  // Dates : validité depuis la MRZ (clé de contrôle), délivrance depuis le visuel
  assert.equal(raw.document_metadata.date_validite, '11.02.2030');
  assert.equal(raw.document_metadata.date_emission, '12.02.2020');
  // MRZ déterministe → alimente validateMRZ
  assert.equal(ts.mrz_line1.length, 30);
  assert.ok(ts.mrz_line1.startsWith('IDFRA'));
  assert.ok(ts.mrz_line2.startsWith('9007138F300211'));
  assert.match(ts.mrz_line3, /MARTIN/);
  // Champs extraits de la MRZ
  assert.equal(ed.document_number, 'X4RTBPFW4');
  assert.equal(ed.date_naissance, '13.07.1990');
  assert.equal(ed.nationalite, 'FRA');
  assert.equal(raw.financial_data.monthly_net_income, 0);
  assert.equal(raw.analysisMethod, 'azure_doc_intelligence');
});

test('mapAzureToRaw dispatches CNI/avis/payslip by content sniff', () => {
  assert.equal(
    mapAzureToRaw(cni.analyzeResult, 'prebuilt-layout', {}).document_metadata.type,
    'CARTE_IDENTITE',
  );
  assert.equal(
    mapAzureToRaw(avis.analyzeResult, 'prebuilt-layout', {}).document_metadata.type,
    'AVIS_IMPOSITION',
  );
  assert.equal(
    mapAzureToRaw(payslip.analyzeResult, 'prebuilt-layout', {}).document_metadata.type,
    'BULLETIN_SALAIRE',
  );
});

test('isAzureConfigured requires keys + EU region (RGPD)', () => {
  const save = { ...process.env };
  try {
    delete process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT;
    delete process.env.AZURE_DOC_INTELLIGENCE_KEY;
    delete process.env.AZURE_OCR_DISABLED;
    assert.equal(isAzureConfigured(), false, 'no keys → false');

    process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT = 'https://x.eastus.cognitiveservices.azure.com/';
    process.env.AZURE_DOC_INTELLIGENCE_KEY = 'k';
    assert.equal(isAzureConfigured(), false, 'non-EU region → false');

    process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT = 'https://x.westeurope.cognitiveservices.azure.com/';
    assert.equal(isAzureConfigured(), true, 'EU region → true');

    process.env.AZURE_OCR_DISABLED = 'true';
    assert.equal(isAzureConfigured(), false, 'kill-switch → false');
  } finally {
    process.env = save;
  }
});

test('pickAzureModel routes covered types to prebuilt-layout', () => {
  assert.equal(pickAzureModel('identity', 'CARTE_IDENTITE'), 'prebuilt-layout');
  assert.equal(pickAzureModel(null, 'BULLETIN_SALAIRE'), 'prebuilt-layout');
  assert.equal(pickAzureModel('resources', null), 'prebuilt-layout');
  assert.equal(pickAzureModel(null, 'AVIS_IMPOSITION'), 'prebuilt-layout');
  assert.equal(pickAzureModel('guarantor', 'AUTRE'), null);
});
