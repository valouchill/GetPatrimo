import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { ApplicationPatchSchema } from '@/lib/validations/admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Application = require('@/models/Application');

export const GET = withAdmin(async (_req: NextRequest, ctx: any) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const app = await Application.findById(id).lean();
  if (!app) throw new AdminHttpError(404, 'Candidature introuvable');
  return NextResponse.json({ application: { ...app, _id: String(app._id) } });
});

export const PATCH = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = ApplicationPatchSchema.safeParse(body);
  if (!parsed.success) throw new AdminHttpError(400, 'Données invalides');

  const before = await Application.findById(id).select('status').lean();
  if (!before) throw new AdminHttpError(404, 'Candidature introuvable');

  const update: Record<string, any> = {};
  if (parsed.data.status !== undefined) update.status = parsed.data.status;

  const after = await Application.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();

  await logAdminAction({
    actor: admin,
    action: 'application.force_status',
    targetType: 'Application',
    targetId: id,
    before,
    after: update,
    note: parsed.data.note,
    req,
  });

  return NextResponse.json({ application: { ...after, _id: String((after as any)._id) } });
});
