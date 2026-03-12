import { NextRequest, NextResponse } from 'next/server';
import { fetchBaseMarketPrice, computePricingWithAI } from '@/lib/owner-tunnel/pricing-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const zipcode = String(body?.zipcode || '').trim();
    const surface_m2 = Number(body?.surface_m2);
    const atouts = body?.atouts;
    if (!zipcode || !Number.isFinite(surface_m2) || surface_m2 <= 0) return NextResponse.json({ error: 'zipcode et surface_m2 requis' }, { status: 400 });
    if (!atouts || typeof atouts.parquet_massif !== 'boolean' || typeof atouts.cuisine_equipee !== 'boolean') return NextResponse.json({ error: 'atouts (parquet_massif, cuisine_equipee, luminosite, balcon) requis' }, { status: 400 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    const loyerBase = await fetchBaseMarketPrice(zipcode, surface_m2);
    const result = await computePricingWithAI(loyerBase, atouts, apiKey);
    return NextResponse.json({ success: true, loyer_base_euros: loyerBase, ...result });
  } catch (e) {
    console.error('owner-tunnel pricing:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
