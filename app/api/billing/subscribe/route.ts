/**
 * POST /api/billing/subscribe — Souscription d'une offre Pay-per-Listing.
 *
 * Body : { propertyId: string, tier: 'ESSENTIAL'|'PREMIUM'|'MAX' }
 *
 * Crée une Stripe Checkout Session en mode "subscription" avec DEUX line items :
 *   1. Le forfait de base (Price récurrent, licensed, quantity 1)
 *   2. Le tarif au dépassement (Price metered, 0,49€/unité — facturé à l'usage
 *      via createUsageRecord depuis le quota-service)
 *
 * Le webhook checkout.session.completed finalise : tier, dossiersQuota,
 * stripeUsageItemId (l'item metered de l'abonnement).
 *
 * Stratégie retenue : Subscription + Metered Billing (vs achat de crédits).
 * Justification : carte enregistrée → dépassement facturé sans friction,
 * réconciliation Stripe native, pas de gestion de solde côté app.
 * Cf. docs/BILLING.md (rapport méthode).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import { getStripeClient, getTierPriceIds } from '@/lib/admin-stripe';
import { normalizeTier, isPaidTier, quotaForTier } from '@/lib/billing/tiers';

 
const Property = require('@/models/Property');

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = String(body?.propertyId || '');
    const tier = normalizeTier(body?.tier);

    if (!propertyId) {
      return NextResponse.json(
        { error: 'propertyId manquant.' },
        { status: 400 },
      );
    }
    if (!isPaidTier(tier)) {
      return NextResponse.json(
        { error: 'Offre invalide (FREE ne nécessite pas de paiement).' },
        { status: 400 },
      );
    }

    await connectDiditDb();

    const property = await Property.findById(propertyId);
    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable.' }, { status: 404 });
    }
    if (String(property.user) !== session.user.id) {
      return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
    }

    // Sécurité (revue V1 — S15) : empêcher une double-souscription pour un même bien
    // (abonnements concurrents → double facturation + subscriptions orphelines).
    if (property.managed && property.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Ce bien a déjà un abonnement actif. Gérez-le depuis votre espace facturation.', code: 'ALREADY_SUBSCRIBED' },
        { status: 409 },
      );
    }

    const { base, metered } = getTierPriceIds(tier);
    if (!base || !metered) {
      logger.error('[subscribe] Price IDs manquants', { tier, base: !!base, metered: !!metered });
      return NextResponse.json(
        {
          error:
            "Configuration de facturation incomplète pour cette offre. Contactez le support.",
          code: 'PRICE_NOT_CONFIGURED',
        },
        { status: 500 },
      );
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'https://maisonpatrimo.com';

    const stripe = getStripeClient();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: property.stripeCustomerId ? undefined : session.user.email,
      customer: property.stripeCustomerId || undefined,
      line_items: [
        // Forfait de base (licensed) — quantité fixe
        { price: base, quantity: 1 },
        // Dépassement (metered) — PAS de quantity (usage reporté à la conso)
        { price: metered },
      ],
      success_url: `${baseUrl}/dashboard/owner/property/${propertyId}?tab=candidates&checkout=success`,
      cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
      metadata: {
        propertyId,
        userId: session.user.id,
        tier,
        quota: String(quotaForTier(tier)),
      },
      subscription_data: {
        metadata: {
          propertyId,
          userId: session.user.id,
          tier,
        },
      },
      payment_method_types: ['card'],
      locale: 'fr',
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e: any) {
    logger.error('[subscribe]', { error: e instanceof Error ? e.message : e });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la session.' },
      { status: 500 },
    );
  }
}
