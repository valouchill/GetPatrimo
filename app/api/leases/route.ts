import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { CreateLeaseSchema, checkDiagnosticExpiry } from '@/lib/validations/lease';

 
const User = require('@/models/User');
 
const Lease = require('@/models/Lease');
 
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

  // Colocation + Visale : copiés depuis le DOSSIER côté serveur (le client ne
  // les envoie pas). Lease.coTenants alimente les variables plurielles du bail
  // ET la file de signature séquentielle ; guarantor.visaleNumber exclut le
  // garant Visale des signataires (la garantie est portée par Action Logement).
  let appCoTenants: Array<{ firstName: string; lastName: string; email: string; phone: string }> = [];
  let appVisaleNumber = '';
  if (data.applicationId) {
    const Application = require('@/models/Application');
    const app = await Application.findOne({ _id: data.applicationId, property: data.propertyId })
      .select('coTenants guarantee guarantor')
      .lean()
      .catch(() => null);
    if (app) {
      appCoTenants = (Array.isArray(app.coTenants) ? app.coTenants : []).map((ct: any) => ({
        firstName: ct?.didit?.identityData?.firstName || ct?.firstName || '',
        lastName: ct?.didit?.identityData?.lastName || ct?.lastName || '',
        email: ct?.email || '',
        phone: ct?.phone || '',
      })).filter((ct: any) => ct.email || ct.firstName);
      appVisaleNumber = app.guarantee?.visaleNumber || app.guarantee?.visale?.visaleNumber || '';
    }
  }
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
    ...(appCoTenants.length > 0 && { coTenants: appCoTenants }),
    ...(appVisaleNumber && { guarantor: { visaleNumber: appVisaleNumber } }),
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
    // Sécurité (revue F1) : les artefacts compilés sont nommés `<userId>-...`
    // par persistArtifact — on n'accepte QUE les fichiers du compte courant,
    // sinon un bail pourrait pointer (et faire servir publiquement au
    // signataire) le PDF d'un autre bailleur.
    generatedDocuments: (data.generatedDocuments || [])
      .filter((doc: Record<string, unknown>) => {
        const own = (v: unknown) =>
          !v || String(v).split('/').pop()!.startsWith(`${String(user._id)}-`);
        return own(doc.pdfPath) && own(doc.docxPath);
      })
      .map((doc: Record<string, unknown>) => ({
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
