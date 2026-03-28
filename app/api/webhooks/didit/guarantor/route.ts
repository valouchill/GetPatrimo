import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { connectDiditDb } from '../../../didit/db';
import Guarantor from '@/models/Guarantor';
import Candidature from '@/models/Candidature';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  fetchDiditSessionVerification,
} = require('@/src/utils/guarantorDidit');

/**
 * Verification de la signature HMAC-SHA256 du webhook Didit.
 * Empeche un attaquant de forger des requetes de certification.
 */
function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Webhook Didit pour les garanties
 * Recoit les notifications de certification Didit pour les garanties
 * La signature HMAC est verifiee avant tout traitement.
 */
export async function POST(request: NextRequest) {
  try {
    // Lire le body brut AVANT de le parser en JSON (necessaire pour la verification HMAC)
    const rawBody = await request.text();

    // Recuperer la signature depuis les headers (deux noms possibles en fallback)
    const signature =
      request.headers.get('x-signature') ||
      request.headers.get('x-webhook-signature');

    const webhookSecret = process.env.DIDIT_CLIENT_SECRET;

    if (!webhookSecret) {
      console.error('[didit-webhook] DIDIT_CLIENT_SECRET non configure');
      return NextResponse.json(
        { error: 'Configuration webhook invalide.' },
        { status: 500 }
      );
    }

    // Verifier la signature HMAC-SHA256 — rejeter si absente ou invalide
    if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('[didit-webhook] Signature invalide ou absente');
      return NextResponse.json(
        { error: 'Signature invalide.' },
        { status: 401 }
      );
    }

    // Parser le body apres verification de la signature
    const body = JSON.parse(rawBody);

    await connectDiditDb();

    const sessionId = body.session_id || body.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 });
    }

    // Trouver le garant par sa session Didit
    const guarantor = await Guarantor.findOne({ diditSessionId: sessionId });

    if (!guarantor) {
      return NextResponse.json({ received: true });
    }

    // Verifier le statut de la session Didit
    const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
    if (!apiKey) {
      console.error('[didit-webhook] DIDIT_API_KEY non configure');
      return NextResponse.json({ received: true });
    }

    const diditStatus = await fetchDiditSessionVerification(sessionId, apiKey);

    if (diditStatus?.verified) {
      // Mettre a jour le garant
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

      // Mettre a jour la candidature pour indiquer qu'un garant est certifie
      if (guarantor.candidature) {
        const candidature = await Candidature.findById(guarantor.candidature);
        if (candidature) {
          candidature.hasGuarantor = true;
          candidature.guarantorType = 'PHYSIQUE';
          await candidature.save();
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[didit-webhook] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
