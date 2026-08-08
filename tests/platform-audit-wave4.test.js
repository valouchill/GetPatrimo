const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('acte de cautionnement — art. 2297 C. civ.', () => {
  const { computeGuaranteeAmount } = require('../src/services/leaseSignatureService');

  it('calcule l’engagement sur loyer + charges × durée', () => {
    assert.equal(computeGuaranteeAmount({ rentAmount: 800, chargesAmount: 50, durationMonths: 12 }), 10200);
    assert.equal(computeGuaranteeAmount({ rentAmount: 500, durationMonths: 1 }), 500);
  });

  it('la caution doit APPOSER elle-même sa mention (pré-remplie = nullité)', () => {
    const src = read('src/services/leaseSignatureService.js');
    assert.match(src, /signature\.role === 'GUARANTOR'/);
    assert.match(src, /art\. 2297/);
    // la mention doit porter le montant exact
    assert.match(src, /digitsOnly\.includes\(expectedDigits\)/);
    // longueur minimale : une mention vide ou d'un mot ne vaut pas engagement
    assert.match(src, /mention\.length < 20/);
  });

  it('la mention figure au certificat comme élément de preuve', () => {
    assert.match(read('src/services/leaseSignatureService.js'), /Mention apposée par la caution/);
  });

  it('le parcours public expose le montant sans pré-remplir le texte', () => {
    const route = read('app/api/public/sign/[token]/route.ts');
    assert.match(route, /computeGuaranteeAmount\(lease\)/);
    const ui = read('app/sign/[token]/SignClient.tsx');
    assert.match(ui, /Recopiez cette mention/);
    // le champ ne doit PAS être pré-rempli : seulement un placeholder d'exemple
    assert.match(ui, /value=\{guaranteeMention\}/);
    assert.match(ui, /placeholder=\{`Exemple/);
    assert.match(ui, /guaranteeMention\.trim\(\)\.length < 20/); // bouton bloqué
  });
});

describe('quittances — un seul document possible', () => {
  it('generateReceipt délègue à la V2 (les deux mises en page divergeaient)', () => {
    const src = read('lib/services/paymentService.ts');
    const alias = src.slice(src.indexOf('export async function generateReceipt(p'), src.indexOf('async function generateReceiptLegacyV1'));
    assert.match(alias, /return generateReceiptV2\(payment\)/);
  });
});

describe('retour de paiement Stripe', () => {
  const src = read('app/(platform)/dashboard/owner/OwnerDashboardClient.tsx');
  it('sonde plusieurs fois au lieu d’un unique refresh à 2,5 s', () => {
    assert.match(src, /const delays = \[1500, 3000, 5000, 8000, 12000\]/);
    assert.ok(!src.includes('setTimeout(() => { refresh(); }, 2500)'));
  });
  it('affiche « activation en cours » puis un recours manuel', () => {
    assert.match(src, /activation de votre offre en cours/);
    assert.match(src, /Actualiser/);
  });
});

describe('upsell Gestion — présent au bon moment', () => {
  it('est aussi rendu dans l’onglet Baux (juste après la signature)', () => {
    const src = read('app/(platform)/dashboard/owner/OwnerDashboardClient.tsx');
    assert.match(src, /import \{ ManagementUpsell \}/);
    const bauxBlock = src.slice(src.indexOf("{page === 'baux'"), src.indexOf('<BauxPanel'));
    assert.match(bauxBlock, /ManagementUpsell/);
  });
});
