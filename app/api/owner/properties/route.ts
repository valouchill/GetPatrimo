import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth-options';
import { validateRequest } from '@/lib/validate-request';
import { connectDiditDb } from '@/app/api/didit/db';
import Property from '@/models/Property';
import Application from '@/models/Application';

const CreatePropertySchema = z.object({
  address: z.string().min(1, { error: 'Adresse requise' }),
  rentAmount: z.number({ error: 'Le loyer doit être un nombre' }).optional(),
  surfaceM2: z.number({ error: 'La surface doit être un nombre' }).optional(),
  chargesAmount: z.number().optional(),
  propertyType: z.string().optional(),
  rooms: z.number().optional(),
  bedrooms: z.number().optional(),
  floor: z.number().optional(),
  totalFloors: z.number().optional(),
  equipment: z.array(z.string()).optional(),
  description: z.string().optional(),
  purchasePrice: z.number().optional(),
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
    const u = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = u?._id?.toString();
  }
  return userId || null;
}

/**
 * GET /api/owner/properties
 */
export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) return NextResponse.json([]);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || '';
    const properties = await Property.find({ user: userId, archived: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();

    // Batch: lier les applications orphelines à leurs propriétés en une seule opération
    const applyTokens = properties
      .filter((p: any) => p.applyToken)
      .map((p: any) => ({ token: p.applyToken, id: p._id }));

    if (applyTokens.length > 0) {
      await Promise.all(
        applyTokens.map(({ token, id }: { token: string; id: any }) =>
          Application.updateMany(
            {
              applyToken: token,
              $or: [{ property: { $exists: false } }, { property: null }],
            },
            { $set: { property: id } }
          )
        )
      );
    }

    // Batch: charger toutes les applications de toutes les propriétés en une seule requête
    const propertyIds = properties.map((p: any) => p._id);
    const allApplications = await Application.find({
      property: { $in: propertyIds },
      status: { $in: ['COMPLETE', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'] },
    })
      .select('property applyToken profile userEmail patrimometer didit guarantor guarantee financialSummary status submittedAt documents passportSlug passportViewCount passportShareCount pipelineStage ownerDecision createdAt updatedAt')
      .lean();

    // Indexer les applications par property ID
    const appsByProperty = new Map<string, any[]>();
    for (const app of allApplications) {
      const key = String((app as any).property);
      if (!appsByProperty.has(key)) appsByProperty.set(key, []);
      appsByProperty.get(key)!.push(app);
    }

    const result = await Promise.all(
      properties.map(async (prop: any) => {
        const applications = appsByProperty.get(String(prop._id)) || [];

        const isManaged = prop.managed === true || !!prop.stripeSubscriptionId;
        const mappedCandidates = applications.map((app: any, idx: number) => {
          const firstName = app.profile?.firstName || '';
          const lastName = app.profile?.lastName || '';
          const ownerInsights = buildOwnerApplicationInsights({
            application: app,
            property: prop,
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
                ? app.documents.filter((d: any) => d?.status === 'CERTIFIED' && !d?.flagged).length
                : 0,
              status: app.status,
              submittedAt: app.submittedAt,
              pipelineStage: app.pipelineStage || 'received',
            };
          }

          return {
            id: app._id.toString(),
            applyToken: app.applyToken,
            isSealed: false,
            profile: app.profile,
            patrimometer: app.patrimometer,
            financialSummary: normalizedFinancialSummary,
            didit: app.didit,
            guarantor: app.guarantor,
            guarantee: app.guarantee || null,
            ownerInsights,
            passport: ownerInsights.passport,
            documentsCount: Array.isArray(app.documents) ? app.documents.length : 0,
            certifiedDocumentsCount: Array.isArray(app.documents)
              ? app.documents.filter((d: any) => d?.status === 'CERTIFIED' && !d?.flagged).length
              : 0,
            status: app.status,
            submittedAt: app.submittedAt,
          };
        });

        const orderedCandidates = decorateCandidatesForOwner(
          mappedCandidates,
          String(prop.acceptedTenantId || ''),
          isManaged
        );
        const flow = buildOwnerPropertyFlow({
          property: {
            ...prop,
            id: prop._id.toString(),
            managed: isManaged,
            acceptedTenantId: prop.acceptedTenantId ? String(prop.acceptedTenantId) : null,
            isRented: prop.status === 'OCCUPIED',
          },
          candidates: orderedCandidates,
        });

        return {
          property: {
            id: prop._id.toString(),
            title: prop.name,
            address: prop.address,
            rent: prop.rentAmount,
            chargesAmount: prop.chargesAmount || 0,
            surfaceM2: prop.surfaceM2,
            applyToken: prop.applyToken,
            status: prop.status,
            archived: prop.archived || false,
            managed: isManaged,
            isRented: prop.status === 'OCCUPIED',
            propertyType: prop.propertyType || 'APPARTEMENT',
            floor: prop.floor ?? null,
            rooms: prop.rooms ?? null,
            purchasePrice: prop.purchasePrice ?? null,
            vacantSince: prop.vacantSince || null,
          },
          flow,
          primaryCandidate: flow.primaryCandidate,
          candidatures: orderedCandidates,
        };
      })
    );

    return NextResponse.json(result);
  } catch (e) {
    console.error('GET /api/owner/properties', e);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des biens' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/properties
 * Crée un bien pour le propriétaire déjà connecté (mode Context-Aware).
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const result = validateRequest(CreatePropertySchema, body);
    if (!result.success) return result.response;
    const { address, surfaceM2, rentAmount, chargesAmount, propertyType, rooms, bedrooms, floor, totalFloors, equipment, description, purchasePrice } = result.data;

    const property = await Property.create({
      user: userId,
      name: String(address).slice(0, 80),
      address: String(address).trim(),
      rentAmount: Number(rentAmount) || 0,
      chargesAmount: Number(chargesAmount) || 0,
      surfaceM2: surfaceM2 ? Number(surfaceM2) : null,
      propertyType: propertyType || 'APPARTEMENT',
      rooms: rooms ?? null,
      bedrooms: bedrooms ?? null,
      floor: floor ?? null,
      totalFloors: totalFloors ?? null,
      equipment: equipment || [],
      description: description || '',
      purchasePrice: purchasePrice ?? null,
      status: 'AVAILABLE',
    });

    return NextResponse.json({
      ok: true,
      property: {
        id: property._id.toString(),
        address: property.address,
        applyToken: property.applyToken,
      },
    });
  } catch (e) {
    console.error('POST /api/owner/properties', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
