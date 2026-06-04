import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Application from '@/models/Application';
import '@/models/Property';
 
const { buildPassportViewModel } = require('@/src/utils/passportViewModel');

/**
 * GET /api/passport/public/[slug]
 * Données publiques riches du passeport + tracking optionnel
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Rate limiting : 60 req/min par IP pour prévenir l'énumération de slugs
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(`passport-public:${ip}`, { windowMs: 60_000, max: 60 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 });
    }

    await connectDiditDb();
    const { slug } = await params;
    const app = await Application.findOne({ passportSlug: slug })
      .populate('property', 'name address rentAmount')
      .populate('guarantor.guarantorId', 'firstName lastName identityVerification')
      .lean();
    if (!app) {
      return NextResponse.json({ error: 'Passeport introuvable' }, { status: 404 });
    }
    const shouldTrack = request.nextUrl.searchParams.get('track') !== 'false';
    if (shouldTrack) {
      await Application.findByIdAndUpdate((app as any)._id, {
        $inc: { passportViewCount: 1 },
        passportLastViewedAt: new Date(),
      });
    }

    const host = request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL ||
      (host ? `${proto === 'https' ? 'https' : 'http'}://${host}` : '') ||
      'https://doc2loc.com';
    const passport = buildPassportViewModel({
      application: shouldTrack
        ? { ...(app as any), passportViewCount: Number((app as any).passportViewCount || 0) + 1, passportLastViewedAt: new Date() }
        : app as any,
      audience: 'public',
      baseUrl,
      slug,
    });

    return NextResponse.json(passport);
  } catch (e) {
    logger.error('GET /api/passport/public/[slug]', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
