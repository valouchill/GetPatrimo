import type { AnnoncePayload } from './schemas';

const SYSTEM = 'Redacteur annonces immobilières. Donnees secures (surface, DPE, atouts, prix). Une annonce 120-180 mots avec uniquement ces donnees.';

export async function generateAnnonce(payload: AnnoncePayload, apiKey: string): Promise<string> {
  const lignes = [
    'Surface: ' + payload.surface_m2 + ' m2',
    'DPE: ' + payload.etiquette_energie + ' GES: ' + payload.etiquette_ges,
    'Parquet: ' + payload.atouts.parquet_massif + ' Cuisine: ' + payload.atouts.cuisine_equipee + ' Luminosite: ' + payload.atouts.luminosite + ' Balcon: ' + payload.atouts.balcon,
    'Loyer: ' + payload.loyer_final_euros,
    'Justification: ' + payload.justification_prix,
    payload.adresse ? 'Adresse: ' + payload.adresse : '',
    payload.nb_pieces ? 'Pieces: ' + payload.nb_pieces : '',
  ].filter(Boolean);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: 'Redige annonce:\n\n' + lignes.join('\n') },
      ],
    }),
  });
  if (!res.ok) throw new Error('OpenAI ' + res.status);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content?.trim() as string) || '';
}
