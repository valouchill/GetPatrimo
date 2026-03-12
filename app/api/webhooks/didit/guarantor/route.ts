import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../../../didit/db';
import Guarantor from '@/models/Guarantor';
import Candidature from '@/models/Candidature';

/**
 * Webhook Didit pour les garanties
 * Reçoit les notifications de certification Didit pour les garanties
 */
export async function POST(request: NextRequest) {
  try {
    await connectDiditDb();
    
    const body = await request.json();
    const sessionId = body.session_id || body.sessionId;
    const reference = body.reference || '';

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 });
    }

    // Trouver le garant par sa session Didit
    const guarantor = await Guarantor.findOne({ diditSessionId: sessionId });
    
    if (!guarantor) {
      console.warn(`Garant non trouvé pour session Didit: ${sessionId}`);
      return NextResponse.json({ received: true });
    }

    // Vérifier le statut de la session Didit
    const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
    if (!apiKey) {
      console.warn('DIDIT_API_KEY non configuré');
      return NextResponse.json({ received: true });
    }
    
    const statusResponse = await fetch(
      `https://verification.didit.me/v2/session/${sessionId}`,
      {
        headers: {
          'x-api-key': apiKey,
        },
      }
    );

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      
      if (statusData.status === 'VERIFIED' || statusData.verified === true) {
        // Mettre à jour le garant
        guarantor.status = 'CERTIFIED';
        guarantor.identityVerification = {
          status: 'CERTIFIEE',
          firstName: statusData.first_name || statusData.firstName || guarantor.firstName,
          lastName: statusData.last_name || statusData.lastName || guarantor.lastName,
          birthDate: statusData.birth_date || statusData.birthDate || '',
          humanVerified: statusData.human_verified || statusData.humanVerified || false,
          verifiedAt: new Date(),
        };
        guarantor.certifiedAt = new Date();
        await guarantor.save();

        // Mettre à jour la candidature pour indiquer qu'un garant est certifié
        const candidature = await Candidature.findById(guarantor.candidature);
        if (candidature) {
          candidature.hasGuarantor = true;
          candidature.guarantorType = 'PHYSIQUE';
          await candidature.save();
        }

        console.log(`✅ Garant certifié: ${guarantor.email} pour candidature ${guarantor.candidature}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erreur webhook Didit garant:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
