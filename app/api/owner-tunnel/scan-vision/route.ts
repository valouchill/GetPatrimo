import { NextRequest, NextResponse } from 'next/server';
import { scanVision } from '@/lib/owner-tunnel/vision-scanner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const images = Array.isArray(body?.images) ? (body.images as string[]) : [];
    if (images.length === 0) return NextResponse.json({ error: 'Aucune image' }, { status: 400 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    const atouts = await scanVision(images, apiKey);
    return NextResponse.json({ success: true, atouts });
  } catch (e) {
    console.error('owner-tunnel scan-vision:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
