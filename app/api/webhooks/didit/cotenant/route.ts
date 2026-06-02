import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { connectDiditDb } from '../../../didit/db';
import { logger } from '@/lib/server-logger';
import CoTenant from '@/models/CoTenant';
import { syncCoTenantCertification } from '@/lib/cotenant-sync';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fetchDiditSessionVerification } = require('@/src/utils/guarantorDidit');

/** Vérification HMAC-SHA256 de la signature du webhook Didit. */
function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (sigBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Webhook Didit pour les COLOCATAIRES.
 *
 * Clone du webhook garant, MAIS ferme la boucle vers l'Application : quand un
 * colocataire certifie son identité, on met à jour son miroir
 * `application.coTenants[slot]` PUIS on recalcule le score du foyer
 * (recomputeApplicationScore). Le flux garant ne re-synchronisait jamais.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get('x-signature') || request.headers.get('x-webhook-signature');
    const webhookSecret = process.env.DIDIT_CLIENT_SECRET;

    if (!webhookSecret) {
      logger.error('[didit-cotenant-webhook] DIDIT_CLIENT_SECRET non configuré');
      return NextResponse.json({ error: 'Configuration webhook invalide.' }, { status: 500 });
    }
    if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.error('[didit-cotenant-webhook] Signature invalide ou absente');
      return NextResponse.json({ error: 'Signature invalide.' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    await connectDiditDb();

    const sessionId = body.session_id || body.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 });
    }

    const coTenant = await CoTenant.findOne({ diditSessionId: sessionId });
    if (!coTenant) {
      return NextResponse.json({ received: true });
    }

    const apiKey = process.env.DIDIT_API_KEY || process.env.DIDIT_CLIENT_SECRET;
    if (!apiKey) {
      logger.error('[didit-cotenant-webhook] DIDIT_API_KEY non configuré');
      return NextResponse.json({ received: true });
    }

    const diditStatus = await fetchDiditSessionVerification(sessionId, apiKey);

    if (diditStatus?.verified) {
      coTenant.status = 'CERTIFIED';
      coTenant.firstName = diditStatus.firstName || coTenant.firstName;
      coTenant.lastName = diditStatus.lastName || coTenant.lastName;
      coTenant.identityVerification = {
        status: 'CERTIFIEE',
        firstName: diditStatus.firstName || coTenant.firstName,
        lastName: diditStatus.lastName || coTenant.lastName,
        birthDate: diditStatus.birthDate || '',
        humanVerified: diditStatus.humanVerified || false,
        verifiedAt: new Date(),
      };
      coTenant.certifiedAt = new Date();
      await coTenant.save();

      // Re-sync vers l'Application : maj miroir coTenants[slot] + recalcul du
      // score foyer. Source unique partagée avec la route status (robuste).
      await syncCoTenantCertification(coTenant, {
        firstName: diditStatus.firstName,
        lastName: diditStatus.lastName,
        birthDate: diditStatus.birthDate,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('[didit-cotenant-webhook] Erreur', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
