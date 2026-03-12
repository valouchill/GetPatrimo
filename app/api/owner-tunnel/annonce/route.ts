import { NextRequest, NextResponse } from 'next/server';

const SYSTEM = `Rédacteur d'annonces immobilières. Tu rédiges une annonce 120-180 mots en intégrant UNIQUEMENT les variables fournies.
Surface et DPE viennent du JSON DPE. Atouts viennent du JSON Vision. Prix et justification viennent du Pricing Engine.
Ne fabrique jamais de chiffres ou de caractéristiques. Utilise strictement ce qui est fourni.`;

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    const lignes = [
      'Surface: ' + (payload.surface_m2 ?? '') + ' m²',
      'DPE: ' + (payload.etiquette_energie ?? '') + ' | GES: ' + (payload.etiquette_ges ?? payload.etiquette_energie ?? ''),
      'Atouts: Parquet=' + (payload.atouts?.parquet_massif ?? false) + ' Cuisine=' + (payload.atouts?.cuisine_equipee ?? false) + ' Luminosité=' + (payload.atouts?.luminosite ?? false) + ' Balcon=' + (payload.atouts?.balcon ?? false),
      'Loyer: ' + (payload.loyer_final_euros ?? '') + ' €',
      'Justification propriétaire: ' + (payload.justification_prix ?? ''),
    ];
    if (payload.adresse) lignes.push('Adresse: ' + payload.adresse);
    if (payload.nb_pieces) lignes.push('Pièces: ' + payload.nb_pieces);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 600,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: 'Rédige l\'annonce (Le Récit) en injectant UNIQUEMENT ces données sécurisées:\n\n' + lignes.join('\n') },
        ],
      }),
    });
    if (!r.ok) return NextResponse.json({ error: 'OpenAI ' + r.status }, { status: 502 });
    const d = await r.json();
    const annonce = (d.choices?.[0]?.message?.content?.trim() as string) || '';
    return NextResponse.json({ success: true, annonce });
  } catch (e) {
    console.error('owner-tunnel annonce:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur' }, { status: 500 });
  }
}
