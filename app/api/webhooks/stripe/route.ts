import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { logger } from '@/lib/server-logger';
import { connectDiditDb } from '@/app/api/didit/db';

const Property = require('@/models/Property');
const User = require('@/models/User');
const Event = require('@/models/Event');

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  });
}

/** Idempotency: check if this Stripe event was already processed. */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await Event.findOne({ type: 'STRIPE_WEBHOOK', 'meta.stripeEventId': eventId }).lean();
  return !!existing;
}

async function markEventProcessed(eventId: string, eventType: string) {
  await Event.create({
    type: 'STRIPE_WEBHOOK',
    meta: { stripeEventId: eventId, stripeEventType: eventType },
  });
}

// ── Handlers ────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { propertyId, userId } = session.metadata || {};

  if (!propertyId) {
    logger.warn('[stripe-webhook] Pas de propertyId dans les metadata.');
    return;
  }

  await Property.findByIdAndUpdate(propertyId, {
    managed: true,
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: session.subscription as string,
  });

  if (userId && session.customer) {
    await User.findByIdAndUpdate(userId, {
      stripeCustomerId: session.customer as string,
    });
  }

  logger.info(`[stripe-webhook] Bien ${propertyId} activé (managed), user ${userId} → cus ${session.customer}.`);
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
  });

  logger.info(`[stripe-webhook] Bien ${property._id} désactivé (subscription annulée).`);
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

    // Idempotency check — skip already-processed events
    if (await isEventProcessed(event.id)) {
      logger.info(`[stripe-webhook] Event ${event.id} déjà traité, ignoré.`);
      return NextResponse.json({ received: true });
    }

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

    await markEventProcessed(event.id, event.type);
  } catch (e) {
    logger.error('[stripe-webhook] Erreur traitement', { error: e instanceof Error ? e.message : e });
    // Return 500 so Stripe retries
    return NextResponse.json({ error: 'Erreur traitement' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
