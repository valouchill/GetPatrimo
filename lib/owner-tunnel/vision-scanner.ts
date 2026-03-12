import type { VisionAtouts } from './schemas';

/** Taxonomie stricte Vision — Uniquement des booléens, zéro description textuelle */
const VISION_SCHEMA = {
  type: 'object' as const,
  properties: {
    parquet_massif: { type: 'boolean', description: 'Parquet ancien, point de Hongrie ou massif visible' },
    cuisine_equipee: { type: 'boolean', description: 'Cuisine équipée ou îlot central visible' },
    luminosite: { type: 'boolean', description: 'Pièce lumineuse, grandes baies ou orientation favorable' },
    balcon: { type: 'boolean', description: 'Balcon ou terrasse visible' },
  },
  required: ['parquet_massif', 'cuisine_equipee', 'luminosite', 'balcon'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Tu es un inspecteur immobilier. Analyse cette image et retourne un JSON strict indiquant true ou false pour les clés suivantes : parquet_massif, cuisine_equipee, luminosite, balcon.
NE demande JAMAIS de description textuelle. Uniquement des booléens.`;

export async function scanVision(images: string[], apiKey: string): Promise<VisionAtouts> {
  const imageContents = images.slice(0, 5).map((u) => ({
    type: 'image_url' as const,
    image_url: { url: u.startsWith('data:') ? u : 'data:image/jpeg;base64,' + u },
  }));
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 200,
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'audit_visuel_souverain', strict: true, schema: VISION_SCHEMA },
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: [{ type: 'text', text: 'Analyse cette image.' }, ...imageContents] },
      ],
    }),
  });
  if (!r.ok) throw new Error('OpenAI ' + r.status);
  const d = await r.json();
  const raw = d.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Reponse vide');
  return JSON.parse(raw) as VisionAtouts;
}
