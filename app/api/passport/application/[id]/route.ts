import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import crypto from 'crypto';

/**
 * GET /api/passport/application/[id]
 * Retourne ou crée le slug du passeport + stats (pour la page success)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDiditDb();
    const { id } = await params;
    const app = await Application.findById(id)
      .select('profile.firstName patrimometer.grade patrimometer.score passportSlug passportViewCount passportShareCount passportLastViewedAt')
      .lean();
    if (!app) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }
    const profile = (app as any).profile || {};
    const patrimometer = (app as any).patrimometer || {};
    const firstName = profile.firstName || '';
    let slug = (app as any).passportSlug;
    if (!slug) {
      const safeName = (firstName || 'dossier').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 12);
      const suffix = crypto.randomBytes(4).toString('hex');
      slug = safeName + '-' + suffix;
      await Application.findByIdAndUpdate(id, { passportSlug: slug });
    }
    // URL absolue obligatoire pour que le QR code fonctionne au scan
    const host = request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 
      (host ? `${proto === 'https' ? 'https' : 'http'}://${host}` : '') || 
      'https://doc2loc.com';
    const shareUrl = `${baseUrl.replace(/\/$/, '')}/p/${slug}`;
    return NextResponse.json({
      slug,
      shareUrl,
      viewCount: (app as any).passportViewCount ?? 0,
      shareCount: (app as any).passportShareCount ?? 0,
      lastViewedAt: (app as any).passportLastViewedAt ?? null,
      grade: patrimometer.grade || '',
      score: patrimometer.score ?? 98,
      firstName,
    });
  } catch (e) {
    console.error('GET /api/passport/application/[id]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
