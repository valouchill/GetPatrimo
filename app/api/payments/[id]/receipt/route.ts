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

/**
 * GET /api/payments/[id]/receipt — télécharge la quittance PDF
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const { id } = await params;
  const payment = await Payment.findById(id).lean();
  if (!payment) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
  if (String(payment.owner) !== String(user._id) && String(payment.tenant) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  let receiptPath = payment.receiptUrl;

  // Générer si pas encore fait
  if (!receiptPath) {
    receiptPath = await generateReceipt(payment);
    await Payment.findByIdAndUpdate(id, { receiptUrl: receiptPath, receiptGeneratedAt: new Date() });
  }

  const filePath = path.join(process.cwd(), receiptPath);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quittance_${payment.period.month}_${payment.period.year}.pdf"`,
    },
  });
});
