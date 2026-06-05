import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { generateReceipt } from '@/lib/services/paymentService';

 
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

  const body = await req.json().catch(() => ({}));
  const overrideEmail: string | undefined = body.email;

  if (!payment.receiptUrl) {
    payment.receiptUrl = await generateReceipt(payment.toObject());
    payment.receiptGeneratedAt = new Date();
    await payment.save();
  }

  const filePath = path.join(process.cwd(), payment.receiptUrl);
  if (!fs.existsSync(filePath)) {
    throw new AdminHttpError(404, 'Fichier quittance introuvable');
  }
  const pdfBuffer = fs.readFileSync(filePath);

  let toEmail = overrideEmail || '';
  let tenantName = '';
  if (!toEmail) {
    const tenant = await User.findById(payment.tenant).select('email firstName lastName').lean();
    if (!(tenant as any)?.email) throw new AdminHttpError(400, 'Email locataire introuvable');
    toEmail = (tenant as any).email;
    tenantName = `${(tenant as any).firstName || ''} ${(tenant as any).lastName || ''}`.trim();
  }

  const monthLabel = MONTHS[(payment.period.month as number) - 1];
  const periodLabel = `${monthLabel} ${payment.period.year}`;
  const fileName = `quittance_${monthLabel.toLowerCase()}_${payment.period.year}.pdf`;

  await sendEmail({
    to: toEmail,
    subject: `Votre quittance de loyer — ${periodLabel}`,
    text: `Bonjour ${tenantName || ''},\n\nVeuillez trouver ci-joint votre quittance pour ${periodLabel}.\n\nCordialement,\ngetpatrimo`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;"><p>Bonjour${tenantName ? ' ' + tenantName : ''},</p><p>Veuillez trouver ci-joint votre quittance pour <strong>${periodLabel}</strong>.</p><p style="color:#64748B;font-size:13px;">getpatrimo</p></div>`,
    attachments: [{ filename: fileName, content: pdfBuffer, contentType: 'application/pdf' }],
  });

  await Payment.updateOne({ _id: id }, { $set: { receiptSentAt: new Date(), receiptSentTo: toEmail } });

  await logAdminAction({
    actor: admin,
    action: 'payment.send_receipt',
    targetType: 'Payment',
    targetId: id,
    before: null,
    after: { sentTo: toEmail, period: payment.period },
    req,
  });

  return NextResponse.json({ ok: true, sentTo: toEmail });
});
