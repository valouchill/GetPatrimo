import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

import Application from '@/models/Application';
import Property from '@/models/Property';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildOwnerApplicationInsights } = require('@/src/utils/ownerApplicationInsights');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { decorateCandidatesForOwner } = require('@/src/utils/ownerFlowModel');

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
      .select('applyToken profile userEmail financialSummary guarantor guarantee didit patrimometer status submittedAt documents passportSlug passportViewCount passportShareCount createdAt updatedAt')
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || '';
    const isManaged = property.managed === true || !!property.stripeSubscriptionId;

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
          userEmail: '',
          financialSummary: normalizedFinancialSummary,
          guarantor: { status: app.guarantor?.status || 'NONE' },
          guarantee: app.guarantee || null,
          didit: { status: app.didit?.status || 'UNKNOWN' },
          patrimometer: app.patrimometer || {},
          passport: maskedPassport,
          ownerInsights: {
            ...ownerInsights,
            passport: maskedPassport,
          },
          documentsCount: Array.isArray(app.documents) ? app.documents.length : 0,
          certifiedDocumentsCount: Array.isArray(app.documents)
            ? app.documents.filter((doc: any) => doc?.status === 'certified' && !doc?.flagged).length
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
          ? app.documents.filter((doc: any) => doc?.status === 'certified' && !doc?.flagged).length
          : 0,
        status: app.status,
        submittedAt: app.submittedAt,
      };
    });

    return NextResponse.json({
      candidatures: decorateCandidatesForOwner(
        candidates,
        String(property.acceptedTenantId || ''),
        isManaged
      ),
      selectedCandidateId: property.acceptedTenantId ? String(property.acceptedTenantId) : null,
      unlocked: isManaged,
    });
  } catch (error) {
    console.error('GET /api/owner/properties/[id]/candidatures', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
