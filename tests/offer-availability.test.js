const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * On n'annonce jamais un prix pour une offre qui n'est pas achetable.
 *
 * Le flag de feature MANAGEMENT ne dit que « le module existe » ; la vente
 * dépend d'un prix Stripe (PRICE_ID_MANAGEMENT_MONTHLY). Sans lui, la route de
 * souscription répond 503 — une landing publique affichant « 4,99 €/mois » avec
 * un bouton menait donc à une erreur.
 */
describe('cohérence offre affichée / offre achetable', () => {
  it('la landing conditionne la vente à la disponibilité RÉELLE', () => {
    const client = read('app/(platform)/LandingClient.tsx');
    assert.match(client, /isEnabled\('MANAGEMENT'\) && managementPurchasable \?/);
    assert.match(client, /managementPurchasable = false/); // défaut sûr
  });

  it('seule la page serveur peut lire le prix Stripe et le transmet', () => {
    const page = read('app/(platform)/page.tsx');
    assert.match(page, /PRICE_ID_MANAGEMENT_MONTHLY/);
    assert.match(page, /managementPurchasable=\{managementPurchasable\}/);
  });

  it('la même condition pilote l’upsell du dashboard', () => {
    assert.match(read('app/api/dashboard/route.ts'), /offerLive: Boolean\(process\.env\.PRICE_ID_MANAGEMENT_MONTHLY\)/);
  });

  it('et la route de souscription dégrade proprement si le prix manque', () => {
    assert.match(read('app/api/billing/management/route.ts'), /503/);
  });
});
