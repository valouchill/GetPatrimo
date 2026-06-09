import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError, assertNotSelf } from '@/lib/auth-admin';

 
const User = require('@/models/User');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;
  assertNotSelf(admin._id, id);

  const before = await User.findById(id).select('email totpEnabled role').lean();
  if (!before) throw new AdminHttpError(404, 'Utilisateur introuvable');
  // Sécurité (revue V1 — S5) : pas de désactivation 2FA sur un compte privilégié.
  if ((before as any).role === 'admin' || (before as any).role === 'superadmin') {
    throw new AdminHttpError(403, 'Action interdite sur un compte admin/superadmin');
  }

  await User.updateOne(
    { _id: id },
    {
      $set: { totpEnabled: false, totpSecret: '' },
      $unset: { totpBackupCodes: 1 },
    }
  );

  await logAdminAction({
    actor: admin,
    action: 'user.disable_2fa',
    targetType: 'User',
    targetId: id,
    before: { totpEnabled: (before as any).totpEnabled },
    after: { totpEnabled: false },
    req,
  });

  return NextResponse.json({ ok: true });
}, { superadmin: true });
