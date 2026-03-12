import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
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
    console.error('POST /api/passport/share/[slug]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
