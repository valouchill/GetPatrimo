import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectDiditDb } from '@/app/api/didit/db';

const Property = require('@/models/Property');
const User = require('@/models/User');

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  });
}

export async function POST(request: NextRequest) {
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
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.error('[stripe-webhook] Signature invalide:', err.message);
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { propertyId, userId } = session.metadata || {};

    if (!propertyId) {
      console.warn('[stripe-webhook] Pas de propertyId dans les metadata.');
      return NextResponse.json({ received: true });
    }

    try {
      await connectDiditDb();

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

      console.log(`[stripe-webhook] Bien ${propertyId} activé (managed), user ${userId} → cus ${session.customer}.`);
    } catch (e) {
      console.error('[stripe-webhook] Erreur DB:', e);
    }
  }

  return NextResponse.json({ received: true });
}
