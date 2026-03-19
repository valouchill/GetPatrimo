import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import '@/models/Property';
import { notifyPassportViewed } from '@/app/actions/share-passport';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildPassportViewModel } = require('@/src/utils/passportViewModel');

/**
 * GET /api/verify/[token]
 * Alias legacy vers les donnees publiques du passeport
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDiditDb();
    const { token } = await params;

    const app = await Application.findOne({ passportSlug: token })
      .populate('property', 'name address rentAmount')
      .lean();

    if (!app) {
      return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });
    }

    const shouldTrack = request.nextUrl.searchParams.get('track') !== 'false';
    if (shouldTrack) {
      await Application.findByIdAndUpdate((app as any)._id, {
        $inc: { passportViewCount: 1 },
        passportLastViewedAt: new Date(),
      });
      notifyPassportViewed((app as any)._id.toString()).catch(console.error);
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
      slug: token,
    });

    return NextResponse.json(passport);
  } catch (error) {
    console.error('GET /api/verify/[token]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
