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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { logEvent } = require('@/src/services/eventService');

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

  // Si un leaseId spécifique est fourni
  if (result.data.leaseId) {
    const genResult = await generateMonthlyPayments(result.data.leaseId);
    return NextResponse.json({ success: true, data: genResult });
  }

  // Sinon, générer pour TOUS les baux actifs du propriétaire
  const properties = await Property.find({ user: user._id }).select('_id').lean();
  if (!properties || properties.length === 0) {
    return NextResponse.json({
      success: true,
      data: { created: 0, skipped: 0, errors: ['Aucun bien trouvé pour ce propriétaire'] },
    });
  }

  const propertyIds = properties.map((p: { _id: unknown }) => p._id);

  // Chercher les baux éligibles : actifs ou sans statut (legacy) + dates valides
  // Exclure explicitement les statuts terminaux
  const leases = await Lease.find({
    property: { $in: propertyIds },
    leaseStatus: { $nin: ['EXPIRED', 'TERMINATED', 'DRAFT'] },
    startDate: { $lte: new Date() },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: new Date() } }],
  }).lean();

  if (!leases || leases.length === 0) {
    return NextResponse.json({
      success: true,
      data: { created: 0, skipped: 0, errors: ['Aucun bail actif trouvé'] },
    });
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const lease of leases) {
    try {
      const r = await generateMonthlyPayments(String(lease._id));
      totalCreated += r.created;
      totalSkipped += r.skipped;
      if (r.errors.length > 0) errors.push(...r.errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Bail ${lease._id}: ${msg}`);
      console.error(`[payments/generate] Erreur bail ${lease._id}:`, msg);
    }
  }

  if (totalCreated > 0) {
    logEvent(String(user._id), {
      type: 'payments_generated',
      meta: { created: totalCreated, skipped: totalSkipped },
    });
  }

  return NextResponse.json({
    success: true,
    data: { created: totalCreated, skipped: totalSkipped, errors },
  });
});
