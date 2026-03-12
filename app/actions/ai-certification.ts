'use server';

/**
 * Server Action pour l'analyse et certification de documents avec GPT-4o Vision
 * Système anti-fraude adaptatif pour GetPatrimo
 */

interface DocumentAnalysisResult {
  documentType: string;
  extractedData: {
    nom?: string;
    prenom?: string;
    montants?: number[];
    dates?: string[];
    autres?: Record<string, any>;
  };
  confidenceScore: number; // 0-100
  recommendations: string[];
  fraudIndicators?: {
    suspicious: boolean;
    reasons: string[];
  };
  personaMatch?: {
    matches: boolean;
    expectedProfile: string;
    detectedProfile: string;
  };
}

/**
 * Convertit un File/Blob en base64
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  
  let mimeType = 'application/pdf';
  if (file.type.includes('image/png')) mimeType = 'image/png';
  if (file.type.includes('image/jpeg') || file.type.includes('image/jpg')) mimeType = 'image/jpeg';
  
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Prompt système pour l'analyse de documents locatifs
 */
function getAnalysisPrompt(candidateStatus?: string): string {
  const personaContext = candidateStatus 
    ? `\n\nCONTEXTE CANDIDAT: Le candidat a déclaré être "${candidateStatus}". Vérifie la cohérence entre le profil déclaré et les documents fournis.`
    : '';

  return `Tu es un expert en audit de documents locatifs pour GetPatrimo, une plateforme Wealth-Tech de gestion locative sécurisée par IA.

MISSION:
1. Identifie précisément le type de document (CNI/Passeport, Bulletin de salaire, Avis de bourse CROUS, Attestation CAF/APL, Justificatif de pension alimentaire, Contrat de travail, Certificat de scolarité, etc.)

2. Extrais les données clés:
   - Pour CNI/Passeport: Nom, Prénom, Date de naissance, Numéro
   - Pour Bulletins: Nom, Prénom, Salaire net, Dates, Employeur
   - Pour Bourses: Montant mensuel, Période, Organisme (CROUS)
   - Pour CAF: Montant APL/ALS, Période, Numéro allocataire
   - Pour Pension: Montant, Période, Donneur d'ordre
   - Pour Contrat: Type (CDI/CDD), Salaire brut, Dates, Employeur

3. Détecte les incohérences ou signes de falsification:
   - Pixels suspects, retouches visibles
   - Montants incohérents entre documents
   - Dates qui ne correspondent pas
   - Typographie suspecte
   - Qualité d'image anormale (scans de scans)
   - Incohérences entre le profil déclaré et les documents

4. Évalue la confiance (0-100):
   - 90-100: Document authentique, parfaitement lisible
   - 70-89: Document probablement authentique, quelques doutes mineurs
   - 50-69: Document suspect, nécessite vérification manuelle
   - 0-49: Document probablement falsifié ou illisible

${personaContext}

RETOURNE UNIQUEMENT UN JSON valide avec cette structure:
{
  "documentType": "cni" | "bulletin" | "bourse" | "caf" | "pension" | "contrat" | "scolarite" | "autre",
  "extractedData": {
    "nom": "string",
    "prenom": "string",
    "montants": [number],
    "dates": ["YYYY-MM-DD"],
    "autres": {}
  },
  "confidenceScore": number (0-100),
  "recommendations": ["string"],
  "fraudIndicators": {
    "suspicious": boolean,
    "reasons": ["string"]
  },
  "personaMatch": {
    "matches": boolean,
    "expectedProfile": "string",
    "detectedProfile": "string"
  }
}`;
}

/**
 * Analyse un document avec GPT-4o Vision
 */
export async function analyzeDocument(
  file: File,
  candidateStatus?: 'Etudiant' | 'Salarie' | 'Independant'
): Promise<DocumentAnalysisResult> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY non configurée');
    // Mode simulation si pas de clé API (pour développement)
    return {
      documentType: 'autre',
      extractedData: {},
      confidenceScore: 75,
      recommendations: ['Clé API OpenAI non configurée. Mode simulation activé.'],
      fraudIndicators: { suspicious: false, reasons: [] },
    };
  }

  try {
    // Convertir le fichier en base64
    const base64Image = await fileToBase64(file);

    // Appel à l'API OpenAI GPT-4o Vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: getAnalysisPrompt(candidateStatus),
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1, // Faible température pour plus de précision
        response_format: { type: 'json_object' }, // Force le JSON
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Erreur API OpenAI: ${response.status} - ${errorData.error?.message || 'Erreur inconnue'}`
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    // Parser la réponse JSON
    let result: DocumentAnalysisResult;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      // Tentative d'extraction du JSON si la réponse contient du texte autour
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Impossible de parser la réponse de l\'IA. Le document est peut-être illisible.');
      }
    }

    // Validation et normalisation du résultat
    return {
      documentType: result.documentType || 'autre',
      extractedData: result.extractedData || {},
      confidenceScore: Math.max(0, Math.min(100, result.confidenceScore || 0)),
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      fraudIndicators: result.fraudIndicators || {
        suspicious: false,
        reasons: [],
      },
      personaMatch: result.personaMatch,
    };
  } catch (error) {
    console.error('Erreur analyse document:', error);
    throw error instanceof Error
      ? error
      : new Error('Erreur lors de l\'analyse du document par l\'IA.');
  }
}

