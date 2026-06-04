import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError, assertNotSelf } from '@/lib/auth-admin';

 
const User = require('@/models/User');

export const POST = withAdmin(
  async (req: NextRequest, ctx: any, admin) => {
    await connectDiditDb();
    const { id } = await ctx.params;
    assertNotSelf(admin._id, id);

    const target = await User.findById(id).select('email role suspended').lean();
    if (!target) throw new AdminHttpError(404, 'Utilisateur introuvable');
    if ((target as any).role === 'admin' || (target as any).role === 'superadmin') {
      throw new AdminHttpError(403, 'Impossible d\'impersonate un autre admin');
    }
    if ((target as any).suspended) {
      throw new AdminHttpError(400, 'Impossible d\'impersonate un compte suspendu');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await User.updateOne(
      { _id: id },
      { $set: { magicSignInToken: hashed, magicSignInExpiresAt: expiresAt } }
    );

    await logAdminAction({
      actor: admin,
      action: 'user.impersonate_start',
      targetType: 'User',
      targetId: id,
      before: null,
      after: { targetEmail: (target as any).email, expiresAt },
      req,
    });

    return NextResponse.json({
      ok: true,
      email: (target as any).email,
      token: rawToken,
      impersonatorEmail: admin.email,
      expiresAt,
    });
  },
  { superadmin: true }
);
