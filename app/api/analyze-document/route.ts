import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { scanDPE } from '@/lib/owner-tunnel/dpe-scanner';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * API Route pour l'analyse de documents avec GPT-4o Vision (images) et GPT-4 (PDF texte)
 * Pour type=dpe : pipeline déterministe (Structured Outputs) via owner-tunnel
 */

interface DocumentAnalysisResult {
  documentType: string;
  extractedData: {
    nom?: string;
    prenom?: string;
    montants?: number[];
    dates?: string[];
    autres?: Record<string, unknown>;
    // Champs spécifiques DPE
    dpe_note?: string;
    ges_note?: string;
    dpe_value?: number;
    ges_value?: number;
    validity?: string;
    validity_end?: string;
    address?: string;
    surface?: number;
    construction_year?: number;
    heating_type?: string;
    energy_consumption?: number;
    co2_emissions?: number;
    property_type?: string;
    ademe_number?: string;
    is_new_format?: boolean;
  };
  confidenceScore: number;
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

function getDPEAnalysisPrompt(isTextMode: boolean = false): string {
  const modeContext = isTextMode 
    ? 'Tu analyses le TEXTE extrait d\'un Diagnostic de Performance Énergétique (DPE).'
    : 'Tu analyses une IMAGE d\'un Diagnostic de Performance Énergétique (DPE).';

  return `Tu es un expert en diagnostics immobiliers spécialisé dans l'analyse des DPE (Diagnostic de Performance Énergétique).

${modeContext}

MISSION CRITIQUE - Extraction précise du DPE:

1. ÉTIQUETTE ÉNERGIE (DPE) - PRIORITÉ ABSOLUE:
   - Identifie la lettre de A à G (A = excellent, G = très mauvais)
   - La note est affichée dans une échelle colorée (vert=A, rouge=G)
   - Cherche la consommation en kWh/m²/an
   - Valeurs typiques: A(<70), B(70-110), C(110-180), D(180-250), E(250-330), F(330-420), G(>420)

2. ÉTIQUETTE CLIMAT (GES):
   - Identifie la lettre de A à G pour les émissions CO2
   - Cherche les émissions en kg CO2/m²/an
   - Valeurs typiques: A(<6), B(6-11), C(11-30), D(30-50), E(50-70), F(70-100), G(>100)

3. INFORMATIONS DU BIEN:
   - Adresse complète du bien
   - Surface habitable en m²
   - Année de construction
   - Type de chauffage (gaz, électrique, fioul, pompe à chaleur, etc.)
   - Type de bien (appartement, maison, studio)

4. VALIDITÉ DU DIAGNOSTIC:
   - Date de réalisation
   - Date de fin de validité (10 ans après réalisation)
   - Numéro ADEME si visible

5. VÉRIFICATIONS:
   - Le DPE est-il au nouveau format (depuis juillet 2021) ou ancien format?
   - Les informations sont-elles cohérentes?
   - Le diagnostic est-il encore valide?

RETOURNE UNIQUEMENT UN JSON valide avec cette structure:
{
  "documentType": "dpe",
  "extractedData": {
    "dpe_note": "A" | "B" | "C" | "D" | "E" | "F" | "G",
    "ges_note": "A" | "B" | "C" | "D" | "E" | "F" | "G",
    "dpe_value": number (kWh/m²/an),
    "ges_value": number (kg CO2/m²/an),
    "energy_consumption": number,
    "co2_emissions": number,
    "validity": "YYYY-MM-DD",
    "validity_end": "YYYY-MM-DD",
    "address": "string",
    "surface": number,
    "construction_year": number,
    "heating_type": "string",
    "property_type": "appartement" | "maison" | "studio",
    "ademe_number": "string",
    "is_new_format": boolean,
    "autres": {}
  },
  "confidenceScore": number (0-100),
  "recommendations": ["string"],
  "fraudIndicators": {
    "suspicious": boolean,
    "reasons": ["string"]
  }
}

IMPORTANT: Si tu ne trouves pas une valeur, mets null. La note DPE (dpe_note) est L'INFORMATION LA PLUS IMPORTANTE à extraire.`;
}

function getAnalysisPrompt(
  candidateStatus?: string,
  isTextMode: boolean = false,
  diditIdentity?: { firstName?: string | null; lastName?: string | null; birthDate?: string | null }
): string {
  const personaContext = candidateStatus 
    ? `\n\nCONTEXTE CANDIDAT: Le candidat a déclaré être "${candidateStatus}". Vérifie la cohérence entre le profil déclaré et les documents fournis.`
    : '';

  const modeContext = isTextMode 
    ? 'Tu analyses le TEXTE extrait d\'un document PDF.'
    : 'Tu analyses une IMAGE de document.';

  const diditContext = diditIdentity?.firstName || diditIdentity?.lastName
    ? `\n\nIDENTITÉ CERTIFIÉE DIDIT:\n- Nom: ${diditIdentity.lastName || 'N/A'}\n- Prénom: ${diditIdentity.firstName || 'N/A'}\n- Date de naissance: ${diditIdentity.birthDate || 'N/A'}\nVérifie la cohérence entre ces informations et le document.`
    : '';

  return `Tu es un expert en audit de documents locatifs pour GetPatrimo, une plateforme Wealth-Tech de gestion locative sécurisée par IA.

${modeContext}

MISSION:
1. Identifie précisément le type de document (CNI/Passeport, Bulletin de salaire, Avis de bourse CROUS, Attestation CAF/APL, Justificatif de pension alimentaire, Contrat de travail, Certificat de scolarité, DPE, etc.)

2. Extrais les données clés:
   - Pour CNI/Passeport: Nom, Prénom, Date de naissance, Numéro
   - Pour Bulletins: Nom, Prénom, Salaire net, Dates, Employeur
   - Pour Bourses: Montant mensuel, Période, Organisme (CROUS)
   - Pour CAF: Montant APL/ALS, Période, Numéro allocataire
   - Pour Pension: Montant, Période, Donneur d'ordre
   - Pour Contrat: Type (CDI/CDD), Salaire brut, Dates, Employeur
   - Pour DPE: Note énergie (A-G), Note GES (A-G), Consommation kWh/m²/an

3. Détecte les incohérences potentielles:
   - Montants incohérents
   - Dates qui ne correspondent pas
   - Informations manquantes ou suspectes

4. Évalue la confiance (0-100):
   - 90-100: Document complet, informations cohérentes
   - 70-89: Document probablement authentique, quelques informations manquantes
   - 50-69: Document incomplet, nécessite vérification
   - 0-49: Document illisible ou très suspect

${personaContext}
${diditContext}

RETOURNE UNIQUEMENT UN JSON valide avec cette structure:
{
  "documentType": "cni" | "bulletin" | "bourse" | "caf" | "pension" | "contrat" | "scolarite" | "dpe" | "autre",
  "extractedData": {
    "nom": "string",
    "prenom": "string",
    "montants": [number],
    "dates": ["YYYY-MM-DD"],
    "dpe_note": "A-G (si DPE)",
    "ges_note": "A-G (si DPE)",
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

// Extraire le texte d'un PDF avec pdf-parse
async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  try {
    // Import dynamique pour éviter les erreurs SSR
    const pdfParse = (await import('pdf-parse')).default;
    const pdfBuffer = Buffer.from(buffer);
    const data = await pdfParse(pdfBuffer);
    return data.text || '';
  } catch (error) {
    console.error('Erreur extraction PDF:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez dans 1 minute.' }, { status: 429 });
    }

    const formData = await request.formData();
    // Support both 'file' and 'document' field names for compatibility
    const file = (formData.get('file') || formData.get('document')) as File | null;
    const documentType = formData.get('type') as string | null;
    const candidateStatus = formData.get('candidateStatus') as string | null;
    const diditFirstName = formData.get('diditFirstName') as string | null;
    const diditLastName = formData.get('diditLastName') as string | null;
    const diditBirthDate = formData.get('diditBirthDate') as string | null;

    // Déterminer si c'est un DPE
    const isDPE = documentType?.toLowerCase() === 'dpe';

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Configuration serveur incomplète: clé API OpenAI manquante' },
        { status: 500 }
      );
    }

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const buffer = await file.arrayBuffer();
    
    console.log(`📄 Analyse RÉELLE: ${file.name} (${(file.size/1024).toFixed(0)}KB) - Type: ${isPDF ? 'PDF' : 'Image'}${isDPE ? ' - Mode DPE (Structured Outputs)' : ''}`);

    // Pipeline déterministe DPE : json_schema strict (zéro hallucination)
    if (isDPE) {
      try {
        let pdfText: string | undefined;
        if (isPDF) {
          const pdfParse = (await import('pdf-parse')).default;
          const data = await pdfParse(Buffer.from(buffer));
          pdfText = data.text || '';
        }
        const dpe = await scanDPE(
          { buffer, mimeType: file.type || 'image/jpeg', isPdf: isPDF, pdfText },
          OPENAI_API_KEY
        );
        const jsonResponse: Record<string, unknown> = {
          documentType: 'dpe',
          extractedData: {
            surface: dpe.surface_habitable_m2,
            dpe_note: dpe.etiquette_energie,
            ges_note: dpe.etiquette_ges,
            validity_end: dpe.estimation_cout_annuel != null ? `Coût annuel ~${dpe.estimation_cout_annuel}€` : undefined,
          },
          confidenceScore: dpe.surface_habitable_m2 != null ? 95 : 80,
          recommendations: dpe.surface_habitable_m2 == null ? ['Surface non certifiée — merci de confirmer manuellement'] : [],
          fraudIndicators: { suspicious: false, reasons: [] },
          dpe_note: dpe.etiquette_energie,
          note: dpe.etiquette_energie,
          grade: dpe.etiquette_energie,
          ges_note: dpe.etiquette_ges,
          validity: dpe.estimation_cout_annuel != null ? `Coût annuel ~${dpe.estimation_cout_annuel}€` : undefined,
          surface: dpe.surface_habitable_m2,
        };
        return NextResponse.json(jsonResponse);
      } catch (dpeError) {
        console.error('❌ Erreur scan DPE structuré:', dpeError);
        return NextResponse.json(
          { error: dpeError instanceof Error ? dpeError.message : 'Erreur extraction DPE' },
          { status: 500 }
        );
      }
    }

    let messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
    let model: string;

    // Sélectionner le bon prompt selon le type de document
    const getPromptForDocument = (isTextMode: boolean) => {
      if (isDPE) {
        return getDPEAnalysisPrompt(isTextMode);
      }
      return getAnalysisPrompt(candidateStatus || undefined, isTextMode, {
        firstName: diditFirstName,
        lastName: diditLastName,
        birthDate: diditBirthDate,
      });
    };

    if (isPDF) {
      // Pour les PDF: extraire le texte et utiliser GPT-4
      const pdfText = await extractPDFText(buffer);
      
      if (!pdfText || pdfText.trim().length < 50) {
        console.log('⚠️ PDF sans texte extractible - document probablement scanné');
        return NextResponse.json({
          documentType: isDPE ? 'dpe' : 'autre',
          extractedData: {},
          confidenceScore: 60,
          recommendations: ['Ce PDF semble être un scan sans texte. Pour une meilleure analyse, veuillez fournir une image JPG/PNG du document.'],
          fraudIndicators: { suspicious: false, reasons: [] },
        });
      }

      console.log(`📝 Texte PDF extrait: ${pdfText.length} caractères`);
      
      model = 'gpt-4o';
      messages = [
        {
          role: 'user',
          content: `${getPromptForDocument(true)}\n\n--- CONTENU DU DOCUMENT ---\n${pdfText.substring(0, 8000)}`,
        },
      ];
    } else {
      // Pour les images: utiliser GPT-4o Vision
      const base64 = Buffer.from(buffer).toString('base64');
      
      let mimeType = 'image/jpeg';
      if (file.type.includes('image/png')) mimeType = 'image/png';
      if (file.type.includes('image/webp')) mimeType = 'image/webp';
      
      const base64Image = `data:${mimeType};base64,${base64}`;
      
      model = 'gpt-4o';
      messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: getPromptForDocument(false) },
            { type: 'image_url', image_url: { url: base64Image } },
          ],
        },
      ];
    }

    // Appel à l'API OpenAI
    console.log(`🤖 Appel OpenAI (${model})...`);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Erreur OpenAI:', response.status, errorData);
      
      // Message d'erreur plus explicite
      const errorMessage = errorData.error?.message || 'Erreur API OpenAI';
      throw new Error(`Erreur OpenAI (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    // Parser la réponse JSON
    let result: DocumentAnalysisResult;
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Réponse IA non parsable');
      }
    }

    console.log(`✅ Analyse RÉELLE terminée: ${result.documentType}, score: ${result.confidenceScore}%`);

    // Construire la réponse avec les champs spécifiques DPE si applicable
    const jsonResponse: Record<string, unknown> = {
      documentType: result.documentType || (isDPE ? 'dpe' : 'autre'),
      extractedData: result.extractedData || {},
      confidenceScore: Math.max(0, Math.min(100, result.confidenceScore || 0)),
      recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      fraudIndicators: result.fraudIndicators || { suspicious: false, reasons: [] },
      personaMatch: result.personaMatch,
    };

    // Ajouter les champs DPE au niveau racine pour faciliter l'accès côté frontend
    if (isDPE || result.documentType === 'dpe') {
      const data = result.extractedData || {};
      jsonResponse.dpe_note = data.dpe_note || null;
      jsonResponse.note = data.dpe_note || null; // Alias
      jsonResponse.grade = data.dpe_note || null; // Alias
      jsonResponse.ges_note = data.ges_note || null;
      jsonResponse.validity = data.validity || data.validity_end || null;
      jsonResponse.validite = data.validity || data.validity_end || null; // Alias français
      jsonResponse.dpe_value = data.dpe_value || data.energy_consumption || null;
      jsonResponse.ges_value = data.ges_value || data.co2_emissions || null;
      jsonResponse.surface = data.surface || null;
      jsonResponse.address = data.address || null;
      jsonResponse.heating_type = data.heating_type || null;
      jsonResponse.construction_year = data.construction_year || null;
    }

    return NextResponse.json(jsonResponse);

  } catch (error) {
    console.error('❌ Erreur analyse:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de l\'analyse' },
      { status: 500 }
    );
  }
}
