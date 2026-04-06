import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { generateReceipt } from '@/lib/services/paymentService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Payment = require('@/models/Payment');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;

  const payment = await Payment.findById(id);
  if (!payment) throw new AdminHttpError(404, 'Paiement introuvable');

  const oldReceiptUrl = payment.receiptUrl;
  const receiptUrl = await generateReceipt(payment.toObject());
  payment.receiptUrl = receiptUrl;
  payment.receiptGeneratedAt = new Date();
  await payment.save();

  await logAdminAction({
    actor: admin,
    action: 'payment.regenerate_receipt',
    targetType: 'Payment',
    targetId: id,
    before: { receiptUrl: oldReceiptUrl },
    after: { receiptUrl },
    req,
  });

  return NextResponse.json({ ok: true, receiptUrl });
});
