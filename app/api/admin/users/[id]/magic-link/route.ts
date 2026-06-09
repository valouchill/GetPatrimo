import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError, assertNotSelf } from '@/lib/auth-admin';
import { MagicLinkBodySchema } from '@/lib/validations/admin';

 
const User = require('@/models/User');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  assertNotSelf(admin._id, id);

  const body = await req.json().catch(() => ({}));
  const parsed = MagicLinkBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminHttpError(400, 'Paramètres invalides');
  }
  const expiresInMinutes = parsed.data.expiresInMinutes ?? 15;

  const user = await User.findById(id).select('email role').lean();
  if (!user) throw new AdminHttpError(404, 'Utilisateur introuvable');
  // Sécurité (revue V1 — S5) : pas de magic-link sur un compte privilégié (anti-escalade).
  if ((user as any).role === 'admin' || (user as any).role === 'superadmin') {
    throw new AdminHttpError(403, 'Action interdite sur un compte admin/superadmin');
  }

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
}, { superadmin: true });
