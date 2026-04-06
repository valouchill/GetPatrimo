import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Application = require('@/models/Application');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;

  const before = await Application.findById(id).select('status property').lean();
  if (!before) throw new AdminHttpError(404, 'Candidature introuvable');

  await Application.updateOne({ _id: id }, { $set: { status: 'ACCEPTED' } });

  if ((before as any).property) {
    await Property.updateOne(
      { _id: (before as any).property },
      { $set: { acceptedTenantId: id, status: 'LEASE_IN_PROGRESS' } }
    );
  }

  await logAdminAction({
    actor: admin,
    action: 'application.accept',
    targetType: 'Application',
    targetId: id,
    before: { status: (before as any).status },
    after: { status: 'ACCEPTED' },
    req,
  });

  return NextResponse.json({ ok: true });
});
