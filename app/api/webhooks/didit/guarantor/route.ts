import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '../../../didit/db';
import Guarantor from '@/models/Guarantor';
import Candidature from '@/models/Candidature';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  fetchDiditSessionVerification,
} = require('@/src/utils/guarantorDidit');

/**
 * Webhook Didit pour les garanties
 * Reçoit les notifications de certification Didit pour les garanties
 */
export async function POST(request: NextRequest) {
  try {
    await connectDiditDb();
    
    const body = await request.json();
    const sessionId = body.session_id || body.sessionId;

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

    const diditStatus = await fetchDiditSessionVerification(sessionId, apiKey);

    if (diditStatus?.verified) {
      // Mettre à jour le garant
      guarantor.status = 'CERTIFIED';
      guarantor.firstName = diditStatus.firstName || guarantor.firstName;
      guarantor.lastName = diditStatus.lastName || guarantor.lastName;
      guarantor.identityVerification = {
        status: 'CERTIFIEE',
        firstName: diditStatus.firstName || guarantor.firstName,
        lastName: diditStatus.lastName || guarantor.lastName,
        birthDate: diditStatus.birthDate || '',
        humanVerified: diditStatus.humanVerified || false,
        verifiedAt: new Date(),
      };
      guarantor.certifiedAt = new Date();
      await guarantor.save();

      // Mettre à jour la candidature pour indiquer qu'un garant est certifié
      if (guarantor.candidature) {
        const candidature = await Candidature.findById(guarantor.candidature);
        if (candidature) {
          candidature.hasGuarantor = true;
          candidature.guarantorType = 'PHYSIQUE';
          await candidature.save();
        }
      }

      console.log(`✅ Garant certifié: ${guarantor.email} pour candidature ${guarantor.candidature}`);
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
