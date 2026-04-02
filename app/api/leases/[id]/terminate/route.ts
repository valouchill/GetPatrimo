import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateNoticePeriod } from '@/lib/validations/lease';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { logEvent } = require('@/src/services/eventService');

/**
 * POST /api/leases/[id]/terminate
 * Initiate lease termination with notice period calculation.
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { initiatedBy, reason, requestedExitDate } = body;

  if (!initiatedBy || !['OWNER', 'TENANT'].includes(initiatedBy)) {
    return NextResponse.json({ error: 'initiatedBy invalide' }, { status: 400 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const lease = await Lease.findById(id).lean();
  if (!lease) return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });

  const property = await Property.findById(lease.property).lean();
  if (!property || String((property as { user: unknown }).user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  // Calculate and validate notice period (loi 89-462 art. 15)
  const noticePeriod = validateNoticePeriod({
    leaseType: lease.leaseType || '',
    initiatedBy,
    requestedExitDate,
  });

  const { noticePeriodMonths, minimumExitDate } = noticePeriod;
  const now = new Date();
  const estimatedExitDate = requestedExitDate
    ? new Date(requestedExitDate)
    : minimumExitDate;

  await Lease.updateOne(
    { _id: id },
    {
      $set: {
        leaseStatus: 'TERMINATED',
        termination: {
          initiatedBy,
          notificationDate: now,
          noticePeriodMonths,
          estimatedExitDate,
          reason: reason || '',
        },
      },
    }
  );

  // Update property status
  await Property.updateOne(
    { _id: lease.property },
    { $set: { status: 'VACANT', vacantSince: estimatedExitDate } }
  );

  logEvent(String(user._id), {
    property: lease.property,
    type: 'lease_terminated',
    meta: {
      leaseId: id,
      initiatedBy,
      noticePeriodMonths,
      estimatedExitDate,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      noticePeriodMonths,
      estimatedExitDate,
      initiatedBy,
    },
    ...(noticePeriod.warning && { warnings: [noticePeriod.warning] }),
  });
});
