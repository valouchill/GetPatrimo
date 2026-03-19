import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import '@/models/Property';
// eslint-disable-next-line @typescript-eslint/no-var-requires
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
    await connectDiditDb();
    const { slug } = await params;
    const app = await Application.findOne({ passportSlug: slug })
      .populate('property', 'name address rentAmount')
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
    console.error('GET /api/passport/public/[slug]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
