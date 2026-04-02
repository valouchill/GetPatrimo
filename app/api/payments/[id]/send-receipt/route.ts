import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { generateReceipt } from '@/lib/services/paymentService';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Payment = require('@/models/Payment');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sendEmail, isEmailConfigured } = require('@/src/services/emailService');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { logEvent } = require('@/src/services/eventService');

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * POST /api/payments/[id]/send-receipt — Envoie la quittance PDF au locataire par email
 */
export const POST = withErrorHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ error: 'Service email non configuré' }, { status: 503 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const { id } = await params;
  const payment = await Payment.findById(id);
  if (!payment) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });

  if (String(payment.owner) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  if (payment.status !== 'CONFIRMED') {
    return NextResponse.json(
      { error: 'La quittance ne peut être envoyée que pour un paiement confirmé' },
      { status: 400 }
    );
  }

  // Générer le PDF si pas encore fait
  if (!payment.receiptUrl) {
    const receiptUrl = await generateReceipt(payment);
    payment.receiptUrl = receiptUrl;
    payment.receiptGeneratedAt = new Date();
    await payment.save();
  }

  const filePath = path.join(process.cwd(), payment.receiptUrl);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Fichier quittance introuvable' }, { status: 404 });
  }

  const pdfBuffer = fs.readFileSync(filePath);

  // Récupérer le locataire
  const tenant = await User.findById(payment.tenant).select('email firstName lastName').lean();
  if (!tenant?.email) {
    return NextResponse.json({ error: 'Email du locataire introuvable' }, { status: 404 });
  }

  const monthLabel = MONTHS[(payment.period.month as number) - 1];
  const periodLabel = `${monthLabel} ${payment.period.year}`;
  const tenantName = `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || tenant.email;
  const fileName = `quittance_${monthLabel.toLowerCase()}_${payment.period.year}.pdf`;

  const subject = `Votre quittance de loyer — ${periodLabel}`;
  const bodyText = `Bonjour ${tenantName},\n\nVeuillez trouver ci-joint votre quittance de loyer pour la période : ${periodLabel}.\n\nCordialement,\nVotre bailleur`;

  await sendEmail({
    to: tenant.email,
    subject,
    text: bodyText,
    html: `<div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#F97316,#EA580C);padding:20px 24px;border-radius:12px 12px 0 0;">
        <h2 style="color:white;margin:0;font-size:18px;">PatrimoTrust</h2>
      </div>
      <div style="padding:24px;border:1px solid #E2E8F0;border-top:0;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 16px;">Bonjour <strong>${tenantName}</strong>,</p>
        <p style="margin:0 0 16px;">Veuillez trouver ci-joint votre quittance de loyer pour la période : <strong>${periodLabel}</strong>.</p>
        <p style="margin:0;color:#64748B;font-size:13px;">Cordialement,<br/>Votre bailleur</p>
      </div>
    </div>`,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  // Enregistrer l'envoi
  await Payment.findByIdAndUpdate(id, {
    receiptSentAt: new Date(),
    receiptSentTo: tenant.email,
  });

  logEvent(String(user._id), {
    type: 'receipt_sent',
    meta: { paymentId: id, sentTo: tenant.email, period: payment.period },
  });

  return NextResponse.json({
    success: true,
    data: { sentTo: tenant.email },
  });
});
