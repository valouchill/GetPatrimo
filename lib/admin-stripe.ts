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
