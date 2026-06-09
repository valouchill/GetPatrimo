import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/server-logger';
import { connectDiditDb } from '@/app/api/didit/db';

 
const { handleOpenSignWebhook } = require('@/src/controllers/webhookController');

/**
 * POST /api/webhooks/opensign
 * Receives signature event callbacks from OpenSign.
 * No auth required (external webhook) — uses HMAC verification.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const secret = process.env.OPENSIGN_WEBHOOK_SECRET;

    // Sécurité (revue V1 — S17) : HMAC OBLIGATOIRE. Sans secret configuré, ou sans
    // signature valide, on rejette — sinon un attaquant pourrait forger un event
    // « bail signé ».
    if (!secret) {
      logger.error('[opensign-webhook] OPENSIGN_WEBHOOK_SECRET non configuré — webhook rejeté');
      return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 });
    }
    const signature = request.headers.get('x-opensign-signature') || '';
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const cmpBuf = Buffer.from(computed);
    if (sigBuf.length !== cmpBuf.length || !crypto.timingSafeEqual(sigBuf, cmpBuf)) {
      logger.warn('[opensign-webhook] Signature HMAC absente ou invalide — rejeté');
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    await connectDiditDb();

    // Adapt Next.js request to Express-style req/res for the existing controller
    const result = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
      const fakeReq = {
        body,
        headers: Object.fromEntries(request.headers.entries()),
      };
      const fakeRes = {
        status(code: number) {
          return {
            json(data: Record<string, unknown>) {
              resolve({ status: code, body: data });
            },
          };
        },
      };
      handleOpenSignWebhook(fakeReq, fakeRes);
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('[opensign-webhook] Error', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
