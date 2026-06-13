import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

 
const User = require('@/models/User');
 
const AdminAuditLog = require('@/models/AdminAuditLog');

export async function POST(req: NextRequest) {
  const session: any = await getServerSession(authOptions as any);
  const impersonatorEmail: string | undefined = session?.user?.impersonatedBy;

  if (!impersonatorEmail) {
    return NextResponse.json({ error: 'Pas de session en impersonation' }, { status: 400 });
  }

  await connectDiditDb();
  const admin = await User.findOne({ email: impersonatorEmail }).select('email role _id').lean();
  if (!admin || (admin as any).role !== 'superadmin') {
    return NextResponse.json({ error: 'Impersonator introuvable' }, { status: 403 });
  }

  // Generate magic link for the admin
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashed = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await User.updateOne(
    { _id: (admin as any)._id },
    { $set: { magicSignInToken: hashed, magicSignInExpiresAt: expiresAt } }
  );

  // Audit entry for impersonation end
  try {
    const targetUserId = session?.user?.id;
    await AdminAuditLog.create({
      actorId: (admin as any)._id,
      actorEmail: (admin as any).email,
      actorRole: 'superadmin',
      action: 'user.impersonate_end',
      targetType: 'User',
      targetId: targetUserId || null,
      before: null,
      after: null,
      ip: String(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',').pop()?.trim() || 'unknown',
      userAgent: String(req.headers.get('user-agent') || ''),
    });
  } catch (err) {
    console.error('[impersonate-exit] audit fail:', err);
  }

  return NextResponse.json({
    ok: true,
    email: (admin as any).email,
    token: rawToken,
    expiresAt,
  });
}
