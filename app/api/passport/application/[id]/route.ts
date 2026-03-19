import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import '@/models/Property';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildPassportViewModel, ensurePassportSlug } = require('@/src/utils/passportViewModel');

/**
 * GET /api/passport/application/[id]
 * Retourne le view-model complet du passeport candidat
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDiditDb();
    const { id } = await params;
    const app = await Application.findById(id)
      .populate('property', 'name address rentAmount')
      .lean();
    if (!app) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }
    let slug = (app as any).passportSlug;
    if (!slug) {
      slug = ensurePassportSlug(app);
      await Application.findByIdAndUpdate(id, { passportSlug: slug });
    }
    const host = request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL ||
      (host ? `${proto === 'https' ? 'https' : 'http'}://${host}` : '') ||
      'https://doc2loc.com';
    const passport = buildPassportViewModel({
      application: { ...(app as any), passportSlug: slug },
      audience: 'candidate',
      baseUrl,
      slug,
    });

    return NextResponse.json({
      ...passport,
      lastViewedAt: (app as any).passportLastViewedAt ?? null,
    });
  } catch (e) {
    console.error('GET /api/passport/application/[id]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
