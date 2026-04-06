import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { getStripeClient } from '@/lib/admin-stripe';
import { StripeRefundSchema } from '@/lib/validations/admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');

export const POST = withAdmin(
  async (req: NextRequest, ctx: any, admin) => {
    await connectDiditDb();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = StripeRefundSchema.safeParse(body);
    if (!parsed.success) throw new AdminHttpError(400, 'Données invalides: ' + parsed.error.message);

    const property = await Property.findById(id).lean();
    if (!property) throw new AdminHttpError(404, 'Propriété introuvable');

    const stripe = getStripeClient();
    const refund = await stripe.refunds.create({
      ...(parsed.data.chargeId ? { charge: parsed.data.chargeId } : {}),
      ...(parsed.data.paymentIntentId ? { payment_intent: parsed.data.paymentIntentId } : {}),
      ...(parsed.data.amount ? { amount: Math.round(parsed.data.amount * 100) } : {}),
      ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      metadata: { propertyId: id, adminId: String(admin._id) },
    });

    await logAdminAction({
      actor: admin,
      action: 'billing.refund',
      targetType: 'Property',
      targetId: id,
      before: null,
      after: {
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
      },
      req,
    });

    return NextResponse.json({ ok: true, refundId: refund.id, amount: refund.amount, status: refund.status });
  },
  { superadmin: true }
);
