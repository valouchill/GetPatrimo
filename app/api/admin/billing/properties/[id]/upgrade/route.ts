import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { getStripeClient, getPriceIds } from '@/lib/admin-stripe';
import { StripeUpgradeSchema } from '@/lib/validations/admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = StripeUpgradeSchema.safeParse(body);
  if (!parsed.success) throw new AdminHttpError(400, 'Données invalides');

  const property = await Property.findById(id);
  if (!property) throw new AdminHttpError(404, 'Propriété introuvable');

  if (property.stripeSubscriptionId) {
    throw new AdminHttpError(400, 'Ce bien a déjà un abonnement actif');
  }

  const stripe = getStripeClient();
  const { recurring, oneshot } = getPriceIds();
  const priceRecurring = parsed.data.priceIdRecurring || recurring;
  const priceOneshot = parsed.data.priceIdOneshot || oneshot;

  if (!priceRecurring) {
    throw new AdminHttpError(500, 'PRICE_ID_RECURRING non configuré');
  }

  // Résoudre le customer
  let customerId: string = property.stripeCustomerId || '';
  const owner = await User.findById(property.user).select('email firstName lastName stripeCustomerId').lean();
  if (!customerId && (owner as any)?.stripeCustomerId) {
    customerId = (owner as any).stripeCustomerId;
  }
  if (!customerId) {
    if (!(owner as any)?.email) {
      throw new AdminHttpError(400, 'Email du propriétaire introuvable');
    }
    const customer = await stripe.customers.create({
      email: (owner as any).email,
      name: [(owner as any).firstName, (owner as any).lastName].filter(Boolean).join(' ') || undefined,
      metadata: { userId: String(property.user), propertyId: String(property._id) },
    });
    customerId = customer.id;
    await User.updateOne({ _id: property.user }, { $set: { stripeCustomerId: customerId } });
  }

  // Création de l'abonnement
  const items: { price: string }[] = [{ price: priceRecurring }];
  if (priceOneshot) items.push({ price: priceOneshot });

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items,
    metadata: { propertyId: id, userId: String(property.user), adminUpgrade: 'true', adminId: String(admin._id) },
  });

  await Property.updateOne(
    { _id: id },
    {
      $set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        managed: true,
      },
    }
  );

  await logAdminAction({
    actor: admin,
    action: 'billing.upgrade',
    targetType: 'Property',
    targetId: id,
    before: { managed: false, stripeSubscriptionId: null },
    after: { managed: true, stripeSubscriptionId: subscription.id, status: subscription.status },
    req,
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: subscription.id,
    status: subscription.status,
    customerId,
  });
});
