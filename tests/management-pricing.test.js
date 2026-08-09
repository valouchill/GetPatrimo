const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Charge un module TS en le transpilant (source unique de la tarification). */
function loadTs(rel) {
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const tmp = path.join(require('os').tmpdir(), `mp-${Date.now()}.js`);
  fs.writeFileSync(tmp, out);
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod;
}

const P = loadTs('lib/billing/management-pricing.ts');

describe('grille tarifaire de l’abonnement Sérénité', () => {
  it('positionnement face au marché français (relevé août 2026)', () => {
    // BailFacile 9,99 €/mois annuel · Smartloc 6,50 €/mois · Rentila 49 €/an
    assert.ok(P.MANAGEMENT_PRICES.monthly.standard < 6.5, 'moins cher que Smartloc');
    assert.ok(P.MANAGEMENT_PRICES.yearly.standard <= 49.9, 'aligné sur le prix d’appel de Rentila');
  });

  it('l’annuel offre exactement 2 mois', () => {
    assert.equal(P.MANAGEMENT_PRICES.yearly.standard, Math.round(P.MANAGEMENT_PRICES.monthly.standard * 10 * 100) / 100);
    assert.equal(P.MANAGEMENT_PRICES.yearly.volume, Math.round(P.MANAGEMENT_PRICES.monthly.volume * 10 * 100) / 100);
  });

  it('la dégressivité démarre au 3e logement, pas avant', () => {
    assert.equal(P.isVolumeRate(0), false); // 1er
    assert.equal(P.isVolumeRate(1), false); // 2e
    assert.equal(P.isVolumeRate(2), true);  // 3e
    assert.equal(P.priceFor('monthly', 0), 4.99);
    assert.equal(P.priceFor('monthly', 2), 3.49);
  });

  it('le calcul multi-biens est correct', () => {
    let total = 0;
    for (let i = 0; i < 5; i += 1) total += P.priceFor('monthly', i);
    assert.equal(Math.round(total * 100) / 100, 20.45); // 2×4,99 + 3×3,49
  });

  it('l’économie annuelle annoncée est exacte', () => {
    assert.equal(P.yearlySavings(0), 9.98);
  });

  it('replie sur le tarif standard si le prix dégressif n’est pas configuré', () => {
    // Mieux vaut facturer le prix normal que refuser une vente.
    const env = { PRICE_ID_MANAGEMENT_MONTHLY: 'price_std' };
    assert.equal(P.resolvePriceId('monthly', 5, env), 'price_std');
    assert.equal(P.resolvePriceId('monthly', 0, {}), null); // rien de configuré → offre fermée
  });

  it('choisit bien le prix dégressif quand il existe', () => {
    const env = { PRICE_ID_MANAGEMENT_MONTHLY: 'price_std', PRICE_ID_MANAGEMENT_MONTHLY_VOLUME: 'price_vol' };
    assert.equal(P.resolvePriceId('monthly', 0, env), 'price_std');
    assert.equal(P.resolvePriceId('monthly', 2, env), 'price_vol');
  });
});

describe('cohérence des surfaces de vente', () => {
  it('landing, upsell et CGV lisent la MÊME source (plus de prix en dur)', () => {
    for (const rel of [
      'app/(platform)/LandingClient.tsx',
      'app/(platform)/dashboard/owner/components/ManagementUpsell.tsx',
      'app/(platform)/cgv/page.tsx',
    ]) {
      assert.match(read(rel), /billing\/management-pricing/, `${rel} doit lire la source unique`);
    }
  });

  it('aucune surface n’affiche encore un prix codé en dur', () => {
    for (const rel of [
      'app/(platform)/dashboard/owner/components/ManagementUpsell.tsx',
      'app/(platform)/cgv/page.tsx',
    ]) {
      const src = read(rel);
      assert.ok(!src.includes('4,99 €'), `${rel} : prix en dur`);
      assert.ok(!src.includes('49,90 €'), `${rel} : prix en dur`);
    }
  });

  it('les inclusions annoncées sont identiques partout', () => {
    assert.equal(P.MANAGEMENT_INCLUDES.length, 4);
    assert.match(P.MANAGEMENT_INCLUDES.join(' '), /Stockage et archivage/);
    for (const rel of [
      'app/(platform)/LandingClient.tsx',
      'app/(platform)/dashboard/owner/components/ManagementUpsell.tsx',
    ]) {
      assert.match(read(rel), /MANAGEMENT_INCLUDES/, `${rel}`);
    }
  });

  it('la route de souscription applique la dégressivité sur les abonnements ACTIFS', () => {
    const route = read('app/api/billing/management/route.ts');
    assert.match(route, /Property\.countDocuments\(\{\s*user: user\._id,\s*'management\.active': true,/);
    assert.match(route, /resolvePriceId\(billingCycle, activeSubscriptions\)/);
  });

  it('les CGV décrivent le prix, l’annuel ET la dégressivité (obligation d’information)', () => {
    const cgv = read('app/(platform)/cgv/page.tsx');
    assert.match(cgv, /Tarif dégressif multi-biens/);
    assert.match(cgv, /deux\s*\n?\s*mois offerts/);
    assert.match(cgv, /ne modifie pas/); // non-rétroactivité précisée
  });
});
