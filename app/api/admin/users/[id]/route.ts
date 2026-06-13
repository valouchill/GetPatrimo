import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import {
  withAdmin,
  assertNotSelf,
  logAdminAction,
  AdminHttpError,
} from '@/lib/auth-admin';
import { UserPatchSchema } from '@/lib/validations/admin';

 
const User = require('@/models/User');
 
const Property = require('@/models/Property');
 
const Lease = require('@/models/Lease');
 
const Payment = require('@/models/Payment');

const USER_SELECT = '-password -totpSecret -totpBackupCodes -magicSignInToken';

export const GET = withAdmin(async (_req: NextRequest, ctx: any) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const user = await User.findById(id).select(USER_SELECT).lean();
  if (!user) throw new AdminHttpError(404, 'Utilisateur introuvable');

  const [propertiesCount, leasesCount, paymentsLate] = await Promise.all([
    Property.countDocuments({ user: id }),
    Lease.countDocuments({ $or: [{ user: id }, { tenantEmail: user.email }] }),
    Payment.countDocuments({
      $or: [{ owner: id }, { tenant: id }],
      status: { $in: ['LATE', 'UNPAID'] },
    }),
  ]);

  return NextResponse.json({
    user: { ...user, _id: String(user._id) },
    counts: { properties: propertiesCount, leases: leasesCount, paymentsLate },
  });
});

export const PATCH = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = UserPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminHttpError(400, 'Données invalides: ' + parsed.error.message);
  }
  const input = parsed.data;

  // Sécurité (audit passe-5) : les champs SENSIBLES (plan/crédits/suspension) octroient un
  // avantage commercial ou coupent l'accès → réservés au SUPERADMIN. Un simple admin ne peut
  // éditer que les champs de contact (prénom/nom/téléphone).
  const touchesPrivileged =
    input.plan !== undefined || input.credits !== undefined || input.suspended !== undefined;
  if (touchesPrivileged && admin.role !== 'superadmin') {
    throw new AdminHttpError(403, 'Action réservée au superadmin (plan, crédits, suspension).');
  }

  const before = await User.findById(id).select(USER_SELECT).lean();
  if (!before) throw new AdminHttpError(404, 'Utilisateur introuvable');

  // Self-protection pour suspension
  if (input.suspended === true) {
    assertNotSelf(admin._id, id);
  }

  const update: Record<string, any> = {};
  if (input.plan !== undefined) update.plan = input.plan;
  if (input.credits !== undefined) update.credits = input.credits;
  if (input.firstName !== undefined) update.firstName = input.firstName;
  if (input.lastName !== undefined) update.lastName = input.lastName;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.suspended !== undefined) {
    update.suspended = input.suspended;
    if (input.suspended) {
      update.suspendedAt = new Date();
      update.suspendedBy = admin._id;
      update.suspendedReason = input.suspendedReason || '';
    } else {
      update.suspendedAt = null;
      update.suspendedBy = null;
      update.suspendedReason = '';
    }
  }

  const after = await User.findByIdAndUpdate(id, { $set: update }, { new: true })
    .select(USER_SELECT)
    .lean();

  await logAdminAction({
    actor: admin,
    action: input.suspended === true ? 'user.suspend' : input.suspended === false ? 'user.unsuspend' : 'user.update',
    targetType: 'User',
    targetId: id,
    before,
    after,
    req,
  });

  return NextResponse.json({ user: { ...after, _id: String((after as any)._id) } });
});

export const DELETE = withAdmin(
  async (req: NextRequest, ctx: any, admin) => {
    await connectDiditDb();
    const { id } = await ctx.params;
    assertNotSelf(admin._id, id);

    const before = await User.findById(id).select(USER_SELECT).lean();
    if (!before) throw new AdminHttpError(404, 'Utilisateur introuvable');

    await User.deleteOne({ _id: id });

    await logAdminAction({
      actor: admin,
      action: 'user.delete',
      targetType: 'User',
      targetId: id,
      before,
      after: null,
      req,
    });

    return NextResponse.json({ ok: true });
  },
  { superadmin: true }
);
