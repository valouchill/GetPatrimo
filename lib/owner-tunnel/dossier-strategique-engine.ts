import type { VisionAtouts } from './schemas';
import { fetchBaseMarketPrice } from './pricing-engine';

export interface PrimeValorisation {
  raison: string;
  montant: number;
}

export interface DossierStrategiqueResult {
  loyer_base: number;
  loyer_recommande: number;
  primes_valorisation: PrimeValorisation[];
  profil_cible_titre: string;
  profil_cible_explication: string;
  note_synthese: string;
}

const DOSSIER_SCHEMA = {
  type: 'object' as const,
  properties: {
    primes_valorisation: {
      type: 'array',
      items: {
        type: 'object',
        properties: { raison: { type: 'string' }, montant: { type: 'number' } },
        required: ['raison', 'montant'],
        additionalProperties: false,
      },
      description: 'Liste des primes de valorisation (ex: Prime Prestations Premium +80)',
    },
    loyer_recommande: { type: 'number', description: 'Loyer final recommandé en euros' },
    profil_cible_titre: { type: 'string', description: "Titre du profil cible (ex: Jeunes Actifs Premium)" },
    profil_cible_explication: {
      type: 'string',
      description: "Explication de pourquoi ce profil est attiré par ce loyer et ces prestations",
    },
    note_synthese: {
      type: 'string',
      description: 'Note de synthèse justificative pour le propriétaire (3-4 phrases)',
    },
  },
  required: ['primes_valorisation', 'loyer_recommande', 'profil_cible_titre', 'profil_cible_explication', 'note_synthese'],
  additionalProperties: false,
};

export async function computeDossierStrategique(
  zipcode: string,
  surfaceM2: number,
  atouts: VisionAtouts,
  context: { address?: string; furnished?: boolean; etiquette_dpe?: string },
  apiKey: string
): Promise<DossierStrategiqueResult> {
  const loyerBase = await fetchBaseMarketPrice(zipcode, surfaceM2);
  const atoutsStr = JSON.stringify(atouts);
  const ctxStr = JSON.stringify(context);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 800,
      temperature: 0.25,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'dossier_strategique', strict: true, schema: DOSSIER_SCHEMA },
      },
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en valorisation locative et stratégie de ciblage locataire.
Le loyer de base marché est fourni. Tu dois:
1. Décomposer la valorisation en 2-5 primes (ex: Prime Prestations Premium +80€, Prime Luminosité +40€).
2. Le loyer recommandé = loyer_base + somme des montants des primes (montants positifs).
3. Identifier le profil locataire idéal (ex: Jeunes Actifs Premium, Cadres Expatriés, Familles Urbaines).
4. Expliquer pourquoi ce profil est attiré par ce loyer et ces prestations.
5. Rédiger une note de synthèse rassurante pour le propriétaire.`,
        },
        {
          role: 'user',
          content: `Loyer base marché: ${loyerBase} €. Surface: ${surfaceM2}m². Code postal: ${zipcode}.
Atouts: ${atoutsStr}.
Contexte: ${ctxStr}
Génère le JSON avec primes_valorisation (raison + montant en euros), loyer_recommande, profil_cible_titre, profil_cible_explication, note_synthese.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error('OpenAI ' + res.status);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Reponse vide');

  const out = JSON.parse(raw) as {
    primes_valorisation: PrimeValorisation[];
    loyer_recommande: number;
    profil_cible_titre: string;
    profil_cible_explication: string;
    note_synthese: string;
  };

  const primes = Array.isArray(out.primes_valorisation) ? out.primes_valorisation : [];
  const loyerRecommande = Number(out.loyer_recommande) || loyerBase;

  return {
    loyer_base: loyerBase,
    loyer_recommande: loyerRecommande,
    primes_valorisation: primes,
    profil_cible_titre: String(out.profil_cible_titre || 'Profil Premium').slice(0, 80),
    profil_cible_explication: String(out.profil_cible_explication || '').slice(0, 600),
    note_synthese: String(out.note_synthese || '').slice(0, 600),
  };
}
