import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { getStripeClient } from '@/lib/admin-stripe';

 
const Property = require('@/models/Property');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;

  const property = await Property.findById(id);
  if (!property) throw new AdminHttpError(404, 'Propriété introuvable');
  if (!property.stripeSubscriptionId) {
    throw new AdminHttpError(400, 'Aucun abonnement sur ce bien');
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.update(property.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await logAdminAction({
    actor: admin,
    action: 'billing.reactivate',
    targetType: 'Property',
    targetId: id,
    before: { cancel_at_period_end: true },
    after: { status: subscription.status, cancel_at_period_end: false },
    req,
  });

  return NextResponse.json({ ok: true, status: subscription.status });
});
