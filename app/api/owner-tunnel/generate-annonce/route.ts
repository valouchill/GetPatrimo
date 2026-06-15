import { NextRequest, NextResponse } from 'next/server';
import { generateAnnonce } from '../../../../lib/owner-tunnel/annonce-generator';
import { logger } from '@/lib/server-logger';
import { guardOwnerTunnel } from '@/lib/owner-tunnel-guard';

export async function POST(request: NextRequest) {
  try {
    const guard = await guardOwnerTunnel(request);
    if (!guard.ok) return guard.response;
    const payload = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    if (!payload?.surface_m2 || !payload?.etiquette_energie || !payload?.atouts || payload?.loyer_final_euros == null)
      return NextResponse.json({ error: 'surface_m2, etiquette_energie, atouts, loyer_final_euros requis' }, { status: 400 });
    const annonce = await generateAnnonce(
      { ...payload, justification_prix: payload.justification_prix || '' },
      apiKey
    );
    return NextResponse.json({ success: true, annonce });
  } catch (e) {
    logger.error('owner-tunnel generate-annonce', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Une erreur est survenue. Réessayez.' }, { status: 500 });
  }
}
