import { NextRequest, NextResponse } from 'next/server';
import { generateAnnonce } from '../../../../lib/owner-tunnel/annonce-generator';

export async function POST(request: NextRequest) {
  try {
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
    console.error('owner-tunnel generate-annonce:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
