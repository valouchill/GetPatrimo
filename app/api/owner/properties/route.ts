import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectDiditDb } from '@/app/api/didit/db';
import Property from '@/models/Property';
import Application from '@/models/Application';
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

    const properties = await Property.find({ user: userId })
      .sort({ archived: 1, createdAt: -1 })
      .lean();

    const result = await Promise.all(
      properties.map(async (prop: any) => {
        const applications = await Application.find({
          property: prop._id,
          status: { $in: ['COMPLETE', 'SUBMITTED', 'PENDING_REVIEW', 'ACCEPTED'] },
        })
          .select('profile patrimometer didit guarantor financialSummary status submittedAt documents')
          .lean();

        const isManaged = prop.managed === true || !!prop.stripeSubscriptionId;

        return {
          property: {
            id: prop._id.toString(),
            title: prop.name,
            address: prop.address,
            rent: prop.rentAmount,
            chargesAmount: prop.chargesAmount,
            surfaceM2: prop.surfaceM2,
            applyToken: prop.applyToken,
            status: prop.status,
            archived: prop.archived || false,
            managed: isManaged,
            isRented: prop.status === 'OCCUPIED',
          },
          candidatures: applications.map((app: any, idx: number) => {
            const firstName = app.profile?.firstName || '';
            const lastName = app.profile?.lastName || '';

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
                financialSummary: app.financialSummary || null,
                didit: { status: app.didit?.status || 'UNKNOWN' },
                guarantor: { status: app.guarantor?.status || 'NONE' },
                documentsCount: Array.isArray(app.documents) ? app.documents.length : 0,
                certifiedDocumentsCount: Array.isArray(app.documents)
                  ? app.documents.filter((d: any) => d.analysisResult?.isAuthentic === true).length
                  : 0,
                status: app.status,
                submittedAt: app.submittedAt,
              };
            }

            return {
              id: app._id.toString(),
              applyToken: app.applyToken,
              isSealed: false,
              profile: app.profile,
              patrimometer: app.patrimometer,
              financialSummary: app.financialSummary || null,
              didit: app.didit,
              guarantor: app.guarantor,
              documentsCount: Array.isArray(app.documents) ? app.documents.length : 0,
              certifiedDocumentsCount: Array.isArray(app.documents)
                ? app.documents.filter((d: any) => d.analysisResult?.isAuthentic === true).length
                : 0,
              status: app.status,
              submittedAt: app.submittedAt,
            };
          }),
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
    const { address, surfaceM2, rentAmount } = body;

    if (!address || !String(address).trim()) {
      return NextResponse.json({ error: 'Adresse requise' }, { status: 400 });
    }

    const property = await Property.create({
      user: userId,
      name: String(address).slice(0, 80),
      address: String(address).trim(),
      rentAmount: Number(rentAmount) || 0,
      chargesAmount: 0,
      surfaceM2: surfaceM2 ? Number(surfaceM2) : null,
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
