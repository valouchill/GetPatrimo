import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../../didit/db';
import Guarantor from '@/models/Guarantor';
import { auditGuarantorIdentity } from '@/app/actions/audit-identity';

/**
 * API Route pour l'audit d'identité du garant
 * Fallback quand Didit n'est pas disponible
 */
export async function POST(request: NextRequest) {
  try {
    await connectDiditDb();
    
    const body = await request.json();
    const { invitationToken, documents } = body;
    
    if (!invitationToken) {
      return NextResponse.json(
        { error: 'Token d\'invitation requis' },
        { status: 400 }
      );
    }
    
    if (!documents || !Array.isArray(documents) || documents.length < 2) {
      return NextResponse.json(
        { error: 'Au moins 2 documents sont requis pour l\'audit' },
        { status: 400 }
      );
    }
    
    // Récupérer le garant
    const guarantor = await Guarantor.findOne({ invitationToken });
    
    if (!guarantor) {
      return NextResponse.json(
        { error: 'Garant introuvable' },
        { status: 404 }
      );
    }
    
    // Si déjà certifié, retourner le statut
    if (guarantor.status === 'CERTIFIED') {
      return NextResponse.json({
        success: true,
        verificationLevel: 'VERIFIED_AUDIT',
        score: 100,
        badge: 'Déjà certifié',
        expertAdvice: 'Votre identité a déjà été certifiée.',
        patrimometerPoints: 0,
        alreadyCertified: true
      });
    }
    
    // Lancer l'audit d'identité
    const auditResult = await auditGuarantorIdentity(
      guarantor._id.toString(),
      documents
    );
    
    // Mettre à jour le garant si l'audit est réussi
    if (auditResult.success && auditResult.verificationLevel === 'VERIFIED_AUDIT') {
      guarantor.status = 'CERTIFIED';
      guarantor.certifiedAt = new Date();
      guarantor.identityVerification = {
        status: 'CERTIFIEE',
        firstName: auditResult.identity?.firstName || '',
        lastName: auditResult.identity?.lastName || '',
        birthDate: auditResult.identity?.birthDate || '',
        humanVerified: false, // Audit automatique, pas de vérification humaine Didit
        verifiedAt: new Date()
      };
      
      // Stocker les détails de l'audit
      (guarantor as Record<string, unknown>).auditDetails = {
        method: 'AUDIT_PATRIMOTRUST',
        score: auditResult.score,
        checks: auditResult.checks,
        patrimometerPoints: auditResult.patrimometerPoints,
        completedAt: new Date()
      };
      
      await guarantor.save();
      
      console.log(`✅ Garant ${guarantor.email} certifié par Audit PatrimoTrust`);
    }
    
    return NextResponse.json({
      success: auditResult.success,
      verificationLevel: auditResult.verificationLevel,
      score: auditResult.score,
      badge: auditResult.badge,
      expertAdvice: auditResult.expertAdvice,
      patrimometerPoints: auditResult.patrimometerPoints,
      requiresManualReview: auditResult.requiresManualReview,
      checks: {
        mrzValidation: auditResult.checks.mrzValidation.performed ? {
          valid: auditResult.checks.mrzValidation.valid,
          score: auditResult.checks.mrzValidation.score
        } : null,
        nameConsistency: auditResult.checks.nameConsistency.performed ? {
          valid: auditResult.checks.nameConsistency.valid,
          matchingDocuments: auditResult.checks.nameConsistency.matchingDocuments
        } : null,
        doc2DValidation: auditResult.checks.doc2DValidation.performed ? {
          valid: auditResult.checks.doc2DValidation.valid,
          authenticatedBy: auditResult.checks.doc2DValidation.authenticatedBy
        } : null
      },
      identity: auditResult.identity
    });
    
  } catch (error) {
    console.error('Erreur audit garant:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erreur lors de l\'audit',
        success: false 
      },
      { status: 500 }
    );
  }
}
