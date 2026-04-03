import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { CreateLeaseSchema, checkDiagnosticExpiry } from '@/lib/validations/lease';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');

/**
 * GET /api/leases
 * Returns all leases for the authenticated owner.
 */
export const GET = withErrorHandler(async () => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const properties = await Property.find({ user: user._id }).select('_id').lean();
  const propertyIds = properties.map((p: { _id: unknown }) => p._id);

  const leases = await Lease.find({ property: { $in: propertyIds } })
    .populate('property', 'name address')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ success: true, data: leases });
});

/**
 * POST /api/leases
 * Create a new lease from the contract wizard.
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const body = await request.json();
  const result = validateRequest(CreateLeaseSchema, body);
  if (!result.success) return result.response;

  const data = result.data;

  // Verify property ownership
  const property = await Property.findOne({ _id: data.propertyId, user: user._id }).lean();
  if (!property) {
    return NextResponse.json({ error: 'Bien introuvable ou non autorisé' }, { status: 404 });
  }

  // Compute endDate
  const startDate = new Date(data.startDate);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + data.durationMonths);

  const lease = await Lease.create({
    user: user._id,
    property: data.propertyId,
    applicationId: data.applicationId || undefined,
    candidature: data.candidatureId || undefined,
    source: 'FLOW',
    leaseStatus: 'DRAFT',
    signatureStatus: 'PENDING',
    tenantFirstName: data.tenantFirstName,
    tenantLastName: data.tenantLastName,
    tenantEmail: data.tenantEmail,
    tenantPhone: data.tenantPhone || '',
    leaseType: data.leaseType,
    startDate,
    endDate,
    rentAmount: data.rentAmount,
    chargesAmount: data.chargesAmount,
    depositAmount: data.depositAmount,
    paymentDay: data.paymentDay,
    durationMonths: data.durationMonths,
    additionalClauses: data.additionalClauses || '',
    generatedDocuments: (data.generatedDocuments || []).map((doc: Record<string, unknown>) => ({
      kind: doc.kind === 'guarantee' ? 'GUARANTEE' : 'LEASE',
      template: doc.template || '',
      fileName: doc.fileName || '',
      mimeType: doc.mimeType || '',
      docxPath: doc.docxPath || '',
      pdfPath: doc.pdfPath || '',
      createdAt: new Date(),
    })),
  });

  // Check diagnostic expiry (loi ALUR — art. L.271-4)
  const diagnosticWarnings = checkDiagnosticExpiry(
    (property as { diagnostics?: { type: string; expiryDate?: Date; isValid?: boolean }[] }).diagnostics || []
  );

  return NextResponse.json({
    success: true,
    data: lease,
    ...(diagnosticWarnings.length > 0 && { warnings: diagnosticWarnings }),
  }, { status: 201 });
});
