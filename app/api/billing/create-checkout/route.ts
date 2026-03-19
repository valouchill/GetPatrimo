import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import Stripe from 'stripe';
import { connectDiditDb } from '@/app/api/didit/db';

const Property = require('@/models/Property');

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const { propertyId } = await request.json();
    if (!propertyId) {
      return NextResponse.json({ error: 'Données manquantes.' }, { status: 400 });
    }

    await connectDiditDb();

    const property = await Property.findById(propertyId);
    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable.' }, { status: 404 });
    }
    if (String(property.user) !== session.user.id) {
      return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://doc2loc.com';

    const stripe = getStripe();
    const successTarget = `${baseUrl}/dashboard/owner/property/${propertyId}?tab=candidates&checkout=success`;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: session.user.email,
      line_items: [
        { price: process.env.PRICE_ID_RECURRING!, quantity: 1 },
        { price: process.env.PRICE_ID_ONESHOT!, quantity: 1 },
      ],
      success_url: successTarget,
      cancel_url: `${baseUrl}/dashboard/owner?checkout=cancelled`,
      metadata: {
        propertyId,
        userId: session.user.id,
      },
      subscription_data: {
        metadata: {
          propertyId,
          userId: session.user.id,
        },
      },
      payment_method_types: ['card'],
      locale: 'fr',
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e: any) {
    console.error('[create-checkout]', e);
    return NextResponse.json(
      { error: e.message || 'Erreur lors de la création de la session.' },
      { status: 500 },
    );
  }
}
