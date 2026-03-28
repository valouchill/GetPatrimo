import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth-options';
import { validateRequest } from '@/lib/validate-request';
import { connectDiditDb } from '@/app/api/didit/db';
import Document from '@/models/Document';
import Property from '@/models/Property';
import Candidature from '@/models/Candidature';
import { calculatePatrimoScore } from '@/scoringEngine';

const CalculateScoreSchema = z.object({
  documents: z.array(z.record(z.string(), z.unknown()), { error: 'Liste de documents requise' }),
  tenantName: z.string({ error: 'Le nom du locataire doit être une chaîne' }).optional(),
});

/**
 * API Route pour calculer le PatrimoScore™ avec règles de péremption
 *
 * GET /api/scoring/calculate?propertyId=xxx&candidatureId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    await connectDiditDb();

    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const candidatureId = searchParams.get('candidatureId');

    if (!propertyId && !candidatureId) {
      return NextResponse.json(
        { error: 'propertyId ou candidatureId requis' },
        { status: 400 }
      );
    }

    let documents: any[] = [];
    let tenantName = 'Candidat';

    if (candidatureId) {
      const candidature = await Candidature.findById(candidatureId);
      if (!candidature) {
        return NextResponse.json(
          { error: 'Candidature introuvable' },
          { status: 404 }
        );
      }
      const property = await Property.findById(candidature.property);
      if (!property) {
        return NextResponse.json(
          { error: 'Bien introuvable' },
          { status: 404 }
        );
      }
      documents = (candidature.docs || []).map((doc: any) => ({
        type: doc.type || 'autre',
        documentDate: doc.documentDate || doc.createdAt,
        expirationDate: doc.expirationDate,
        metadata: doc.metadata || {},
        createdAt: doc.createdAt || new Date(),
        uploadedAt: doc.createdAt || new Date()
      }));
      tenantName = candidature.firstName || 'Candidat';
    } else if (propertyId) {
      const property = await Property.findById(propertyId);
      if (!property) {
        return NextResponse.json(
          { error: 'Bien introuvable' },
          { status: 404 }
        );
      }
      const rawDocs = await Document.find({ property: propertyId });
      documents = rawDocs.map((d: any) => ({
        type: d.type || 'autre',
        documentDate: d.documentDate || d.createdAt,
        expirationDate: d.expirationDate,
        metadata: d.metadata || {},
        createdAt: d.createdAt,
        uploadedAt: d.createdAt
      }));
    }

    const scoreResult = calculatePatrimoScore(documents, { tenantName });
    return NextResponse.json(scoreResult);
  } catch (error: any) {
    console.error('Erreur calcul score:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul du score', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scoring/calculate
 */
export async function POST(request: NextRequest) {
  try {
    await connectDiditDb();

    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = validateRequest(CalculateScoreSchema, body);
    if (!result.success) return result.response;
    const { documents, tenantName } = result.data;

    const scoreResult = calculatePatrimoScore(documents, { tenantName: tenantName || 'Candidat' });
    return NextResponse.json(scoreResult);
  } catch (error: any) {
    console.error('Erreur calcul score:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul du score', details: error.message },
      { status: 500 }
    );
  }
}
