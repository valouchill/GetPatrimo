import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { LeasePatchSchema } from '@/lib/validations/admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');

export const GET = withAdmin(async (_req: NextRequest, ctx: any) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const lease = await Lease.findById(id)
    .populate('user', 'email firstName lastName')
    .populate('property', 'name address city')
    .lean();
  if (!lease) throw new AdminHttpError(404, 'Bail introuvable');
  return NextResponse.json({ lease: { ...lease, _id: String(lease._id) } });
});

export const PATCH = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = LeasePatchSchema.safeParse(body);
  if (!parsed.success) throw new AdminHttpError(400, 'Données invalides');

  const before = await Lease.findById(id).lean();
  if (!before) throw new AdminHttpError(404, 'Bail introuvable');

  // Flatten nested updates (irlRevision.enabled etc) to MongoDB dot-notation
  const update: Record<string, any> = {};
  const beforeSnapshot: Record<string, any> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      for (const [subKey, subVal] of Object.entries(value)) {
        update[`${key}.${subKey}`] = subVal;
        beforeSnapshot[`${key}.${subKey}`] = (before as any)[key]?.[subKey];
      }
    } else {
      update[key] = value;
      beforeSnapshot[key] = (before as any)[key];
    }
  }

  const after = await Lease.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();

  await logAdminAction({
    actor: admin,
    action: 'lease.update',
    targetType: 'Lease',
    targetId: id,
    before: beforeSnapshot,
    after: update,
    req,
  });

  return NextResponse.json({ lease: { ...after, _id: String((after as any)._id) } });
});
