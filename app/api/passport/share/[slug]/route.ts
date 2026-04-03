import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Application from '@/models/Application';

/**
 * POST /api/passport/share/[slug]
 * Incrémente le compteur de partage
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Rate limiting : prévenir l'abus du compteur de partage
    const ip = _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(`passport-share:${ip}`, { windowMs: 60_000, max: 10 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
    }

    await connectDiditDb();
    const { slug } = await params;
    const app = await Application.findOneAndUpdate(
      { passportSlug: slug },
      { $inc: { passportShareCount: 1 } },
      { new: true }
    ).select('passportShareCount').lean();
    if (!app) {
      return NextResponse.json({ error: 'Passeport introuvable' }, { status: 404 });
    }
    return NextResponse.json({ shareCount: (app as any).passportShareCount });
  } catch (e) {
    logger.error('POST /api/passport/share/[slug]', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
