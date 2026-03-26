import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { validateRequest } from '@/lib/validate-request';
import { CompileLeaseSchema } from '@/lib/validations/lease';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prepareLeaseCompilation } = require('@/src/services/leaseCompileService');

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ msg: 'Non autorise' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ msg: 'Utilisateur introuvable' }, { status: 401 });
    }

    const body = await request.json();
    const result = validateRequest(CompileLeaseSchema, body);
    if (!result.success) return result.response;
    const { propertyId, applicationId, candidatureId, formData } = result.data;
    const prepared = await prepareLeaseCompilation({
      propertyId,
      applicationId,
      candidatureId,
      formData: formData || {},
      userId,
    });

    return NextResponse.json({
      warnings: prepared.warnings || [],
      compileMeta: prepared.compileMeta,
    });
  } catch (error: any) {
    console.error('POST /api/owner/leases/check-readiness', error);
    return NextResponse.json(
      { msg: error?.message || 'Verification de dossier impossible', warnings: [] },
      { status: 500 },
    );
  }
}
