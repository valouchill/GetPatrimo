import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';

 
const Application = require('@/models/Application');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? String(body.reason).slice(0, 2000) : '';

  const before = await Application.findById(id).select('status').lean();
  if (!before) throw new AdminHttpError(404, 'Candidature introuvable');

  // Sécurité (audit passe-5) : idempotence — pas de re-rejet rejouable.
  if ((before as any).status === 'REJECTED') {
    return NextResponse.json({ ok: true, alreadyRejected: true });
  }

  await Application.updateOne({ _id: id }, { $set: { status: 'REJECTED' } });

  await logAdminAction({
    actor: admin,
    action: 'application.reject',
    targetType: 'Application',
    targetId: id,
    before: { status: (before as any).status },
    after: { status: 'REJECTED' },
    note: reason,
    req,
  });

  return NextResponse.json({ ok: true });
});
