import { NextRequest, NextResponse } from 'next/server';
import { computeDossierStrategique } from '@/lib/owner-tunnel/dossier-strategique-engine';
import type { VisionAtouts } from '@/lib/owner-tunnel/schemas';

const DEFAULT_ATOUTS: VisionAtouts = {
  parquet_massif: false,
  cuisine_equipee: false,
  luminosite: false,
  balcon: false,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const zipcode = String(body?.zipcode || '').trim();
    const surface_m2 = Number(body?.surface_m2);
    const atouts: VisionAtouts = body?.atouts
      ? { ...DEFAULT_ATOUTS, ...body.atouts }
      : DEFAULT_ATOUTS;
    const context = {
      address: body?.address ?? undefined,
      furnished: body?.furnished ?? undefined,
      etiquette_dpe: body?.etiquette_dpe ?? undefined,
    };

    if (!zipcode || !Number.isFinite(surface_m2) || surface_m2 <= 0) {
      return NextResponse.json(
        { error: 'zipcode et surface_m2 requis' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    }

    const result = await computeDossierStrategique(
      zipcode,
      surface_m2,
      atouts,
      context,
      apiKey
    );

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('owner-tunnel dossier-strategique:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 }
    );
  }
}
