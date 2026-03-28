import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { exportPayments } from '@/lib/services/paymentService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

/**
 * GET /api/payments/export?format=pdf|csv
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
  const format = (searchParams.get('format') || 'csv') as 'csv' | 'pdf';

  if (format !== 'csv' && format !== 'pdf') {
    return NextResponse.json({ error: 'Format invalide (csv ou pdf)' }, { status: 400 });
  }

  const result = await exportPayments(String(user._id), format);

  if (format === 'csv') {
    return new NextResponse(result, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="paiements_${Date.now()}.csv"`,
      },
    });
  }

  // PDF — retourne l'URL
  return NextResponse.json({ success: true, data: { url: result } });
});
