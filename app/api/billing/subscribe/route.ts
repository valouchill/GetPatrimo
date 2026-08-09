/**
 * POST /api/billing/subscribe — Achat d'une offre Pay-per-Listing (one-time).
 *
 * Body : { propertyId: string, tier: 'ESSENTIAL'|'PREMIUM'|'MAX' }
 *
 * Crée une Stripe Checkout Session en mode "payment" (PAIEMENT UNIQUE) avec UN
 * line item : l'offre achetée (Price one-time). Pas d'abonnement, pas de
 * récurrence : l'achat débloque un quota fixe d'analyses IA pour ce bien.
 *
 * Au-delà du quota : PLAFOND DUR (racheter une offre) — aucune facturation à
 * l'usage (cf. lib/billing/quota-service.ts).
 *
 * Le webhook checkout.session.completed finalise : managed, tier, dossiersQuota,
 * stripeCustomerId. Cf. docs/BILLING.md (rapport méthode).
 */

import { captureServer } from '@/lib/analytics/posthog-server';
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

    const { base } = getTierPriceIds(tier);
    if (!base) {
      logger.error('[subscribe] Price ID de base manquant', { tier, base: !!base });
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

    const metadata = {
      propertyId,
      userId: session.user.id,
      tier,
      quota: String(quotaForTier(tier)),
      // Preuve du renoncement au droit de rétractation (art. L221-28 1° C. conso) :
      // l'exécution est immédiate et le renoncement est affiché au moment du paiement
      // (custom_text.submit ci-dessous). Tracé dans Stripe + webhook.
      retractationWaiver: 'accepted',
    };

    // Funnel : event à l'ENTRÉE du checkout (l'achat seul était tracé, donc le
    // taux de conversion checkout → achat était incalculable).
    captureServer('checkout_started', session.user.id, {
      kind: 'audit_pack',
      property_id: propertyId,
      tier,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Consentement exprès affiché sous le bouton de paiement (CGV art. 4-5).
      custom_text: {
        submit: {
          message:
            'En payant, vous demandez l’exécution immédiate du service et renoncez à votre droit de rétractation (art. L221-28 du Code de la consommation). Voir CGV.',
        },
      },
      // On rattache (ou crée) un client Stripe pour conserver l'historique de
      // paiement + alimenter Property.stripeCustomerId via le webhook.
      ...(property.stripeCustomerId
        ? { customer: property.stripeCustomerId }
        : { customer_email: session.user.email, customer_creation: 'always' as const }),
      line_items: [
        // L'offre achetée (Price one-time). Un seul achat = un quota fixe.
        { price: base, quantity: 1 },
      ],
      // Retour SUR LE BIEN acheté : referme la boucle de conversion (bannière
      // succès + polling déverrouillage de PropertyDetailClient).
      success_url: `${baseUrl}/dashboard/owner/property/${propertyId}?checkout=success`,
      // Annulation : on conserve le contexte d'achat direct (?property=).
      cancel_url: `${baseUrl}/pricing?property=${propertyId}&checkout=cancelled`,
      metadata,
      payment_intent_data: { metadata },
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
