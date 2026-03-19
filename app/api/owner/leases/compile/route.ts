import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import path from 'path';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { compileLeaseBundle } = require('@/src/services/leaseCompileService');

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
      return NextResponse.json({ msg: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ msg: 'Utilisateur introuvable' }, { status: 401 });
    }

    const { propertyId, applicationId, candidatureId, formData } = await request.json();

    const compiled = await compileLeaseBundle({
      propertyId,
      applicationId,
      candidatureId,
      formData: formData || {},
      userId,
    });

    return NextResponse.json({
      documents: compiled.documents.map((document: any) => ({
        kind: document.kind,
        fileName: document.fileName,
        mimeType: document.mimeType,
        secureUrl: `/api/owner/leases/compiled/${encodeURIComponent(document.fileName)}`,
        pdfUrl: document.pdfUrl
          ? `/api/owner/leases/compiled/${encodeURIComponent(path.basename(decodeURIComponent(document.pdfUrl)))}` 
          : undefined,
      })),
      warnings: compiled.warnings || [],
      compileMeta: compiled.compileMeta,
    });
  } catch (error: any) {
    console.error('POST /api/owner/leases/compile', error);
    return NextResponse.json(
      { msg: error?.message || 'Compilation Smart Lease impossible' },
      { status: 500 },
    );
  }
}
