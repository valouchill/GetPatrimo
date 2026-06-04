import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { logger } from '@/lib/server-logger';

 
const User = require('@/models/User');
 
const Lease = require('@/models/Lease');
 
const { resendSigningLink } = require('@/src/services/opensignService');

/**
 * POST /api/leases/[id]/opensign/resend
 * Resends the signing link to a specific signer.
 * Body: { signerEmail: string }
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { signerEmail } = body;

  if (!signerEmail) {
    return NextResponse.json({ error: 'signerEmail requis' }, { status: 400 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  const lease = await Lease.findById(id).lean();
  if (!lease) return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });
  if (String((lease as any).user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
  }

  const l = lease as any;
  const doc = (l.opensignDocuments || []).find((d: any) => d.documentId);
  if (!doc?.documentId) {
    return NextResponse.json({ error: 'Aucun document en signature' }, { status: 400 });
  }

  await resendSigningLink(doc.documentId, signerEmail);
  logger.info('[opensign] Signing link resent', { leaseId: id, signerEmail });

  return NextResponse.json({ success: true, message: 'Lien de signature renvoye' });
});
