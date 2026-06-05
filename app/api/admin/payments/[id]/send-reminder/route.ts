import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';

 
const Payment = require('@/models/Payment');
 
const User = require('@/models/User');
 
const { sendEmail, isEmailConfigured } = require('@/src/services/emailService');

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  if (!isEmailConfigured()) throw new AdminHttpError(503, 'Service email non configuré');
  await connectDiditDb();
  const { id } = await ctx.params;

  const payment = await Payment.findById(id);
  if (!payment) throw new AdminHttpError(404, 'Paiement introuvable');

  const tenant = await User.findById(payment.tenant).select('email firstName lastName').lean();
  if (!(tenant as any)?.email) throw new AdminHttpError(400, 'Email locataire introuvable');

  const monthLabel = MONTHS[(payment.period.month as number) - 1];
  const periodLabel = `${monthLabel} ${payment.period.year}`;
  const tenantName = `${(tenant as any).firstName || ''} ${(tenant as any).lastName || ''}`.trim() || (tenant as any).email;
  const due = Number(payment.amounts?.totalTTC || 0) - Number(payment.amounts?.paidAmount || 0);

  await sendEmail({
    to: (tenant as any).email,
    subject: `Rappel : loyer en attente — ${periodLabel}`,
    text: `Bonjour ${tenantName},\n\nVotre loyer pour ${periodLabel} reste en attente (${due.toFixed(2)} €).\n\nMerci de régulariser votre situation.\n\nCordialement,\nMaison Patrimo`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;"><p>Bonjour ${tenantName},</p><p>Votre loyer pour <strong>${periodLabel}</strong> reste en attente : <strong>${due.toFixed(2)} €</strong>.</p><p>Merci de régulariser votre situation.</p><p style="color:#64748B;font-size:13px;">Maison Patrimo</p></div>`,
  });

  await Payment.updateOne(
    { _id: id },
    { $push: { remindersSent: { date: new Date(), type: 'EMAIL' } } }
  );

  await logAdminAction({
    actor: admin,
    action: 'payment.send_reminder',
    targetType: 'Payment',
    targetId: id,
    before: null,
    after: { sentTo: (tenant as any).email, amountDue: due },
    req,
  });

  return NextResponse.json({ ok: true, sentTo: (tenant as any).email });
});
