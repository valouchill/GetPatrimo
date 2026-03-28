import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { getPaymentHistory } from '@/lib/services/paymentService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Payment = require('@/models/Payment');

/**
 * GET /api/payments?leaseId=X&year=Y&status=Z
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const leaseId = searchParams.get('leaseId');
  const year = searchParams.get('year');
  const status = searchParams.get('status');

  if (leaseId) {
    const payments = await getPaymentHistory(leaseId, {
      year: year ? Number(year) : undefined,
      status: status || undefined,
    });
    return NextResponse.json({ success: true, data: payments });
  }

  // Liste tous les paiements du propriétaire
  const query: Record<string, unknown> = { owner: user._id };
  if (year) query['period.year'] = Number(year);
  if (status) query.status = status;

  const payments = await Payment.find(query)
    .populate('property', 'address name')
    .populate('tenant', 'firstName lastName email')
    .sort({ 'period.year': -1, 'period.month': -1 })
    .lean();

  return NextResponse.json({ success: true, data: payments });
});
