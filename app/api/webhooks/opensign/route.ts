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

    // HMAC signature verification (if configured)
    if (secret) {
      const signature = request.headers.get('x-opensign-signature');
      if (signature) {
        const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        const valid = crypto.timingSafeEqual(
          Buffer.from(computed),
          Buffer.from(signature)
        );
        if (!valid) {
          logger.warn('[opensign-webhook] Invalid HMAC signature');
          return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
        }
      }
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
