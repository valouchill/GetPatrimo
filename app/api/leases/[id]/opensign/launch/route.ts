import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { logger } from '@/lib/server-logger';

 
const User = require('@/models/User');
 
const Lease = require('@/models/Lease');
 
const { compileLeaseBundle } = require('@/src/services/leaseCompileService');
 
const { sendDocumentsForSignature } = require('@/src/services/opensignService');

/**
 * POST /api/leases/[id]/opensign/launch
 * Launches the OpenSign e-signature flow for a lease.
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  if (!process.env.OPENSIGN_API_KEY) {
    return NextResponse.json({ error: 'Service de signature electronique non configure (OPENSIGN_API_KEY manquant)' }, { status: 503 });
  }

  const { id } = await params;
  await connectDiditDb();

  const user = await User.findOne({ email: (session.user as { email: string }).email });
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  const lease = await Lease.findById(id).populate('property');
  if (!lease) return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });
  if (String(lease.user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
  }

  if (!lease.tenantEmail) {
    return NextResponse.json({ error: 'Email du locataire requis pour la signature' }, { status: 400 });
  }

  // Build parties
  const parties = {
    tenant: {
      firstName: lease.tenantFirstName || '',
      lastName: lease.tenantLastName || '',
      email: lease.tenantEmail,
    },
    owner: {
      firstName: user.firstName || user.email.split('@')[0],
      lastName: user.lastName || '',
      email: user.email,
      id: String(user._id),
    },
    guarantor: lease.guarantor?.email ? {
      firstName: lease.guarantor.firstName || '',
      lastName: lease.guarantor.lastName || '',
      email: lease.guarantor.email,
      visaleNumber: lease.guarantor.visaleNumber || '',
    } : null,
  };

  // Compile documents if not already done
  let documents = lease.generatedDocuments || [];
  if (!documents.length || !documents[0]?.pdfPath) {
    const compiled = await compileLeaseBundle({
      propertyId: String(lease.property._id || lease.property),
      applicationId: lease.applicationId ? String(lease.applicationId) : undefined,
      candidatureId: lease.candidature ? String(lease.candidature) : undefined,
      formData: {},
      userId: String(user._id),
    });
    documents = compiled.documents;
  }

  // Send to OpenSign
  const opensignResult = await sendDocumentsForSignature({
    lease,
    property: lease.property,
    parties,
    documents,
  });

  const primaryDoc = opensignResult.documents.find((d: any) => d.kind === 'LEASE') || opensignResult.documents[0];

  // Update lease with OpenSign info
  lease.opensignDocuments = opensignResult.documents.map((d: any) => ({
    kind: d.kind,
    documentId: d.documentId,
    status: d.status,
    signingLinks: d.signingLinks,
  }));
  lease.opensignDocumentId = primaryDoc?.documentId;
  lease.opensignStatus = 'PENDING';
  lease.opensignSigningLinks = primaryDoc?.signingLinks || {};
  lease.signatureStatus = 'PENDING';
  lease.leaseStatus = 'PENDING_SIGNATURE';
  await lease.save();

  logger.info('[opensign] Signature launched', { leaseId: id, docs: opensignResult.documents.length });

  return NextResponse.json({
    success: true,
    message: 'Signature electronique lancee',
    lease: {
      id: lease._id,
      opensignStatus: lease.opensignStatus,
      documentsCount: opensignResult.documents.length,
      hasGuaranteeDocument: opensignResult.documents.some((d: any) => d.kind === 'GUARANTEE'),
    },
  });
});
