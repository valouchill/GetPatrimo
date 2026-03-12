import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../../didit/db';
import Guarantor from '@/models/Guarantor';
import Property from '@/models/Property';

/**
 * Crée une session Didit pour un garant
 * Utilise la même logique que la session locataire mais enregistre dans Guarantor
 */
export async function POST(request: NextRequest) {
  // Lire le body une seule fois au début
  let body: { invitationToken?: string; applyToken?: string; email?: string; firstName?: string; lastName?: string };
  try {
    body = await request.json();
    console.log('[GUARANTOR CREATE-SESSION] Body reçu:', JSON.stringify(body));
  } catch (parseError) {
    console.error('[GUARANTOR CREATE-SESSION] Erreur parsing JSON:', parseError);
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  try {
    await connectDiditDb();
    // Accepter candidatureId comme alias de applyToken pour compatibilité
    const { invitationToken, applyToken, candidatureId, email, firstName, lastName } = body as { 
      invitationToken?: string; 
      applyToken?: string; 
      candidatureId?: string;
      email?: string; 
      firstName?: string; 
      lastName?: string 
    };
    const effectiveApplyToken = applyToken || candidatureId;
    console.log('[GUARANTOR CREATE-SESSION] invitationToken:', invitationToken, 'applyToken:', effectiveApplyToken);

    // Si invitationToken, chercher le garant existant
    // Sinon, créer un nouveau garant pour l'option "En Direct"
    let guarantor;
    
    if (invitationToken) {
      guarantor = await Guarantor.findOne({ invitationToken });
      if (!guarantor) {
        return NextResponse.json(
          { error: 'Garant introuvable ou token invalide' },
          { status: 404 }
        );
      }
    } else if (effectiveApplyToken && email) {
      // Option "En Direct" : créer ou trouver le garant pour cette Property
      const crypto = await import('crypto');
      const invitationTokenNew = crypto.randomBytes(32).toString('hex');
      
      // Trouver la Property
      const property = await Property.findOne({ applyToken: effectiveApplyToken });
      if (!property) {
        return NextResponse.json(
          { error: 'Bien immobilier introuvable' },
          { status: 404 }
        );
      }
      
      guarantor = await Guarantor.findOne({ 
        applyToken: effectiveApplyToken,
        email: email.toLowerCase()
      });
      
      if (!guarantor) {
        guarantor = new Guarantor({
          property: property._id,
          applyToken: effectiveApplyToken,
          email: email.toLowerCase(),
          firstName: firstName || '',
          lastName: lastName || '',
          status: 'PENDING',
          invitationToken: invitationTokenNew,
          isDirectCertification: true,
        });
        await guarantor.save();
      }
    } else {
      return NextResponse.json(
        { error: 'Token d\'invitation ou applyToken/candidatureId + email requis' },
        { status: 400 }
      );
    }

    // Créer une session Didit pour le garant
    const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
    const workflowId = process.env.DIDIT_WORKFLOW_ID || process.env.DIDIT_CLIENT_ID;
    const webhookUrl = process.env.DIDIT_WEBHOOK_URL || `${request.nextUrl.origin}/api/webhooks/didit/guarantor`;

    if (!apiKey || !workflowId) {
      return NextResponse.json({
        sessionId: null,
        verificationUrl: null,
        fallbackMode: true,
        message: 'Vérification Didit non disponible.'
      });
    }

    // Récupérer le token du garant
    const guarantorToken = guarantor.invitationToken || invitationToken;
    
    // Appeler l'API Didit pour créer une session
    const diditResponse = await fetch('https://verification.didit.me/v2/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        reference: `guarantor-${guarantor._id}`,
        redirect_url: `${request.nextUrl.origin}/verify-guarantor/${guarantorToken}?didit_callback=1`,
        webhook_url: webhookUrl,
      }),
    });

    if (!diditResponse.ok) {
      const errorData = await diditResponse.json().catch(() => ({}));
      console.error('Erreur création session Didit garant:', errorData);
      return NextResponse.json(
        { error: 'Erreur lors de la création de la session Didit' },
        { status: 500 }
      );
    }

    const diditData = await diditResponse.json();
    const sessionId = diditData.session_id || diditData.id;

    // Enregistrer la session Didit dans le garant
    guarantor.diditSessionId = sessionId;
    await guarantor.save();

    return NextResponse.json({
      sessionId,
      verificationUrl: diditData.verification_url || diditData.url,
      qrCode: diditData.qr_code,
      fallbackMode: false,
    });
  } catch (error) {
    console.error('Erreur création session garant:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
