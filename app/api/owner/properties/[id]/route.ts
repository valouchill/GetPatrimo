import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth-options';
import { validateRequest } from '@/lib/validate-request';
import { connectDiditDb } from '@/app/api/didit/db';
import Property from '@/models/Property';
import Application from '@/models/Application';
import Lease from '@/models/Lease';

const PatchPropertySchema = z.object({
  address: z.string().min(1, { error: 'Adresse requise' }).optional(),
  surfaceM2: z.number({ error: 'La surface doit être un nombre' }).optional(),
  rentAmount: z.number({ error: 'Le loyer doit être un nombre' }).optional(),
  archived: z.boolean({ error: 'Le champ archivé doit être un booléen' }).optional(),
});
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildOwnerApplicationInsights } = require('@/src/utils/ownerApplicationInsights');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildOwnerPropertyFlow, decorateCandidatesForOwner } = require('@/src/utils/ownerFlowModel');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

function buildVaultDocuments(lease: any) {
  if (!lease) return [];

  const documents = new Map<string, any>();

  const register = (id: string, payload: Record<string, unknown>) => {
    if (!id) return;
    documents.set(id, {
      ...(documents.get(id) || {}),
      ...payload,
    });
  };

  const generatedDocuments = Array.isArray(lease.generatedDocuments) ? lease.generatedDocuments : [];
  generatedDocuments.forEach((document: any, index: number) => {
    const fileName = String(document?.fileName || '').trim();
    const pdfPath = String(document?.pdfPath || '').trim();
    register(`generated-${index}-${fileName}`, {
      id: `generated-${index}-${fileName}`,
      label: document?.kind === 'GUARANTEE' ? 'Acte de caution' : 'Bail ALUR',
      status: 'generated',
      kind: document?.kind || 'lease',
      fileName: fileName || `document-${index + 1}.pdf`,
      downloadUrl:
        pdfPath.includes('uploads/leases/compiled/') && fileName
          ? `/api/owner/leases/compiled/${encodeURIComponent(fileName)}`
          : null,
    });
  });

  const openSignDocuments = Array.isArray(lease.opensignDocuments) ? lease.opensignDocuments : [];
  openSignDocuments.forEach((document: any, index: number) => {
    register(`opensign-${index}-${document?.kind || 'lease'}`, {
      id: `opensign-${index}-${document?.kind || 'lease'}`,
      label: document?.kind === 'GUARANTEE' ? 'Caution signee' : 'Bail signe',
      status: document?.status || 'pending',
      kind: document?.kind || 'lease',
      fileName: String(document?.signedPdfPath || '').split('/').pop() || null,
      downloadUrl: null,
    });
  });

  if (lease.signedPdfPath) {
    register('signed-primary-lease', {
      id: 'signed-primary-lease',
      label: 'Bail signe',
      status: 'signed',
      kind: 'lease',
      fileName: String(lease.signedPdfPath).split('/').pop() || 'bail-signe.pdf',
      downloadUrl: null,
    });
  }

  if (lease.edlPdfPath) {
    register('entry-report', {
      id: 'entry-report',
      label: "Etat des lieux d'entree",
      status: 'generated',
      kind: 'inventory',
      fileName: String(lease.edlPdfPath).split('/').pop() || 'etat-des-lieux.pdf',
      downloadUrl: null,
    });
  }

  return Array.from(documents.values());
}

/**
 * GET /api/owner/properties/[id]
 * Récupère le détail du bien pour le propriétaire connecté.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }
    const { id } = await params;

    const propertyDoc = await Property.findOne({ _id: id, user: userId }).lean();
    if (!propertyDoc) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }
    const property = propertyDoc as any;
    const isManaged = property.managed === true || !!property.stripeSubscriptionId;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || '';
    const leaseDoc: any = await Lease.findOne({ property: id, user: userId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const applications = await Application.find({
      property: id,
      status: { $in: ['COMPLETE', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'] },
    })
      .select('applyToken profile userEmail financialSummary guarantor guarantee didit patrimometer status submittedAt documents passportSlug passportViewCount passportShareCount createdAt updatedAt')
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const candidates = applications.map((app: any, idx: number) => {
      const firstName = app.profile?.firstName || '';
      const lastName = app.profile?.lastName || '';
      const ownerInsights = buildOwnerApplicationInsights({
        application: app,
        property,
        baseUrl,
        isSealed: !isManaged,
      });

      const maskedPassport = !isManaged
        ? {
            ...ownerInsights.passport,
            previewUrl: null,
            shareUrl: null,
            downloadUrl: null,
            shareEnabled: false,
          }
        : ownerInsights.passport;

      const normalizedFinancialSummary = {
        totalMonthlyIncome: Number(app.financialSummary?.totalMonthlyIncome || 0) || 0,
        monthlyNetIncome: ownerInsights.financial.monthlyIncome || 0,
        contractType: app.financialSummary?.incomeSource || '',
        incomeSource: app.financialSummary?.incomeSource || '',
        certifiedIncome: Boolean(app.financialSummary?.certifiedIncome),
        remainingIncome: ownerInsights.financial.remainingIncome,
        riskLevel: ownerInsights.financial.riskBand.label,
        riskPercent: ownerInsights.financial.riskBand.score,
        effortRate: ownerInsights.financial.effortRate,
      };

      if (!isManaged) {
        return {
          id: app._id.toString(),
          applyToken: app.applyToken,
          isSealed: true,
          sealedLabel: `${firstName.charAt(0) || '?'}. ${lastName.charAt(0) || '?'}.`,
          sealedId: `#${String(400 + idx + 1)}`,
          profile: {
            firstName: `${firstName.charAt(0)}.`,
            lastName: `${lastName.charAt(0)}.`,
            phone: null,
            email: null,
          },
          patrimometer: app.patrimometer,
          financialSummary: normalizedFinancialSummary,
          didit: { status: app.didit?.status || 'UNKNOWN' },
          guarantor: { status: app.guarantor?.status || 'NONE' },
          guarantee: app.guarantee || null,
          ownerInsights: {
            ...ownerInsights,
            passport: maskedPassport,
          },
          passport: maskedPassport,
          documentsCount: Array.isArray(app.documents) ? app.documents.length : 0,
          certifiedDocumentsCount: Array.isArray(app.documents)
            ? app.documents.filter((doc: any) => doc?.status === 'CERTIFIED' && !doc?.flagged).length
            : 0,
          status: app.status,
          submittedAt: app.submittedAt,
        };
      }

      return {
        id: app._id.toString(),
        applyToken: app.applyToken,
        isSealed: false,
        profile: app.profile || {},
        userEmail: app.userEmail || '',
        financialSummary: normalizedFinancialSummary,
        guarantor: app.guarantor || {},
        guarantee: app.guarantee || null,
        didit: app.didit || {},
        patrimometer: app.patrimometer || {},
        passport: ownerInsights.passport,
        ownerInsights,
        documentsCount: Array.isArray(app.documents) ? app.documents.length : 0,
        certifiedDocumentsCount: Array.isArray(app.documents)
          ? app.documents.filter((doc: any) => doc?.status === 'CERTIFIED' && !doc?.flagged).length
          : 0,
        status: app.status,
        submittedAt: app.submittedAt,
      };
    });
    const orderedCandidates = decorateCandidatesForOwner(
      candidates,
      String(property.acceptedTenantId || ''),
      isManaged
    );
    const flow = buildOwnerPropertyFlow({
      property: {
        ...property,
        id: property._id.toString(),
        managed: isManaged,
        acceptedTenantId: property.acceptedTenantId ? String(property.acceptedTenantId) : null,
        isRented: property.status === 'OCCUPIED',
      },
      candidates: orderedCandidates,
    });

    return NextResponse.json({
      _id: property._id.toString(),
      acceptedTenantId: property.acceptedTenantId ? String(property.acceptedTenantId) : null,
      name: property.name,
      address: property.address,
      applyToken: property.applyToken,
      rentAmount: property.rentAmount,
      chargesAmount: property.chargesAmount,
      surfaceM2: property.surfaceM2,
      type: property.type || '',
      furnished: property.furnished || '',
      archived: Boolean(property.archived),
      managed: isManaged,
      status: property.status,
      isRented: property.status === 'OCCUPIED',
      flow,
      primaryCandidate: flow.primaryCandidate,
      managementTools: {
        leaseId: leaseDoc?._id ? String(leaseDoc._id) : null,
        signatureStatus: leaseDoc?.signatureStatus || 'PENDING',
        edlStatus: leaseDoc?.edlStatus || 'PENDING',
        vaultDocuments: buildVaultDocuments(leaseDoc),
      },
    });
  } catch (e) {
    console.error('GET /api/owner/properties/[id]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * PATCH /api/owner/properties/[id]
 * Met à jour les champs modifiables d'un bien (adresse, surface, loyer).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const { id } = await params;
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }
    const body = await request.json();
    const validationResult = validateRequest(PatchPropertySchema, body);
    if (!validationResult.success) return validationResult.response;

    const updates: Record<string, unknown> = {};
    if (body.address !== undefined) {
      updates.address = body.address;
      updates.name = body.address.slice(0, 80);
    }
    if (body.surfaceM2 !== undefined) updates.surfaceM2 = Number(body.surfaceM2) || null;
    if (body.rentAmount !== undefined) updates.rentAmount = Number(body.rentAmount) || 0;
    if (body.archived !== undefined) updates.archived = Boolean(body.archived);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
    }

    const propertyDoc = await Property.findOneAndUpdate({ _id: id, user: userId }, updates, { new: true }).lean();
    if (!propertyDoc) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }
    const property = propertyDoc as any;

    return NextResponse.json({ ok: true, property });
  } catch (e) {
    console.error('PATCH /api/owner/properties/[id]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
