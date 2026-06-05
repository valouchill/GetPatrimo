import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import Stripe from 'stripe';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import { isEnabled } from '@/lib/features';

const User = require('@/models/User');

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  });
}

export async function POST() {
  try {
    // V1 — paywall désactivé, pas de portail Stripe
    if (!isEnabled('OWNER_PAYWALL')) {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    await connectDiditDb();

    const user = await User.findOne({ email: session.user.email }).select('stripeCustomerId').lean();
    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif. Vous devez d\'abord accepter un dossier candidat.' },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXTAUTH_URL || 'https://getpatrimo.com';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/dashboard/owner/profile`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (e: any) {
    logger.error('[billing-portal]', { error: e instanceof Error ? e.message : e });
    return NextResponse.json(
      { error: e.message || 'Erreur lors de la création du portail.' },
      { status: 500 },
    );
  }
}
