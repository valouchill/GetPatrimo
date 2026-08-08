const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Abonnement « Gestion locative » (4,99 €/mois/bien) — garde-fous.
 *
 * L'enjeu principal est un PIÈGE identifié en revue : le handler de résiliation
 * Stripe remettait `tier:'FREE'` et `dossiersQuota:0`. Sans cloisonnement, un
 * client qui résilie la gestion à 4,99 € perdrait aussi les crédits d'audit
 * qu'il a payés séparément (jusqu'à 59,90 €).
 */

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('cloisonnement abonnement gestion / crédits d’audit', () => {
  const webhook = read('app/api/webhooks/stripe/route.ts');

  it('la résiliation d’un abonnement GESTION ne touche jamais tier ni quota', () => {
    const managedBlock = webhook.slice(
      webhook.indexOf("const managed = await Property.findOne({ 'management.subscriptionId'"),
      webhook.indexOf('// Abonnement d\'audit legacy'),
    );
    assert.ok(managedBlock.length > 0, 'le branchement gestion doit exister');
    assert.ok(!/tier:\s*'FREE'/.test(managedBlock));
    assert.ok(!/dossiersQuota:\s*0/.test(managedBlock));
    assert.match(managedBlock, /management\.active.*false/s);
  });

  it('la résiliation gestion sort AVANT le traitement legacy (pas de double effet)', () => {
    const managedIdx = webhook.indexOf("'management.subscriptionId'");
    const legacyIdx = webhook.indexOf('stripeSubscriptionId: subscriptionId');
    const returnIdx = webhook.indexOf('return;', managedIdx);
    assert.ok(managedIdx < legacyIdx, 'le cas gestion doit être testé en premier');
    assert.ok(returnIdx > 0 && returnIdx < legacyIdx, 'il doit court-circuiter le legacy');
  });

  it('un checkout « management » n’écrit que le bloc management', () => {
    const start = webhook.indexOf("if (kind === 'management')");
    assert.ok(start > 0, 'le routage par kind doit exister');
    // toute la branche, jusqu'au log de fin
    const block = webhook.slice(start, webhook.indexOf('Gestion activée sur le bien', start));
    assert.match(block, /management\.active/);
    assert.ok(!/dossiersQuota/.test(block));
    assert.ok(!/\btier\b/.test(block));
  });

  it('n’active pas la gestion sans paiement encaissé ni identifiant d’abonnement', () => {
    // Sans ces gardes : accès ouvert sur un SEPA impayé, et surtout un
    // subscriptionId vide rend toute résiliation future inopérante (accès à vie).
    const start = webhook.indexOf("if (kind === 'management')");
    const block = webhook.slice(start, webhook.indexOf('Gestion activée sur le bien', start));
    assert.match(block, /payment_status === 'unpaid'/);
    assert.match(block, /!subscriptionId/);
  });
});

describe('route de souscription', () => {
  const route = read('app/api/billing/management/route.ts');

  it('utilise le mode subscription et un prix dédié', () => {
    assert.match(route, /mode: 'subscription'/);
    assert.match(route, /PRICE_ID_MANAGEMENT_MONTHLY/);
  });

  it('marque les metadata kind=management (lues par le webhook)', () => {
    assert.match(route, /kind: 'management'/);
    assert.match(route, /subscription_data: \{ metadata \}/);
  });

  it('vérifie l’appartenance du bien et refuse un doublon', () => {
    assert.match(route, /Property\.findOne\(\{ _id: propertyId, user: user\._id \}/);
    assert.match(route, /management\?\.active/);
    assert.match(route, /409/);
  });

  it('dégrade proprement si le prix n’est pas encore configuré', () => {
    assert.match(route, /503/);
  });
});

describe('conformité CGV de l’offre récurrente', () => {
  const cgv = read('app/(platform)/cgv/page.tsx');

  it('décrit l’abonnement, sa reconduction et son prix', () => {
    assert.match(cgv, /2 bis/);
    assert.match(cgv, /4,99 € TTC par mois/);
    assert.match(cgv, /reconduit tacitement/);
  });

  it('prévoit la résiliation en ligne (art. L215-1-1) et la rétractation', () => {
    assert.match(cgv, /L215-1-1/);
    assert.match(cgv, /L221-18/);
  });

  it('garantit contractuellement que les crédits d’audit survivent à la résiliation', () => {
    assert.match(cgv, /crédits d&apos;audit achetés séparément ne sont jamais affectés/);
  });

  it('ne prétend plus « sans abonnement » alors qu’une offre récurrente existe', () => {
    assert.ok(!cgv.includes('sans abonnement ni reconduction'));
  });
});

describe('suspension / reprise de l’abonnement (subscription.updated)', () => {
  const webhook = read('app/api/webhooks/stripe/route.ts');

  it('le handler est câblé sur customer.subscription.updated', () => {
    assert.match(webhook, /case 'customer\.subscription\.updated':/);
    assert.match(webhook, /handleSubscriptionUpdated/);
  });

  it('suspend sur échec de paiement, réactive sur récupération — sans toucher aux crédits', () => {
    const fn = webhook.slice(
      webhook.indexOf('async function handleSubscriptionUpdated'),
      webhook.indexOf('async function handleInvoicePaymentFailed'),
    );
    // sans ce handler, une carte en échec laissait l'accès ouvert indéfiniment
    assert.match(fn, /'past_due', 'unpaid'/);
    assert.match(fn, /'active', 'trialing'/);
    assert.ok(!/dossiersQuota|\btier\b/.test(fn), 'jamais les crédits d’audit');
  });

  it('le bailleur abonné a un accès direct au portail (résiliation en ligne, CGV art. 2 bis)', () => {
    const panel = read('app/(platform)/dashboard/owner/components/LoyersPanel.tsx');
    assert.match(panel, /\/api\/billing\/portal/);
    assert.match(panel, /gérer ou résilier/);
  });
});
