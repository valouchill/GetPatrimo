import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';

 
const User = require('@/models/User');

export const POST = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id } = await ctx.params;

  const before = await User.findById(id).select('email totpEnabled').lean();
  if (!before) throw new AdminHttpError(404, 'Utilisateur introuvable');

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
});
