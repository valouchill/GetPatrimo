import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { logger } from '@/lib/server-logger';
import { connectDiditDb } from '@/app/api/didit/db';
import { higherTier } from '@/lib/billing/tiers';
import { captureServer } from '@/lib/analytics/posthog-server';

const Property = require('@/models/Property');
const User = require('@/models/User');
const Event = require('@/models/Event');

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  });
}

async function markEventProcessed(eventId: string, eventType: string) {
  await Event.create({
    type: 'STRIPE_WEBHOOK',
    meta: { stripeEventId: eventId, stripeEventType: eventType },
  });
}

// ── Handlers ────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { propertyId, userId, tier, quota } = session.metadata || {};

  if (!propertyId) {
    logger.warn('[stripe-webhook] Pas de propertyId dans les metadata.');
    return;
  }

  const update: Record<string, unknown> = {
    managed: true,
    stripeCustomerId: session.customer as string,
  };
  // Modèle one-time (mode payment) : pas d'abonnement. On ne stocke un
  // stripeSubscriptionId que s'il existe (rétro-compat abonnements legacy).
  if (session.subscription) {
    update.stripeSubscriptionId = session.subscription as string;
  }

  // V8.0 — Pay-per-Listing (one-time). Deux cas :
  //  - 1er achat depuis FREE → quota FRAIS (les analyses d'essai gratuites, décomptées
  //    au niveau du COMPTE, ne grèvent pas le quota payé du bien).
  //  - rachat payant→payant → CUMUL des crédits restants + niveau le plus élevé ;
  //    les analyses déjà faites ne sont jamais recomptées.
  let wasFree = false;
  if (tier) {
    const current = (await Property.findById(propertyId)
      .select('tier dossiersQuota')
      .lean()) as { tier?: string; dossiersQuota?: number } | null;
    const newPackQuota = Number(quota || 0);
    wasFree = !current?.tier || current.tier === 'FREE';
    update.tier = higherTier(current?.tier, tier);
    if (wasFree) {
      update.dossiersQuota = newPackQuota;
      update.dossiersAnalyzedCount = 0;
      update.analyzedApplicationIds = [];
    } else {
      update.dossiersQuota = Number(current?.dossiersQuota || 0) + newPackQuota;
    }
  }

  await Property.findByIdAndUpdate(propertyId, update);

  captureServer(
    'purchase_completed',
    userId || (typeof session.customer === 'string' ? session.customer : undefined) || propertyId,
    {
    tier: tier || null,
    amount:
      typeof session.amount_total === 'number'
        ? session.amount_total / 100
        : null,
    currency: session.currency || 'eur',
    is_first_purchase: wasFree,
    property_id: propertyId,
  });

  if (userId && session.customer) {
    await User.findByIdAndUpdate(userId, {
      stripeCustomerId: session.customer as string,
    });
  }

  logger.info(
    `[stripe-webhook] Bien ${propertyId} activé (managed${tier ? `, tier ${tier}` : ''}), user ${userId} → cus ${session.customer}.`,
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;

  const property = await Property.findOne({ stripeSubscriptionId: subscriptionId });
  if (!property) {
    logger.warn(`[stripe-webhook] Aucun bien trouvé pour subscription ${subscriptionId}`);
    return;
  }

  await Property.findByIdAndUpdate(property._id, {
    managed: false,
    stripeSubscriptionId: null,
    // V8.0 — Retour à l'offre Gratuite (plus d'analyses IA incluses)
    tier: 'FREE',
    dossiersQuota: 0,
    stripeUsageItemId: '',
  });

  logger.info(`[stripe-webhook] Bien ${property._id} désactivé → FREE (subscription annulée).`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId) return;

  const property = await Property.findOne({ stripeSubscriptionId: subscriptionId });
  if (!property) return;

  // Log the failure — don't disable yet (Stripe retries automatically)
  logger.warn(`[stripe-webhook] Paiement échoué pour bien ${property._id}, subscription ${subscriptionId}. Stripe va réessayer.`);

  // Optionally notify the owner via email in a future iteration
}

/**
 * ATTENTION : STRIPE_WEBHOOK_SECRET doit etre un secret de webhook Stripe
 * au format "whsec_..." (recuperable dans le dashboard Stripe > Webhooks).
 */
export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    logger.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET mal configure - doit commencer par whsec_');
    return NextResponse.json({ error: 'Configuration webhook invalide.' }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Signature manquante.' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    logger.error('[stripe-webhook] Signature invalide', { error: message });
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  try {
    await connectDiditDb();

    // Idempotence ATOMIQUE (revue V1 — S11) : on « réserve » l'event en insérant son
    // marqueur D'ABORD (index unique partiel). Un doublon (E11000) ⇒ déjà traité.
    try {
      await markEventProcessed(event.id, event.type);
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) {
        logger.info(`[stripe-webhook] Event ${event.id} déjà traité, ignoré.`);
        return NextResponse.json({ received: true });
      }
      throw err;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          logger.info(`[stripe-webhook] Event non géré: ${event.type}`);
      }
    } catch (handlerErr) {
      // Le traitement a échoué : on RETIRE le marqueur pour que Stripe réessaie
      // (sinon l'event serait perdu, marqué « traité » sans l'avoir été).
      await Event.deleteOne({ type: 'STRIPE_WEBHOOK', 'meta.stripeEventId': event.id }).catch(() => {});
      throw handlerErr;
    }
  } catch (e) {
    logger.error('[stripe-webhook] Erreur traitement', { error: e instanceof Error ? e.message : e });
    // Return 500 so Stripe retries
    return NextResponse.json({ error: 'Erreur traitement' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
