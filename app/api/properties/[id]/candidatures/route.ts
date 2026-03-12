import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import Property from '@/models/Property';
import { calculateIntegrityScore } from '@/app/utils/integrity-score';

/**
 * API Route pour récupérer les candidatures d'une propriété avec leur Note d'Intégrité
 * 
 * GET /api/properties/[id]/candidatures
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDiditDb();
    
    const { id } = await params;
    
    // Trouver la propriété
    const property = await Property.findById(id);
    if (!property) {
      return NextResponse.json(
        { error: 'Propriété introuvable' },
        { status: 404 }
      );
    }

    // Trouver toutes les candidatures pour cette propriété
    const applications = await Application.find({
      property: id,
      status: { $in: ['COMPLETE', 'SUBMITTED', 'PENDING_REVIEW'] },
    })
      .populate('guarantor.guarantorId')
      .sort({ 'tunnel.completedAt': -1, createdAt: -1 })
      .lean();

    // Calculer la Note d'Intégrité pour chaque candidature
    const candidaturesWithIntegrity = applications.map((app: any) => {
      // Convertir les documents au format attendu par calculateIntegrityScore
      const documents = (app.documents || []).map((doc: any) => ({
        status: doc.status,
        trustAndSecurity: doc.aiAnalysis?.trustAndSecurity || {},
        documentMetadata: doc.aiAnalysis?.documentMetadata || {},
      }));

      const integrityScore = calculateIntegrityScore(
        documents,
        app.didit?.status as 'VERIFIED' | 'PENDING' | 'FAILED' | undefined
      );

      return {
        id: app._id.toString(),
        applyToken: app.applyToken,
        profile: app.profile,
        patrimometer: app.patrimometer,
        didit: app.didit,
        guarantor: app.guarantor,
        status: app.status,
        tunnel: app.tunnel,
        submittedAt: app.submittedAt,
        viewedByOwnerAt: app.viewedByOwnerAt,
        ownerDecision: app.ownerDecision,
        ownerNotes: app.ownerNotes,
        integrityScore, // Note d'Intégrité ajoutée
        documentsCount: app.documents?.length || 0,
        certifiedDocumentsCount: app.documents?.filter((d: any) => d.status === 'certified').length || 0,
      };
    });

    return NextResponse.json({
      property: {
        id: property._id.toString(),
        title: property.title,
        address: property.address,
      },
      candidatures: candidaturesWithIntegrity,
      total: candidaturesWithIntegrity.length,
    });
  } catch (error: any) {
    console.error('Erreur récupération candidatures:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des candidatures', details: error.message },
      { status: 500 }
    );
  }
}
