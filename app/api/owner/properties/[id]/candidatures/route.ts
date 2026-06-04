import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';

import Application from '@/models/Application';
import Property from '@/models/Property';
 
const { buildOwnerApplicationInsights } = require('@/src/utils/ownerApplicationInsights');
 
const { decorateCandidatesForOwner } = require('@/src/utils/ownerFlowModel');
 
const { resolveResilienceScore } = require('@/src/utils/resilienceScore');

 
const User = require('@/models/User');

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
};

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

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

    if (property.applyToken) {
      await Application.updateMany(
        {
          applyToken: property.applyToken,
          $or: [
            { property: { $exists: false } },
            { property: null },
          ],
        },
        {
          $set: { property: property._id },
        }
      );
    }

    const applications = await Application.find({
      property: id,
      status: { $in: ['COMPLETE', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'] },
    })
      .select('applyToken profile userEmail financialSummary guarantor guarantee didit patrimometer aiAuditV2 status submittedAt documents passportSlug passportViewCount passportShareCount createdAt updatedAt coTenants isColocation coTenantCount')
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || '';
    const isManaged = property.managed === true || !!property.stripeSubscriptionId;

    const candidates = applications.map((app: any, idx: number) => {
      const firstName = app.profile?.firstName || '';
      const lastName = app.profile?.lastName || '';
      // Colocation : composition du foyer (masquée si scellé).
      const appCoTenants = Array.isArray(app.coTenants) ? app.coTenants : [];
      const isColocation = Boolean(app.isColocation) && appCoTenants.length > 0;
      const baseName = isManaged
        ? `${firstName} ${lastName}`.trim()
        : `${firstName.charAt(0) || '?'}. ${lastName.charAt(0) || '?'}.`;
      const coTenantsPublic = appCoTenants.map((c: any) => ({
        slot: c.slot,
        firstName: isManaged ? (c.firstName || '') : `${(c.firstName || '?').charAt(0)}.`,
        lastName: isManaged ? (c.lastName || '') : `${(c.lastName || '?').charAt(0)}.`,
        status: c.status || 'NONE',
        identityVerified: c.status === 'CERTIFIED' || c.didit?.status === 'VERIFIED',
      }));
      const householdLabel = isColocation
        ? `${baseName} + ${appCoTenants.length} ${appCoTenants.length > 1 ? 'colocataires' : 'colocataire'}`
        : baseName;
      const ownerInsights = buildOwnerApplicationInsights({
        application: app,
        property,
        baseUrl,
        isSealed: !isManaged,
      });
      const resilience = resolveResilienceScore(app);

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
          userEmail: '',
          isColocation,
          coTenants: coTenantsPublic,
          householdLabel,
          financialSummary: normalizedFinancialSummary,
          guarantor: { status: app.guarantor?.status || 'NONE' },
          guarantee: app.guarantee || null,
          didit: { status: app.didit?.status || 'UNKNOWN' },
          patrimometer: app.patrimometer || {},
          aiAuditV2: app.aiAuditV2 || null,
          resilience,
          passport: maskedPassport,
          ownerInsights: {
            ...ownerInsights,
            passport: maskedPassport,
          },
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
        isColocation,
        coTenants: coTenantsPublic,
        householdLabel,
        financialSummary: normalizedFinancialSummary,
        guarantor: app.guarantor || {},
        guarantee: app.guarantee || null,
        didit: app.didit || {},
        patrimometer: app.patrimometer || {},
        aiAuditV2: app.aiAuditV2 || null,
        resilience,
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

    const selectedCandidateId = property.acceptedTenantId ? String(property.acceptedTenantId) : null;
    const decorated = decorateCandidatesForOwner(
      candidates,
      String(property.acceptedTenantId || ''),
      isManaged
    );

    return NextResponse.json(
      {
        candidatures: decorated,
        selectedCandidateId,
        selectionRequired: decorated.length > 0 && !selectedCandidateId,
        unlocked: isManaged,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    logger.error('GET /api/owner/properties/[id]/candidatures', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
