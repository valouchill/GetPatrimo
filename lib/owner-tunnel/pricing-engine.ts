import type { VisionAtouts } from './schemas';
import type { PricingResult } from './schemas';

/** Tarifs €/m² médians par préfixe postal (données indicatives marché locatif 2024) */
const PRIX_M2_PAR_ZONE: Record<string, number> = {
  '75': 28, // Paris
  '92': 18, '93': 14, '94': 17, // Petite couronne
  '69': 13, '59': 11, '13': 12, '31': 11, '33': 12, // Grandes métropoles
  '44': 10, '67': 11, '34': 11, '35': 11,
};

/**
 * Récupère le loyer médian de base (€) pour une surface et un code postal.
 * Peut être branché sur une API/DB (DVF, Bien'ici, etc.) via env PRICING_API_URL.
 */
export async function fetchBaseMarketPrice(zipcode: string, surfaceM2: number): Promise<number> {
  const apiUrl = process.env.PRICING_API_URL;
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl + '?zipcode=' + encodeURIComponent(zipcode) + '&surface=' + surfaceM2, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const rent = Number(data.loyer_mediane ?? data.median_rent ?? data.prix ?? data.price);
        if (Number.isFinite(rent)) return Math.round(rent);
      }
    } catch {
      /* fallback local */
    }
  }
  const prefix = String(zipcode).slice(0, 2);
  const prixM2 = PRIX_M2_PAR_ZONE[prefix] ?? 12;
  return Math.round(prixM2 * surfaceM2);
}

const PRICING_SCHEMA = {
  type: 'object' as const,
  properties: {
    loyer_final_euros: { type: 'number', description: 'Loyer final en euros après surcote prestige' },
    justification_paragraphe: { type: 'string', description: 'Justification en 3 lignes pour le propriétaire' },
  },
  required: ['loyer_final_euros', 'justification_paragraphe'],
  additionalProperties: false,
};

/**
 * Calcule le loyer final avec surcote prestige (5–10%) via IA.
 * Structured output pour éliminer les hallucinations.
 */
export async function computePricingWithAI(
  loyerBaseEuros: number,
  atouts: VisionAtouts,
  apiKey: string
): Promise<PricingResult> {
  const atoutsStr = JSON.stringify(atouts);
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 400,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'pricing_result', strict: true, schema: PRICING_SCHEMA },
      },
      messages: [
        {
          role: 'system',
          content:
            'Tu es un expert en valorisation locative. Le loyer marché de base est fourni. Applique une surcote de prestige de 5 à 10% selon les atouts visuels (Parquet, Cuisine, Luminosité, Balcon). Retourne le loyer final calculé et rédige un paragraphe de justification de 3 lignes pour le propriétaire.',
        },
        {
          role: 'user',
          content: `Loyer marché de base: ${loyerBaseEuros} €. Atouts: ${atoutsStr}. Applique surcote prestige 5-10%. Retourne loyer final et justification 3 lignes.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error('OpenAI ' + res.status);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Reponse vide');
  const out = JSON.parse(raw) as { loyer_final_euros: number; justification_paragraphe: string };
  return {
    loyer_final_euros: Number(out.loyer_final_euros) || loyerBaseEuros,
    justification_paragraphe: String(out.justification_paragraphe || '').slice(0, 500),
  };
}
