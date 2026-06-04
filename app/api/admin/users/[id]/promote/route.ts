import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import {
  withAdmin,
  assertNotSelf,
  logAdminAction,
  AdminHttpError,
} from '@/lib/auth-admin';
import { UserPromoteSchema } from '@/lib/validations/admin';

 
const User = require('@/models/User');

const USER_SELECT = '-password -totpSecret -totpBackupCodes -magicSignInToken';

export const POST = withAdmin(
  async (req: NextRequest, ctx: any, admin) => {
    await connectDiditDb();
    const { id } = await ctx.params;
    assertNotSelf(admin._id, id);

    const body = await req.json().catch(() => ({}));
    const parsed = UserPromoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new AdminHttpError(400, 'role invalide');
    }

    const before = await User.findById(id).select(USER_SELECT).lean();
    if (!before) throw new AdminHttpError(404, 'Utilisateur introuvable');

    const after = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          role: parsed.data.role,
          adminPromotedAt: new Date(),
          adminPromotedBy: admin._id,
        },
      },
      { new: true }
    )
      .select(USER_SELECT)
      .lean();

    await logAdminAction({
      actor: admin,
      action: 'user.promote',
      targetType: 'User',
      targetId: id,
      before: { role: (before as any).role },
      after: { role: parsed.data.role },
      req,
    });

    return NextResponse.json({ user: { ...after, _id: String((after as any)._id) } });
  },
  { superadmin: true }
);
