import type { DPEResult } from './schemas';

/** Schéma JSON strict pour extraction DPE — Zéro hallucination */
const DPE_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    surface_habitable_m2: {
      type: ['number', 'null'],
      description: 'Surface habitable exacte en m². Renvoyer null si introuvable ou incertain. Ne jamais deviner.',
    },
    etiquette_energie: {
      type: 'string',
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      description: 'Note globale performance énergétique (A=excellent, G=très mauvais)',
    },
    etiquette_ges: {
      type: 'string',
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      description: 'Note émissions GES (kg CO2/m²/an)',
    },
    estimation_cout_annuel: {
      type: ['number', 'null'],
      description: 'Coût annuel énergie en euros. Null si non spécifié.',
    },
  },
  required: ['surface_habitable_m2', 'etiquette_energie', 'etiquette_ges', 'estimation_cout_annuel'],
  additionalProperties: false,
};

const SYSTEM = `Expert extraction DPE français. RÈGLE CRITIQUE: Si la surface habitable n'est pas clairement lisible ou si tu as le moindre doute, tu DOIS retourner null pour surface_habitable_m2. Ne devine jamais une valeur. L'utilisateur confirmera manuellement.`;

export interface ScanDPEInput {
  buffer: ArrayBuffer;
  mimeType: string;
  isPdf: boolean;
  pdfText?: string;
}

export async function scanDPE(input: ScanDPEInput, apiKey: string): Promise<DPEResult> {
  const dataUrl = 'data:' + input.mimeType + ';base64,' + Buffer.from(input.buffer).toString('base64');
  const userContent = input.isPdf
    ? 'Extrais DPE du texte:\n\n' + (input.pdfText || '').slice(0, 8000)
    : [
        { type: 'text', text: 'Extrais DPE de cette image. Surface null si incertaine.' },
        { type: 'image_url', image_url: { url: dataUrl } },
      ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 500,
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: { name: 'extraction_dpe', strict: true, schema: DPE_JSON_SCHEMA } },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) throw new Error('OpenAI ' + res.status);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Reponse vide');
  return JSON.parse(raw) as DPEResult;
}
