import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { MagicLinkBodySchema } from '@/lib/validations/admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = MagicLinkBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminHttpError(400, 'Paramètres invalides');
  }
  const expiresInMinutes = parsed.data.expiresInMinutes ?? 15;

  const user = await User.findById(id).select('email').lean();
  if (!user) throw new AdminHttpError(404, 'Utilisateur introuvable');

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashed = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await User.updateOne(
    { _id: id },
    { $set: { magicSignInToken: hashed, magicSignInExpiresAt: expiresAt } }
  );

  await logAdminAction({
    actor: admin,
    action: 'user.magic_link',
    targetType: 'User',
    targetId: id,
    before: null,
    after: { expiresAt },
    req,
  });

  return NextResponse.json({
    ok: true,
    email: (user as any).email,
    token: rawToken,
    expiresAt,
  });
});
