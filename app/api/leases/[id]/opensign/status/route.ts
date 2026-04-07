import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');

/**
 * GET /api/leases/[id]/opensign/status
 * Returns current signature status for all documents in a lease.
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const { id } = await params;
  await connectDiditDb();

  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  const lease = await Lease.findById(id).lean();
  if (!lease) return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });
  if (String((lease as any).user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
  }

  const l = lease as any;
  return NextResponse.json({
    success: true,
    data: {
      leaseId: l._id,
      signatureStatus: l.signatureStatus,
      opensignStatus: l.opensignStatus,
      ownerSignedAt: l.ownerSignedAt,
      tenantSignedAt: l.tenantSignedAt,
      documents: (l.opensignDocuments || []).map((doc: any) => ({
        kind: doc.kind,
        status: doc.status,
        completedAt: doc.completedAt,
      })),
    },
  });
});
