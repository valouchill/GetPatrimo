import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { GenerateReceiptSchema } from '@/lib/validations/receipt';
import { generateAndSendReceipt } from '@/lib/services/paymentService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { logEvent } = require('@/src/services/eventService');

/**
 * POST /api/receipts/generate
 * One-click: create/find payment → confirm → generate PDF v2 → email
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const body = await request.json();
  const result = validateRequest(GenerateReceiptSchema, body);
  if (!result.success) return result.response;

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  const { leaseId, month, year, paidAmount } = result.data;

  const oneClickResult = await generateAndSendReceipt(
    leaseId, month, year, String(user._id), paidAmount
  );

  logEvent(String(user._id), {
    type: 'receipt_generated_v2',
    meta: { leaseId, month, year, receiptUrl: oneClickResult.receiptUrl },
  });

  return NextResponse.json({
    success: true,
    data: oneClickResult,
  });
});
