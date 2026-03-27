const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ─── Décret n°2015-1437 du 5 novembre 2015 ─────────────────────
// Vérifie qu'aucun document interdit n'est demandé aux candidats.

describe('Décret 2015-1437 — forbidden document keywords in ApplyClient', () => {
  const applyClientPath = path.join(__dirname, '..', 'app', 'apply', '[id]', 'ApplyClient.tsx');
  const content = fs.readFileSync(applyClientPath, 'utf8');
  const lower = content.toLowerCase();

  it('blocks carte vitale', () => {
    assert.ok(lower.includes("'carte vitale'") || lower.includes('"carte vitale"'));
  });

  it('blocks relevé bancaire', () => {
    assert.ok(lower.includes("'releve bancaire'") || lower.includes('"releve bancaire"'));
  });

  it('blocks relevé de compte', () => {
    assert.ok(lower.includes("'releve de compte'") || lower.includes('"releve de compte"'));
  });

  it('blocks attestation bancaire', () => {
    assert.ok(lower.includes("'attestation bancaire'") || lower.includes('"attestation bancaire"'));
  });

  it('blocks casier judiciaire', () => {
    assert.ok(lower.includes("'casier judiciaire'") || lower.includes('"casier judiciaire"'));
  });

  it('blocks dossier médical', () => {
    assert.ok(lower.includes("'dossier medical'") || lower.includes("'dossier médical'"));
  });

  it('blocks contrat de mariage', () => {
    assert.ok(lower.includes("'contrat de mariage'") || lower.includes('"contrat de mariage"'));
  });

  it('blocks photo d\'identité séparée', () => {
    assert.ok(lower.includes("'photo identite'") || lower.includes("'photo d\\'identite'"));
  });

  it('blocks RIB/IBAN/BIC', () => {
    assert.ok(lower.includes("'rib'"));
    assert.ok(lower.includes("'iban'"));
    assert.ok(lower.includes("'bic'"));
  });
});

describe('Décret 2015-1437 — Application model does not store forbidden types', () => {
  const appModelPath = path.join(__dirname, '..', 'models', 'Application.js');
  const content = fs.readFileSync(appModelPath, 'utf8').toLowerCase();

  it('no carte vitale in document categories', () => {
    assert.ok(!content.includes('carte_vitale'));
    assert.ok(!content.includes('vitale'));
  });

  it('no bank statement category', () => {
    assert.ok(!content.includes('releve_bancaire'));
    assert.ok(!content.includes('bank_statement'));
  });

  it('no criminal record category', () => {
    assert.ok(!content.includes('casier_judiciaire'));
    assert.ok(!content.includes('criminal_record'));
  });

  it('no medical record category', () => {
    assert.ok(!content.includes('dossier_medical'));
    assert.ok(!content.includes('medical_record'));
  });
});

describe('Décret 2015-1437 — Property requiredDocuments', () => {
  const propertyModelPath = path.join(__dirname, '..', 'models', 'Property.js');
  const content = fs.readFileSync(propertyModelPath, 'utf8').toLowerCase();

  it('no hardcoded forbidden document names in Property model', () => {
    const forbidden = ['carte vitale', 'casier judiciaire', 'dossier médical', 'contrat de mariage', 'relevé bancaire'];
    for (const term of forbidden) {
      assert.ok(!content.includes(term), `Property model should not contain "${term}"`);
    }
  });
});
