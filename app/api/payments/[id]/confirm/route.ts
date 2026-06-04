import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { ConfirmPaymentSchema } from '@/lib/validations/payment';
import { confirmPayment } from '@/lib/services/paymentService';

 
const User = require('@/models/User');
 
const { logEvent } = require('@/src/services/eventService');

/**
 * PUT /api/payments/[id]/confirm
 */
export const PUT = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json();
  const result = validateRequest(ConfirmPaymentSchema, body);
  if (!result.success) return result.response;

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const { id } = await params;
  const confirmResult = await confirmPayment(id, String(user._id), result.data.paidAmount, result.data.notes, result.data.paymentMethod);

  logEvent(String(user._id), {
    property: (confirmResult?.payment as Record<string, unknown>)?.property || null,
    type: 'payment_confirmed',
    meta: { paymentId: id, amount: result.data.paidAmount },
  });

  return NextResponse.json({ success: true, data: confirmResult });
});
