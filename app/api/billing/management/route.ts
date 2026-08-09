import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import { captureServer } from '@/lib/analytics/posthog-server';
import { getStripeClient } from '@/lib/admin-stripe';
import {
  isVolumeRate,
  priceFor,
  resolvePriceId,
  type BillingCycle,
} from '@/lib/billing/management-pricing';

const Property = require('@/models/Property');
const User = require('@/models/User');

/**
 * POST /api/billing/management — souscription à l'abonnement « Gestion locative »
 * (récurrent mensuel, par logement).
 *
 * Distinct des packs d'audit (paiement unique) : mode `subscription`, et le
 * webhook n'écrit QUE le bloc `Property.management` — les crédits d'audit
 * achetés ne sont jamais impactés, y compris à la résiliation.
 */
export async function POST(request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as never)) as
      | { user?: { id?: string; email?: string } }
      | null;
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = String(body?.propertyId || '');
    if (!propertyId) {
      return NextResponse.json({ error: 'Bien non précisé.' }, { status: 400 });
    }

    const billingCycle: BillingCycle = body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';

    await connectDiditDb();
    const user = await User.findOne({ email: session.user.email }).select('_id email stripeCustomerId').lean();
    if (!user?._id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    // Ownership : on ne peut souscrire que pour SON bien.
    const property = await Property.findOne({ _id: propertyId, user: user._id })
      .select('_id stripeCustomerId management')
      .lean();
    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable.' }, { status: 404 });
    }
    if (property.management?.active) {
      return NextResponse.json({ error: 'La gestion est déjà active sur ce bien.' }, { status: 409 });
    }

    // Tarif dégressif : compté sur les abonnements DÉJÀ actifs du bailleur, pas
    // sur son nombre de biens — on ne récompense que l'engagement réel.
    const activeSubscriptions = await Property.countDocuments({
      user: user._id,
      'management.active': true,
    });
    const priceId = resolvePriceId(billingCycle, activeSubscriptions);
    if (!priceId) {
      logger.error('[management] prix Stripe non configuré', { cycle: billingCycle });
      return NextResponse.json(
        { error: "L'offre Gestion n'est pas encore ouverte. Réessayez plus tard." },
        { status: 503 },
      );
    }

    const baseUrl = (
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'https://maisonpatrimo.com'
    ).replace(/\/$/, '');

    const stripe = getStripeClient();
    const metadata = {
      kind: 'management',
      propertyId,
      userId: String(user._id),
      billingCycle,
      volumeRate: String(isVolumeRate(activeSubscriptions)),
    };

    // Instrumentation du funnel : sans event à l'ENTRÉE du checkout, le taux de
    // conversion checkout → achat est incalculable (seuls les achats étaient tracés).
    captureServer('checkout_started', String(user._id), {
      kind: 'management',
      property_id: propertyId,
      billing_cycle: billingCycle,
      volume_rate: isVolumeRate(activeSubscriptions),
      unit_price: priceFor(billingCycle, activeSubscriptions),
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // En mode `subscription`, Stripe crée le client automatiquement :
      // `customer_creation` n'est accepté qu'en mode payment/setup (sinon 400
      // → 500 pour tout primo-souscripteur). On réutilise le client existant
      // du compte s'il y en a un, pour ne pas fragmenter l'historique Stripe.
      ...(property.stripeCustomerId || user.stripeCustomerId
        ? { customer: property.stripeCustomerId || user.stripeCustomerId }
        : { customer_email: session.user.email }),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/owner/property/${propertyId}?management=success`,
      cancel_url: `${baseUrl}/dashboard/owner/property/${propertyId}?management=cancelled`,
      metadata,
      // Le webhook lit les metadata de l'abonnement (customer.subscription.*).
      subscription_data: { metadata },
      locale: 'fr',
      // Résiliation en autonomie (obligation de parcours de résiliation en ligne).
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    logger.error('[management]', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Erreur lors de la création de la session.' }, { status: 500 });
  }
}
