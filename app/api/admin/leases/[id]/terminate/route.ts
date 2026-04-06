import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { LeaseTerminateSchema } from '@/lib/validations/admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = LeaseTerminateSchema.safeParse(body);
  if (!parsed.success) throw new AdminHttpError(400, 'Données invalides: ' + parsed.error.message);

  const before = await Lease.findById(id).lean();
  if (!before) throw new AdminHttpError(404, 'Bail introuvable');

  const initiatedByForDb = parsed.data.initiatedBy === 'ADMIN' ? 'OWNER' : parsed.data.initiatedBy;
  const now = new Date();

  const termination: Record<string, any> = {
    initiatedBy: initiatedByForDb,
    notificationDate: parsed.data.notificationDate || now,
    reason: parsed.data.reason || '',
  };
  if (parsed.data.estimatedExitDate) termination.estimatedExitDate = parsed.data.estimatedExitDate;
  if (parsed.data.actualExitDate) termination.actualExitDate = parsed.data.actualExitDate;
  if (parsed.data.noticePeriodMonths != null) termination.noticePeriodMonths = parsed.data.noticePeriodMonths;
  if (parsed.data.depositReturned != null) termination.depositReturned = parsed.data.depositReturned;
  if (parsed.data.depositReturnDate) termination.depositReturnDate = parsed.data.depositReturnDate;

  await Lease.updateOne(
    { _id: id },
    { $set: { leaseStatus: 'TERMINATED', termination } }
  );

  // Update property status to VACANT
  if ((before as any).property) {
    await Property.updateOne(
      { _id: (before as any).property },
      { $set: { status: 'VACANT', vacantSince: parsed.data.estimatedExitDate || parsed.data.actualExitDate || now } }
    );
  }

  await logAdminAction({
    actor: admin,
    action: 'lease.force_terminate',
    targetType: 'Lease',
    targetId: id,
    before: {
      leaseStatus: (before as any).leaseStatus,
      termination: (before as any).termination,
    },
    after: { leaseStatus: 'TERMINATED', termination },
    note: `forced:true adminInitiator:${parsed.data.initiatedBy}`,
    req,
  });

  return NextResponse.json({ ok: true });
});
