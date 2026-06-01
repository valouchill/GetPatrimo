import Stripe from 'stripe';

let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY manquant');
    client = new Stripe(key, {
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    });
  }
  return client;
}

export function getPriceIds(): { recurring: string; oneshot: string } {
  return {
    recurring: process.env.PRICE_ID_RECURRING || '',
    oneshot: process.env.PRICE_ID_ONESHOT || '',
  };
}

import { TIERS, type PropertyTier } from '@/lib/billing/tiers';

/**
 * V8.0 — Price IDs Stripe pour une offre Pay-per-Listing.
 *  - base    : Price récurrent du forfait (licensed, quantity 1)
 *  - metered : Price au dépassement (usage_type: 'metered', 0,49€/unité)
 *
 * Les IDs proviennent des variables d'environnement (clés définies dans
 * lib/billing/tiers.ts). FREE n'a pas de Price.
 */
export function getTierPriceIds(tier: PropertyTier): {
  base: string;
  metered: string;
} {
  const cfg = TIERS[tier];
  if (!cfg || tier === 'FREE') return { base: '', metered: '' };
  return {
    base: process.env[cfg.basePriceEnvKey] || '',
    metered: process.env[cfg.meteredPriceEnvKey] || '',
  };
}
