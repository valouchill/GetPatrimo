import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { PropertyPatchSchema } from '@/lib/validations/admin';

 
const Property = require('@/models/Property');

export const GET = withAdmin(async (_req: NextRequest, ctx: any) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const p = await Property.findById(id)
    .populate('user', 'email firstName lastName')
    .lean();
  if (!p) throw new AdminHttpError(404, 'Propriété introuvable');
  return NextResponse.json({ property: { ...p, _id: String(p._id) } });
});

export const PATCH = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = PropertyPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminHttpError(400, 'Données invalides');
  }

  const before = await Property.findById(id).lean();
  if (!before) throw new AdminHttpError(404, 'Propriété introuvable');

  // Snapshot only the fields being updated for a focused diff
  const beforeSnapshot: Record<string, any> = {};
  for (const key of Object.keys(parsed.data)) {
    beforeSnapshot[key] = (before as any)[key];
  }

  const after = await Property.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();

  await logAdminAction({
    actor: admin,
    action: 'property.update',
    targetType: 'Property',
    targetId: id,
    before: beforeSnapshot,
    after: parsed.data,
    req,
  });

  return NextResponse.json({ property: { ...after, _id: String((after as any)._id) } });
});
