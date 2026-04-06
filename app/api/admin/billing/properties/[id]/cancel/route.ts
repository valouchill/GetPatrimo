import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { getStripeClient } from '@/lib/admin-stripe';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const immediate = url.searchParams.get('immediate') === 'true';

  const property = await Property.findById(id);
  if (!property) throw new AdminHttpError(404, 'Propriété introuvable');
  if (!property.stripeSubscriptionId) {
    throw new AdminHttpError(400, 'Aucun abonnement actif sur ce bien');
  }

  const stripe = getStripeClient();
  let subscription;
  if (immediate) {
    subscription = await stripe.subscriptions.cancel(property.stripeSubscriptionId);
    await Property.updateOne({ _id: id }, { $set: { managed: false, stripeSubscriptionId: '' } });
  } else {
    subscription = await stripe.subscriptions.update(property.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  await logAdminAction({
    actor: admin,
    action: immediate ? 'billing.cancel_immediate' : 'billing.cancel',
    targetType: 'Property',
    targetId: id,
    before: { cancel_at_period_end: false },
    after: { status: subscription.status, cancel_at_period_end: subscription.cancel_at_period_end },
    req,
  });

  return NextResponse.json({ ok: true, status: subscription.status, cancel_at_period_end: subscription.cancel_at_period_end });
});
