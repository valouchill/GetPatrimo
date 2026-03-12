 'use server';
 
 interface DiditIdentity {
   firstName?: string;
   lastName?: string;
   birthDate?: string;
   humanVerified?: boolean;
 }
 
 interface DocumentAnalysisResult {
   documentType: string;
   extractedData: {
     nom?: string;
     prenom?: string;
     montants?: number[];
     dates?: string[];
     autres?: Record<string, unknown>;
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
 
 function getAnalysisPrompt(candidateStatus?: string, diditIdentity?: DiditIdentity): string {
   const personaContext = candidateStatus
     ? `\n\nCONTEXTE CANDIDAT: Le candidat a déclaré être "${candidateStatus}". Vérifie la cohérence entre le profil déclaré et les documents fournis.`
     : '';
 
   const diditContext = diditIdentity?.firstName || diditIdentity?.lastName
     ? `\n\nIDENTITÉ CERTIFIÉE DIDIT:\n- Nom: ${diditIdentity.lastName || 'N/A'}\n- Prénom: ${diditIdentity.firstName || 'N/A'}\n- Date de naissance: ${diditIdentity.birthDate || 'N/A'}\n- Human Verified: ${diditIdentity.humanVerified ? 'Oui' : 'Non'}\nVérifie la cohérence entre ces informations et le document.`
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
    - Incohérences avec l'identité Didit
 
 4. Évalue la confiance (0-100):
    - 90-100: Document authentique, parfaitement lisible
    - 70-89: Document probablement authentique, quelques doutes mineurs
    - 50-69: Document suspect, nécessite vérification manuelle
    - 0-49: Document probablement falsifié ou illisible
 
 ${personaContext}
 ${diditContext}
 
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
 
 async function fileToBase64(file: File): Promise<string> {
   const buffer = await file.arrayBuffer();
   const base64 = Buffer.from(buffer).toString('base64');
 
   let mimeType = 'image/jpeg';
   if (file.type.includes('image/png')) mimeType = 'image/png';
   if (file.type.includes('image/webp')) mimeType = 'image/webp';
   if (file.type.includes('image/jpeg') || file.type.includes('image/jpg')) mimeType = 'image/jpeg';
 
   return `data:${mimeType};base64,${base64}`;
 }
 
 export async function processDossier(
   file: File,
   candidateStatus?: 'Etudiant' | 'Salarie' | 'Independant',
   diditIdentity?: DiditIdentity | null
 ): Promise<DocumentAnalysisResult> {
   const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
   if (!OPENAI_API_KEY) {
     throw new Error('OPENAI_API_KEY non configurée');
   }
 
   if (!file.type.startsWith('image/')) {
     throw new Error('Le traitement IA direct est réservé aux images. Utilisez l\'upload PDF.');
   }
 
   const base64Image = await fileToBase64(file);
 
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
             { type: 'text', text: getAnalysisPrompt(candidateStatus, diditIdentity || undefined) },
             { type: 'image_url', image_url: { url: base64Image } },
           ],
         },
       ],
       max_tokens: 2000,
       temperature: 0.1,
       response_format: { type: 'json_object' },
     }),
   });
 
   if (!response.ok) {
     const errorData = await response.json().catch(() => ({}));
     throw new Error(`Erreur OpenAI: ${response.status} - ${errorData.error?.message || 'Erreur inconnue'}`);
   }
 
   const data = await response.json();
   const content = data.choices?.[0]?.message?.content || '{}';
 
   let result: DocumentAnalysisResult;
   try {
     result = JSON.parse(content);
   } catch (parseError) {
     const jsonMatch = content.match(/\{[\s\S]*\}/);
     if (jsonMatch) {
       result = JSON.parse(jsonMatch[0]);
     } else {
       throw new Error('Impossible de parser la réponse IA.');
     }
   }
 
   return {
     documentType: result.documentType || 'autre',
     extractedData: result.extractedData || {},
     confidenceScore: Math.max(0, Math.min(100, result.confidenceScore || 0)),
     recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
     fraudIndicators: result.fraudIndicators || { suspicious: false, reasons: [] },
     personaMatch: result.personaMatch,
   };
 }
