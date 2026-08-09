const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Dernière vague de l'état des lieux : cohérence de données, UX, conversion, légal. */

describe('modèle Lease — plus de vocabulaire divergent', () => {
  const mongoose = require('mongoose');
  const Lease = require('../models/Lease');

  const build = (leaseType, depositAmount) => new Lease({
    user: new mongoose.Types.ObjectId(),
    property: new mongoose.Types.ObjectId(),
    tenantEmail: 'a@b.c', tenantFirstName: 'Bob', tenantLastName: 'L',
    startDate: new Date(), rentAmount: 800,
    leaseType, depositAmount,
  });

  const runHooks = (doc) => new Promise((resolve) => {
    Lease.schema.s.hooks.execPre('save', doc, [], (err) => resolve(err));
  });

  it('propertyType est DÉRIVÉ de leaseType (il pouvait diverger)', async () => {
    for (const [type, deposit, expected] of [
      ['MEUBLE', 1600, 'MEUBLE'],
      ['VIDE', 800, 'NU'],          // « VIDE » et « NU » désignaient la même chose
      ['MOBILITE', 0, 'MOBILITE'],
      ['GARAGE_PARKING', 500, 'GARAGE_PARKING'],
    ]) {
      const doc = build(type, deposit);
      const err = await runHooks(doc);
      assert.equal(err, null, `${type} ne doit pas être rejeté`);
      assert.equal(doc.propertyType, expected, `${type} → ${expected}`);
    }
  });

  it('les garde-fous de dépôt restent actifs', async () => {
    assert.ok(await runHooks(build('MOBILITE', 300)), 'dépôt interdit en bail mobilité');
    assert.ok(await runHooks(build('VIDE', 900)), 'dépôt > 1 mois interdit en bail nu');
    assert.ok(await runHooks(build('MEUBLE', 2400)), 'dépôt > 2 mois interdit en meublé');
  });
});

describe('cohérence UX des modules gestion', () => {
  it('les trois modules partagent la même primitive de chargement', () => {
    for (const rel of [
      'app/(platform)/dashboard/owner/components/LoyersPanel.tsx',
      'app/(platform)/dashboard/owner/components/BauxPanel.tsx',
      'app/(platform)/dashboard/owner/components/EdlPanel.tsx',
    ]) {
      const src = read(rel);
      assert.match(src, /LoadingSpinner/, `${rel} : état de chargement non harmonisé`);
      // le libellé accessible est obligatoire (annonce lecteur d'écran)
      assert.match(src, /label="Chargement/, `${rel} : spinner sans libellé`);
    }
  });
});

describe('conversion', () => {
  it('la page pricing porte des engagements VÉRIFIABLES (aucun faux témoignage)', () => {
    const src = read('app/(platform)/pricing/PricingTiers.tsx');
    assert.match(src, /Essayez avant de payer/);
    assert.match(src, /Vos données restent en France/);
    // garde-fou : pas de compteur ni d'avis inventés
    assert.ok(!/[0-9]{3,}\s*(bailleurs|clients|utilisateurs)/i.test(src));
  });

  it('la Gestion est proposée juste après un achat réussi', () => {
    const src = read('app/(platform)/dashboard/owner/OwnerDashboardClient.tsx');
    assert.match(src, /checkoutSuccess && !activationPending && dashData\.hasPaidProperty/);
  });
});

describe('documents légaux — versioning centralisé', () => {
  it('les 4 pages lisent la même source de version', () => {
    for (const rel of [
      'app/(platform)/cgv/page.tsx',
      'app/(platform)/privacy/page.tsx',
      'app/(platform)/terms/page.tsx',
      'app/(platform)/mentions-legales/page.tsx',
    ]) {
      assert.match(read(rel), /LEGAL_VERSIONS/, `${rel} affiche une date en dur`);
    }
  });

  it('les documents modifiés portent une date à jour et un résumé', () => {
    const src = read('lib/legal/versions.ts');
    // CGV et privacy ont été modifiées en profondeur : leur date doit l'être aussi
    assert.match(src, /cgv: \{\s*date: '2026-08-09'/);
    assert.match(src, /privacy: \{\s*date: '2026-08-09'/);
    assert.match(src, /summary:/);
  });
});
