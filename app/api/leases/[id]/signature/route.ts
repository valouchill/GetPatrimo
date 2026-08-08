import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { logger } from '@/lib/server-logger';

const Lease = require('@/models/Lease');
const LeaseSignature = require('@/models/LeaseSignature');
const User = require('@/models/User');
const Application = require('@/models/Application');
const {
  openSignatureCampaign,
} = require('@/src/services/leaseSignatureService');

/**
 * POST /api/leases/[id]/signature — ouvre la campagne de signature du bail
 * (signature interne eIDAS simple, cf. src/services/leaseSignatureService.js).
 * GET — état d'avancement des signatures (pour l'UI owner).
 */

async function requireOwnedLease(id: string) {
  const session = (await getServerSession(authOptions as never)) as
    | { user?: { email?: string; id?: string } }
    | null;
  if (!session?.user?.email) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  await connectDiditDb();
  const user = await User.findOne({ email: session.user.email }).select('_id email firstName lastName').lean();
  if (!user?._id) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  const lease = await Lease.findById(id);
  if (!lease) return { error: NextResponse.json({ error: 'Bail introuvable' }, { status: 404 }) };
  if (String(lease.user) !== String(user._id)) {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) };
  }
  return { lease, user };
}

export const POST = withErrorHandler(async (request: NextRequest, ctx: any) => {
  const { id } = await ctx.params;
  const { lease, user, error } = await requireOwnedLease(id);
  if (error) return error;

  if (!lease.tenantEmail) {
    return NextResponse.json({ error: 'Email du locataire manquant sur le bail.' }, { status: 400 });
  }
  const docs = Array.isArray(lease.generatedDocuments) ? lease.generatedDocuments : [];
  if (!docs.some((d: any) => d.pdfPath)) {
    return NextResponse.json(
      { error: 'Le bail doit être généré (PDF) avant envoi en signature.' },
      { status: 400 },
    );
  }

  // Identité déjà vérifiée eIDAS (Didit) lors de la candidature → mise en avant
  // dans le certificat de signature.
  let diditVerified = false;
  if (lease.applicationId) {
    const app = await Application.findById(lease.applicationId).select('didit').lean();
    diditVerified = (app as any)?.didit?.status === 'VERIFIED';
  }

  const ownerFullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Le bailleur';
  const result = await openSignatureCampaign(String(lease._id), {
    ownerEmail: user.email,
    ownerFullName,
    diditVerified,
  });

  logger.info('[lease-signature] campagne ouverte', {
    leaseId: String(lease._id),
    signers: result.signers,
  });
  return NextResponse.json({ success: true, ...result });
});

export const GET = withErrorHandler(async (_request: NextRequest, ctx: any) => {
  const { id } = await ctx.params;
  const { lease, error } = await requireOwnedLease(id);
  if (error) return error;

  const signatures = await LeaseSignature.find({ lease: lease._id })
    .select('role slot fullName email status signedAt viewedAt otpVerifiedAt diditVerified order inviteSentAt inviteError remindersSentAt')
    .sort({ order: 1 })
    .lean();

  return NextResponse.json({
    leaseStatus: lease.leaseStatus,
    signatureStatus: lease.signatureStatus,
    signedPdfPath: lease.signedPdfPath || null,
    signatures: signatures.map((s: any) => ({ ...s, _id: String(s._id) })),
  });
});
