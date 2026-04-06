import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { PaymentPatchSchema } from '@/lib/validations/admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Payment = require('@/models/Payment');

export const GET = withAdmin(async (_req: NextRequest, ctx: any) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const payment = await Payment.findById(id)
    .populate('owner', 'email')
    .populate('tenant', 'email firstName lastName')
    .populate('property', 'name address')
    .populate('lease', 'rentAmount chargesAmount')
    .lean();
  if (!payment) throw new AdminHttpError(404, 'Paiement introuvable');
  return NextResponse.json({ payment: { ...payment, _id: String(payment._id) } });
});

export const PATCH = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = PaymentPatchSchema.safeParse(body);
  if (!parsed.success) throw new AdminHttpError(400, 'Données invalides');

  const before = await Payment.findById(id).lean();
  if (!before) throw new AdminHttpError(404, 'Paiement introuvable');

  const update: Record<string, any> = {};
  const beforeSnapshot: Record<string, any> = {};
  const d = parsed.data;

  if (d.status !== undefined) {
    update.status = d.status;
    beforeSnapshot.status = (before as any).status;
    if (d.status === 'CONFIRMED') {
      update.confirmedAt = new Date();
      update.confirmedBy = admin._id;
    }
  }
  if (d.paidAmount !== undefined) {
    update['amounts.paidAmount'] = d.paidAmount;
    beforeSnapshot['amounts.paidAmount'] = (before as any).amounts?.paidAmount;
  }
  if (d.note !== undefined) {
    update.notes = d.note;
    beforeSnapshot.notes = (before as any).notes;
  }
  if (d.paymentMethod !== undefined) {
    update.paymentMethod = d.paymentMethod;
    beforeSnapshot.paymentMethod = (before as any).paymentMethod;
  }
  if (d.receiptUrl !== undefined) {
    update.receiptUrl = d.receiptUrl;
    beforeSnapshot.receiptUrl = (before as any).receiptUrl;
  }

  // Nested updates via dot-notation
  const nestedGroups = ['amounts', 'period', 'prorata', 'revision', 'regularization', 'discount'] as const;
  for (const group of nestedGroups) {
    const obj = (d as any)[group];
    if (obj && typeof obj === 'object') {
      for (const [subKey, subVal] of Object.entries(obj)) {
        update[`${group}.${subKey}`] = subVal;
        beforeSnapshot[`${group}.${subKey}`] = (before as any)[group]?.[subKey];
      }
    }
  }

  const after = await Payment.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();

  await logAdminAction({
    actor: admin,
    action: 'payment.update',
    targetType: 'Payment',
    targetId: id,
    before: beforeSnapshot,
    after: update,
    req,
  });

  return NextResponse.json({ payment: { ...after, _id: String((after as any)._id) } });
});
