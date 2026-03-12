import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectDiditDb } from '@/app/api/didit/db';
import Document from '@/models/Document';
import Candidature from '@/models/Candidature';
import { calculatePatrimoScore } from '@/scoringEngine';

/**
 * API Route pour calculer le PatrimoScore™ d'un locataire/candidat
 * 
 * GET /api/scoring/tenant?candidatureId=xxx
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
    const candidatureId = searchParams.get('candidatureId');

    if (!candidatureId) {
      return NextResponse.json(
        { error: 'candidatureId requis' },
        { status: 400 }
      );
    }

    const candidature = await Candidature.findById(candidatureId);
    if (!candidature) {
      return NextResponse.json(
        { error: 'Candidature introuvable' },
        { status: 404 }
      );
    }

    // Convertir les documents de la candidature au format attendu
    const documents = (candidature.docs || []).map((doc: any) => ({
      type: doc.type || 'autre',
      documentDate: doc.documentDate || doc.createdAt,
      expirationDate: doc.expirationDate,
      metadata: doc.metadata || {},
      createdAt: doc.createdAt || new Date(),
      uploadedAt: doc.createdAt || new Date()
    }));

    const tenantName = candidature.firstName || 'Candidat';

    // Calculer le score
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
