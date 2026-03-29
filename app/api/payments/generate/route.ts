import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { GeneratePaymentsSchema } from '@/lib/validations/payment';
import { generateMonthlyPayments } from '@/lib/services/paymentService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');

/**
 * POST /api/payments/generate
 * Génère les paiements mensuels pour un bail ou tous les baux actifs.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Body vide = générer pour tous les baux
  }
  const result = validateRequest(GeneratePaymentsSchema, body);
  if (!result.success) return result.response;

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  if (result.data.leaseId) {
    const genResult = await generateMonthlyPayments(result.data.leaseId);
    return NextResponse.json({ success: true, data: genResult });
  }

  // Générer pour tous les baux actifs du propriétaire
  const properties = await (await import('@/models/Property')).default.find({ user: user._id }).select('_id').lean();
  const propertyIds = properties.map((p: { _id: unknown }) => p._id);

  const leases = await Lease.find({
    property: { $in: propertyIds },
    startDate: { $lte: new Date() },
    $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
  }).lean();

  let totalCreated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const lease of leases) {
    const r = await generateMonthlyPayments(String(lease._id));
    totalCreated += r.created;
    totalSkipped += r.skipped;
    errors.push(...r.errors);
  }

  return NextResponse.json({
    success: true,
    data: { created: totalCreated, skipped: totalSkipped, errors },
  });
});
