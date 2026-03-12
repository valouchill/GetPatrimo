import { NextRequest, NextResponse } from 'next/server';
import { validateMRZ } from '@/app/actions/validate-mrz';

// Polyfills pour pdfjs-dist dans Node.js 20
if (typeof globalThis.DOMMatrix === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.getTransform === 'function') {
      globalThis.DOMMatrix = ctx.getTransform().constructor as typeof DOMMatrix;
    }
  } catch {
    // canvas non disponible
  }
}

if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

/**
 * API Route V2 - Analyse robuste de documents PDF/Images avec GPT-4o Vision
 * 
 * FONCTIONNALITÉS:
 * - Conversion PDF -> Images PNG haute résolution (pdfjs-dist + canvas)
 * - Envoi multi-pages à GPT-4o Vision pour analyse approfondie
 * - Extraction JSON structuré avec renommage intelligent
 * - Détection d'erreurs avec messages personnalisés
 */

/**
 * Structure normalisée pour l'analyse de document (nouvelle version)
 * Alimente directement le calculateur de solvabilité et le PatrimoMeter
 */
interface NormalizedDocumentAnalysis {
  document_metadata: {
    type: 'BULLETIN_SALAIRE' | 'AVIS_IMPOSITION' | 'ATTESTATION_BOURSE' | 'AIDE_LOGEMENT' | 'PENSION' | 'CONTRAT_TRAVAIL' | 'CARTE_IDENTITE' | 'JUSTIFICATIF_DOMICILE' | 'CERTIFICAT_VISALE' | 'AUTRE';
    owner_name: string; // Format: "NOM Prénom"
    is_owner_match: boolean; // Comparaison avec le nom certifié par Didit
    date_emission: string; // Format: "YYYY-MM-DD"
    date_validite?: string; // Pour les pièces avec date d'expiration (ex: CNI, Visale) - format YYYY-MM-DD
    suggested_file_name: string; // Format: "NOM_Prenom_Type_Annee.pdf"
  };
  financial_data: {
    monthly_net_income: number; // Montant clé pour le calcul (normalisé, sans €, virgule → point)
    currency: 'EUR' | 'USD' | 'GBP' | 'OTHER';
    is_recurring: boolean; // true si revenu récurrent (salaire, pension), false si ponctuel
    extra_details: {
      brut_annuel?: number; // Si disponible (ex: contrat/bulletin)
      revenu_fiscal_reference?: number; // Pour les avis d'imposition
      nombre_mois_payes?: number; // Nombre de mois payés (ex: 12 pour annuel, 1 pour mensuel)
      salaire_brut_mensuel?: number;
      cotisations_mensuelles?: number;
      montant_bourse?: number;
      montant_apl?: number;
      montant_pension?: number;
      // Données spécifiques Visale
      visale?: {
        numero_visa: string; // Format: VXXXXXXXXX
        date_validite: string; // Format: "YYYY-MM-DD"
        loyer_maximum_garanti: number; // Montant maximum garanti par Visale
        code_2d_doc?: string; // Code 2D-Doc scanné (si disponible)
        code_2d_doc_valide?: boolean; // Validation du code 2D-Doc
      };
    };
  };
  trust_and_security: {
    fraud_score: number; // 0 (sûr) à 100 (fraude avérée)
    forensic_alerts: string[]; // ex: ["Police de caractère incohérente sur le net à payer", "Logo pixelisé"]
    math_validation: boolean; // Résultat du recalcul (Brut - Cotisations = Net)
    digital_seal_authenticated?: boolean; // true si authentifié par sceau numérique 2D-Doc
    digital_seal_status?: 'AUTHENTIFIÉ_PAR_SCELLEMENT_NUMÉRIQUE' | 'SIGNATURE_INVALIDE' | 'NOM_NON_CORRESPONDANT' | 'NON_DÉTECTÉ';
    // MRZ (pièce d'identité garant) – extraction Vision puis validation cryptographique
    mrz_line1?: string;
    mrz_line2?: string;
    mrz_line3?: string;
    mrz_validated?: boolean; // true après validateMRZ côté serveur
    // Nouveaux champs "Bienveillance Sécuritaire"
    needs_human_review?: boolean; // true si l'IA a un doute et recommande vérification humaine
    human_review_reason?: string; // Raison du doute pour le propriétaire
    partial_extraction?: boolean; // true si extraction partielle (certaines données manquantes)
    extracted_fields?: string[]; // Liste des champs extraits avec succès
  };
  ai_analysis: {
    detected_profile: 'STUDENT' | 'SALARIED' | 'INDEPENDENT' | 'RETIRED' | 'UNKNOWN';
    impact_on_patrimometer: number; // Points à ajouter au score (ex: 15)
    expert_advice: string; // Message BIENVEILLANT et ENCOURAGEANT pour le Coach IA
    improvement_tip?: string; // Conseil d'amélioration si document partiellement exploitable
    visale_alert?: string; // Alerte si le loyer dépasse le plafond Visale
  };
}

/**
 * Structure legacy (maintenue pour compatibilité)
 */
interface DocumentAnalysisV2Result {
  documentType: string;
  ownerName: string;
  date: string;
  suggestedFileName: string;
  confidenceScore: number;
  extractedData: {
    nom?: string;
    prenom?: string;
    montants?: number[];
    dates?: string[];
    employeur?: string;
    organisme?: string;
    numeroAllocataire?: string;
    typeContrat?: string;
    salaireBrut?: number;
    salaireNet?: number;
    cotisations?: number;
    adresse?: string;
    autres?: Record<string, unknown>;
  };
  recommendations: string[];
  fraudIndicators?: {
    suspicious: boolean;
    reasons: string[];
  };
  fraudScore?: number; // Score de fraude 0-100 (0 = authentique, >50 = suspect)
  fraudAudit?: {
    structureAnalysis?: {
      suspiciousAlignment: boolean;
      fontInconsistencies: boolean;
      details: string[];
    };
    mathematicalAudit?: {
      calculationErrors: boolean;
      brutNetDifference?: number;
      details: string[];
    };
    consistencyCheck?: {
      dateIssues: boolean;
      addressMismatch: boolean;
      details: string[];
    };
    metadataAnalysis?: {
      suspiciousCreator: boolean;
      creatorSoftware?: string;
      details: string[];
    };
  };
  personaMatch?: {
    matches: boolean;
    expectedProfile: string;
    detectedProfile: string;
  };
  isIllegible?: boolean;
  errorMessage?: string;
}

/**
 * Normalise un montant financier : supprime les symboles €, transforme les virgules en points
 * Exemples: "1 234,56 €" → 1234.56, "1.234,56€" → 1234.56, "1234.56" → 1234.56
 */
function normalizeAmount(value: string | number | undefined | null): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'number') {
    return value;
  }
  
  // Convertir en string et nettoyer
  let cleaned = String(value)
    .trim()
    .replace(/€/g, '') // Supprimer les symboles €
    .replace(/\s/g, '') // Supprimer les espaces
    .replace(/,/g, '.'); // Remplacer les virgules par des points
  
  // Si plusieurs points, garder seulement le dernier (décimal)
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extrait les métadonnées d'un PDF pour détecter le logiciel de création
 */
async function extractPDFMetadata(pdfBuffer: ArrayBuffer): Promise<{
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  suspicious: boolean;
  details: string[];
}> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = Buffer.from(pdfBuffer);
    const data = await pdfParse(buffer);
    
    const metadata = data.info || {};
    const creator = metadata.Creator || metadata.Producer || '';
    const producer = metadata.Producer || '';
    
    const suspiciousSoftware = [
      'Adobe Photoshop',
      'Canva',
      'GIMP',
      'Paint',
      'Illustrator',
      'InDesign',
      'Photoshop',
      'ImageMagick'
    ];
    
    const legitimateSoftware = [
      'Payfit',
      'Sage',
      'Cegid',
      'Silae',
      'ADP',
      'Sage Paie',
      'Cegid Paie',
      'Silae Paie',
      'Microsoft',
      'LibreOffice',
      'Apache',
      'iText',
      'PDFKit'
    ];
    
    const creatorLower = creator.toLowerCase();
    const producerLower = producer.toLowerCase();
    
    let suspicious = false;
    const details: string[] = [];
    
    // Vérifier si le créateur est suspect
    const isSuspicious = suspiciousSoftware.some(sw => 
      creatorLower.includes(sw.toLowerCase()) || producerLower.includes(sw.toLowerCase())
    );
    
    const isLegitimate = legitimateSoftware.some(sw => 
      creatorLower.includes(sw.toLowerCase()) || producerLower.includes(sw.toLowerCase())
    );
    
    if (isSuspicious) {
      suspicious = true;
      details.push(`⚠️ PDF créé par un logiciel de retouche: ${creator || producer}`);
      details.push(`Logiciel détecté: ${creator || producer}`);
    } else if (isLegitimate) {
      details.push(`✅ PDF créé par un logiciel légitime: ${creator || producer}`);
    } else if (creator || producer) {
      details.push(`ℹ️ Créateur détecté: ${creator || producer}`);
    }
    
    return {
      creator: creator || producer || undefined,
      producer: producer || undefined,
      creationDate: metadata.CreationDate || undefined,
      modificationDate: metadata.ModDate || undefined,
      suspicious,
      details
    };
  } catch (error) {
    console.log('⚠️ Impossible d\'extraire les métadonnées PDF:', error);
    return {
      suspicious: false,
      details: ['Impossible d\'extraire les métadonnées du PDF']
    };
  }
}

/**
 * Convertit un Buffer PDF en images PNG base64 avec pdfjs-dist + canvas
 * Essaie plusieurs stratégies de conversion en cas d'échec
 */
async function convertPDFToImages(
  pdfBuffer: ArrayBuffer,
  maxPages: number = 3,
  dpi: number = 200
): Promise<string[]> {
  const images: string[] = [];
  
  // Stratégies de conversion à essayer (du plus précis au moins précis)
  const strategies = [
    { dpi: 200, name: 'Haute résolution (200 DPI)' },
    { dpi: 150, name: 'Résolution moyenne (150 DPI)' },
    { dpi: 100, name: 'Résolution standard (100 DPI)' },
  ];
  
  for (const strategy of strategies) {
    try {
      // Import du legacy build (obligatoire pour Node.js avec pdfjs-dist v5+)
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const { createCanvas } = await import('canvas');
      
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
      
      // Charger le document PDF
      const uint8Array = new Uint8Array(pdfBuffer);
      const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        useSystemFonts: true,
        verbosity: 0, // Réduire les logs
      });
      
      const pdf = await loadingTask.promise;
      const numPages = Math.min(pdf.numPages, maxPages);
      
      console.log(`📄 PDF chargé: ${pdf.numPages} pages, conversion de ${numPages} pages (${strategy.name})`);
      
      // Convertir chaque page en image
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          
          // Calculer la résolution (scale basée sur le DPI souhaité)
          const viewport = page.getViewport({ scale: 1 });
          const scale = strategy.dpi / 72; // 72 DPI est la résolution par défaut
          const scaledViewport = page.getViewport({ scale });
          
          // Vérifier que les dimensions ne sont pas trop grandes (limite mémoire)
          const maxDimension = 5000;
          if (scaledViewport.width > maxDimension || scaledViewport.height > maxDimension) {
            const scaleDown = Math.min(maxDimension / scaledViewport.width, maxDimension / scaledViewport.height);
            const adjustedViewport = page.getViewport({ scale: scale * scaleDown });
            const canvas = createCanvas(adjustedViewport.width, adjustedViewport.height);
            const context = canvas.getContext('2d');
            
            await page.render({
              // @ts-expect-error - Type incompatibility between pdfjs and canvas contexts
              canvasContext: context,
              viewport: adjustedViewport,
            }).promise;
            
            const pngData = canvas.toDataURL('image/png');
            images.push(pngData);
            console.log(`✅ Page ${pageNum}/${numPages} convertie (${Math.round(adjustedViewport.width)}x${Math.round(adjustedViewport.height)}, réduite)`);
          } else {
            // Créer le canvas avec les dimensions calculées
            const canvas = createCanvas(scaledViewport.width, scaledViewport.height);
            const context = canvas.getContext('2d');
            
            // Rendre la page sur le canvas
            await page.render({
              // @ts-expect-error - Type incompatibility between pdfjs and canvas contexts
              canvasContext: context,
              viewport: scaledViewport,
            }).promise;
            
            // Convertir en PNG base64
            const pngData = canvas.toDataURL('image/png');
            images.push(pngData);
            
            console.log(`✅ Page ${pageNum}/${numPages} convertie (${Math.round(scaledViewport.width)}x${Math.round(scaledViewport.height)})`);
          }
        } catch (pageError) {
          console.error(`⚠️ Erreur conversion page ${pageNum}:`, pageError);
          // Continuer avec les autres pages
          if (images.length === 0 && pageNum === 1) {
            throw pageError; // Si la première page échoue, essayer une autre stratégie
          }
        }
      }
      
      // Si on a réussi à convertir au moins une page, retourner le résultat
      if (images.length > 0) {
        console.log(`✅ Conversion réussie avec ${strategy.name}: ${images.length} page(s)`);
        return images;
      }
    } catch (error) {
      console.error(`❌ Échec conversion avec ${strategy.name}:`, error);
      // Si ce n'est pas la dernière stratégie, continuer avec la suivante
      if (strategy !== strategies[strategies.length - 1]) {
        console.log(`🔄 Tentative avec résolution inférieure...`);
        continue;
      }
      // Si c'est la dernière stratégie, lancer l'erreur
      throw new Error(`Impossible de convertir le PDF en images après ${strategies.length} tentatives. Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }
  
  // Ne devrait jamais arriver ici, mais au cas où
  throw new Error('Impossible de convertir le PDF en images. Format non supporté ou PDF corrompu.');
}

/**
 * Génère le prompt d'extraction pour GPT-4o Vision
 * APPROCHE: "BIENVEILLANCE SÉCURITAIRE" - Aider le locataire tout en restant vigilant
 */
function getExtractionPrompt(
  candidateStatus?: string,
  candidateName?: string,
  diditIdentity?: { firstName?: string | null; lastName?: string | null; birthDate?: string | null },
  documentCategory?: string // 'identity' | 'resources' | 'guarantor'
): string {
  const personaContext = candidateStatus 
    ? `\n\nPROFIL DÉCLARÉ: "${candidateStatus}". Vérifie la cohérence entre le profil et le document.`
    : '';

  const nameContext = candidateName
    ? `\n\nNOM DU CANDIDAT: "${candidateName}". Vérifie que le document correspond à cette personne.`
    : '';

  const diditContext = diditIdentity?.firstName || diditIdentity?.lastName
    ? `\n\nIDENTITÉ CERTIFIÉE DIDIT:\n- Nom: ${diditIdentity.lastName || 'N/A'}\n- Prénom: ${diditIdentity.firstName || 'N/A'}\n- Date de naissance: ${diditIdentity.birthDate || 'N/A'}`
    : '';

  const guarantorContext = documentCategory === 'guarantor'
    ? `\n\nDOCUMENT GARANT: Ce document appartient au GARANT du locataire. Pour toute pièce d'identité (CNI ou Passeport), tu DOIS extraire les lignes MRZ (zone machine-readable en bas du document) dans trust_and_security: mrz_line1, mrz_line2, et pour une CNI française (format TD1) mrz_line3. Chaque ligne doit contenir exactement les caractères lus (sans espaces superflus, 30 caractères pour CNI, 44 pour passeport). Si la MRZ est illisible ou absente, laisse mrz_line1/2/3 à null et mets needs_human_review: true.`
    : '';

  return `Tu es un EXPERT DOCUMENTAIRE BIENVEILLANT pour PatrimoTrust, une plateforme immobilière Wealth-Tech française.

═══════════════════════════════════════════════════════════════
PHILOSOPHIE: "BIENVEILLANCE SÉCURITAIRE"
═══════════════════════════════════════════════════════════════

Tu accompagnes les locataires dans leur parcours de certification. Ton rôle est de les AIDER à réussir, pas de les bloquer.

RÈGLES D'OR:
1. Un document pris en PHOTO est acceptable tant que les chiffres clés sont lisibles
2. En cas de DOUTE sur un montant, extrais la valeur la plus probable et ajoute needs_human_review: true
3. Ne REJETTE JAMAIS un document s'il est partiellement lisible - extrais ce que tu peux
4. Donne des CONSEILS PÉDAGOGIQUES précis pour améliorer le document si besoin
5. Si le nom est lisible mais pas le revenu, valide au moins l'identité

═══════════════════════════════════════════════════════════════
PROTOCOLE D'ANALYSE (du plus bienveillant au plus strict)
═══════════════════════════════════════════════════════════════

1. TOLÉRANCE AU FORMAT:
   ✅ ACCEPTÉ: Photo de qualité moyenne si les chiffres clés sont lisibles
   ✅ ACCEPTÉ: Document légèrement de travers ou avec petit reflet
   ✅ ACCEPTÉ: Scan de qualité moyenne si les informations essentielles sont visibles
   ⚠️ NEEDS_REVIEW: Photo floue mais certaines données visibles → extrais ce que tu peux
   ❌ ILLISIBLE UNIQUEMENT SI: Aucune information exploitable n'est visible

2. GESTION DE L'INCERTITUDE (Confidence Scoring):
   - Si un montant est partiellement visible → extrais la valeur probable + needs_human_review: true
   - Si une date est coupée → indique la partie visible + conseil de recadrage
   - Si un nom est lisible mais flou → extrais-le + needs_human_review: true
   - JAMAIS d'erreur si au moins une info exploitable

3. DIAGNOSTIC PÉDAGOGIQUE (expert_advice):
   Au lieu de "Document invalide", rédige un message ENCOURAGEANT et PRÉCIS:
   
   EXEMPLES DE BONS MESSAGES:
   - "Presque parfait ! J'ai bien reconnu votre bulletin de salaire. Le montant Net est légèrement masqué par un reflet. Une petite correction et c'est validé !"
   - "Excellent document ! J'ai pu lire votre nom et le type de document. Seule la date est coupée en haut. Un recadrage rapide fera l'affaire."
   - "Très bien ! Votre attestation est claire. Je note un léger doute sur un chiffre du montant (peut-être un 5 ou un 6). Le propriétaire vérifiera ce détail."
   
   EXEMPLES DE MAUVAIS MESSAGES (À ÉVITER):
   - "Document rejeté"
   - "Qualité insuffisante"
   - "Illisible"
   - "Non conforme"

4. EXTRACTION PARTIELLE (toujours valoriser ce qui est lisible):
   - Si NOM lisible mais MONTANT flou → confirme l'identité + needs_human_review pour montant
   - Si MONTANT lisible mais NOM flou → extrais le montant + needs_human_review pour nom
   - Si TYPE de document identifiable → c'est déjà une victoire !
   
5. AUDIT DE SÉCURITÉ (en arrière-plan, sans alarmer):
   - Vérifie discrètement les incohérences mathématiques ET visuelles
   - Note les anomalies dans forensic_alerts et dans un tableau anomalies SANS dire "faux" au locataire
   - Le fraud_score sert à calculer une "Note d'intégrité" pour le propriétaire (0-100)
   - Au locataire, parle de "doute technique" ou "anomalie de lecture", jamais de "fraude"

═══════════════════════════════════════════════════════════════
AUDIT MATHÉMATIQUE (contrôle strict, discours bienveillant)
═══════════════════════════════════════════════════════════════

Pour les bulletins de salaire:
- Extrait: Salaire Brut, Cotisations (total), Salaire Net
- Calcule: diff = |(Salaire Brut - Cotisations) - Net à payer|
- Si diff ≤ 0,50€ → math_validation: true
- Si diff > 0,50€ → math_validation: false, augmente le fraud_score (par exemple +30) et ajoute une entrée claire dans forensic_alerts ET dans anomalies:
   * "Écart de X,XX€ entre Salaire Brut - Cotisations et Net à payer (>0,50€ de tolérance)"
- Renseigne aussi la section legacy fraudAudit.mathematicalAudit:
   * calculationErrors: true/false
   * brutNetDifference: valeur absolue de diff
   * details: tableau avec un message explicite similaire à anomalies

COHÉRENCE FISCALE (Avis d'imposition vs 12 mois de salaire):
- Si tu disposes à la fois:
   * du revenu fiscal de référence annuel sur l'avis d'imposition
   * d'une estimation du cumul des 12 derniers mois de salaire (somme des "Net à payer")
- Compare ces deux montants:
   * Si le cumul des bulletins est environ 2x supérieur ou inférieur au revenu fiscal (sans mention claire de changement de contrat, prime exceptionnelle, temps partiel/plein temps), considère cela comme INCOHÉRENCE MAJEURE.
   * Dans ce cas, augmente le fraud_score (par exemple +20) et ajoute dans forensic_alerts ET anomalies une phrase du style:
     "Le cumul net imposable ne correspond pas au revenu fiscal de référence (écart important sans explication apparente)."
- Si l'écart est modéré (ex: < 25%), considère cela comme cohérent et ne pénalise pas

VÉRIFICATION DE COHÉRENCE:
   - DATES: Vérifie que la date d'émission est un jour ouvrable
     * Un bulletin de salaire émis un dimanche ou jour férié = SUSPECT
     * Liste des jours fériés français: 1er janvier, Pâques, 1er mai, 8 mai, Ascension, Pentecôte, 14 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre
   - ADRESSES: Compare l'adresse sur le bulletin avec l'adresse sur l'avis d'imposition
     * Si différentes sans justification = INCOHÉRENCE
   - COHÉRENCE TEMPORELLE: Vérifie que les dates sont logiques (ex: bulletin de décembre 2024 ne peut pas être émis en janvier 2025)

4. ANALYSE DES MÉTADONNÉES (Si disponible):
   - Détecte si le PDF a été créé par un logiciel de retouche (Adobe Photoshop, Canva, GIMP, Paint)
   - Détecte si le PDF provient d'un logiciel de paie légitime (Payfit, Sage, Cegid, Silae, etc.)
   - Logiciels SUSPECTS: Photoshop, Canva, GIMP, Paint, Illustrator (si utilisé pour créer un bulletin ou un avis d'imposition)
   - Logiciels LÉGITIMES: Payfit, Sage, Cegid, Silae, ADP, etc.
   - Si le document semble être un bulletin, un avis d'imposition ou un justificatif administratif mais créé par un logiciel de design (Canva, Photoshop, Illustrator, etc.), augmente fortement le fraud_score (par exemple +50) et ajoute une entrée anomalies du type:
     "PDF modifié avec un logiciel de design (Canva/Photoshop/Illustrator) – analyse sous doute renforcé."

5. CALCUL DU FRAUD SCORE (0-100):
   - 0-10: Document authentique, aucune anomalie détectée
   - 10-50: Incohérence mineure (ex: faute de frappe, petite erreur de formatage)
   - 50-70: Suspicion modérée (ex: erreur de calcul mineure, date inhabituelle)
   - 70-90: Suspicion élevée (ex: montant superposé, erreur de calcul importante)
   - 90-100: Fraude suspectée (ex: PDF créé par Photoshop, multiples incohérences)

TYPES DE DOCUMENTS RECONNUS:
- "Avis d'Imposition" : Avis d'imposition sur le revenu
- "Bulletin de Salaire" : Fiche de paie mensuelle
- "Attestation Bourse CROUS" : Notification de bourse étudiante
- "Attestation CAF" : CAF, APL, ALS, RSA
- "Contrat de Travail" : CDI, CDD, contrat
- "Carte d'Identité" : CNI recto/verso
- "Passeport" : Passeport français ou étranger
- "Justificatif Domicile" : Facture EDF, téléphone, quittance
- "Attestation Employeur" : Attestation de l'employeur
- "Relevé Bancaire" : Relevé de compte
- "Acte Cautionnement" : Acte de caution, garant
- "Certificat Scolarité" : Inscription universitaire
- "Inconnu" : Si document non identifiable

EXTRACTION OBLIGATOIRE:
1. Type de document (parmi la liste ci-dessus)
2. Nom et Prénom du propriétaire/titulaire du document
3. Date/Année principale du document
4. Montants clés (salaire brut, salaire net, cotisations, bourse, APL, revenus...)
5. Adresse si visible
6. Score de confiance (0-100)
7. FRAUD SCORE (0-100) - CRITIQUE

RÈGLES DE RENOMMAGE (suggestedFileName):
- Format: NOM_Prenom_Type_Date.pdf
- Exemple: DUPONT_Marie_Bulletin_Salaire_2025.pdf
- Nettoyer les accents: é→e, è→e, à→a, etc.
- Underscores pour espaces

GESTION DES CAS LIMITES (Bienveillance avant tout):

CAS 1 - Photo avec reflet:
→ Extrais ce qui est visible + expert_advice: "J'ai bien identifié votre [type]. Un petit reflet masque [élément]. Une photo sans flash résoudra cela en 2 secondes !"
→ needs_human_review: true

CAS 2 - Document coupé:
→ Extrais la partie visible + expert_advice: "Super document ! La [partie] est légèrement coupée. Un recadrage rapide et c'est parfait !"
→ partial_extraction: true

CAS 3 - Qualité moyenne mais lisible:
→ Extrais tout + expert_advice: "Très bien ! Document accepté. La qualité est suffisante pour la certification."
→ needs_human_review: false (succès normal)

CAS 4 - Vraiment illisible (dernier recours):
→ isIllegible: true SEULEMENT si aucune information n'est exploitable
→ errorMessage: "[Message bienveillant expliquant comment améliorer]"

${personaContext}
${nameContext}
${diditContext}
${guarantorContext}

RETOURNE UNIQUEMENT CE JSON STRICT (pas de texte autour, pas de commentaires):

{
  "document_metadata": {
    "type": "BULLETIN_SALAIRE | AVIS_IMPOSITION | ATTESTATION_BOURSE | AIDE_LOGEMENT | PENSION | CONTRAT_TRAVAIL | CARTE_IDENTITE | JUSTIFICATIF_DOMICILE | CERTIFICAT_VISALE | AUTRE",
    "owner_name": "NOM Prénom",
    "is_owner_match": true,
    "date_emission": "YYYY-MM-DD",
    "date_validite": "YYYY-MM-DD",
    "suggested_file_name": "NOM_Prenom_Type_Annee.pdf"
  },
  "financial_data": {
    "monthly_net_income": 0.00,
    "currency": "EUR",
    "is_recurring": true,
    "extra_details": {
      "brut_annuel": 0.00,
      "revenu_fiscal_reference": 0.00,
      "nombre_mois_payes": 12,
      "salaire_brut_mensuel": 0.00,
      "cotisations_mensuelles": 0.00,
      "montant_bourse": 0.00,
      "montant_apl": 0.00,
      "montant_pension": 0.00,
      "visale": {
        "numero_visa": "VXXXXXXXXX",
        "date_validite": "YYYY-MM-DD",
        "loyer_maximum_garanti": 0.00,
        "code_2d_doc": null,
        "code_2d_doc_valide": false
      }
    }
  },
  "trust_and_security": {
    "fraud_score": 0,
    "forensic_alerts": [],
    "math_validation": true,
    "mrz_line1": null,
    "mrz_line2": null,
    "mrz_line3": null,
    "needs_human_review": false,
    "human_review_reason": null,
    "partial_extraction": false,
    "extracted_fields": ["type", "owner_name", "monthly_net_income"]
  },
  "ai_analysis": {
    "detected_profile": "STUDENT | SALARIED | INDEPENDENT | RETIRED | UNKNOWN",
    "impact_on_patrimometer": 15,
    "expert_advice": "Message BIENVEILLANT et ENCOURAGEANT pour le Coach IA",
    "improvement_tip": null,
    "visale_alert": null
  }
}

RÈGLES CRITIQUES:
1. MONTAINTS: TOUS les montants doivent être normalisés (sans €, virgule → point)
   - Exemple: Si tu vois "1 234,56 €", retourne 1234.56
   - Exemple: Si tu vois "2.500,00€", retourne 2500.00
   - monthly_net_income est le montant CLÉ pour le calculateur de solvabilité

2. TYPES DE DOCUMENTS:
   - BULLETIN_SALAIRE: Fiche de paie mensuelle
   - AVIS_IMPOSITION: Avis d'imposition sur le revenu
   - ATTESTATION_BOURSE: Notification de bourse étudiante (CROUS)
   - AIDE_LOGEMENT: CAF, APL, ALS
   - PENSION: Pension de retraite
   - CONTRAT_TRAVAIL: CDI, CDD, contrat
   - CARTE_IDENTITE: CNI, passeport (extrait également la date d'expiration principale sous forme date_validite au format YYYY-MM-DD)
   - JUSTIFICATIF_DOMICILE: Facture, quittance
   - CERTIFICAT_VISALE: Certificat de garantie Visale (Action Logement)
   - AUTRE: Si non identifiable

2.1. EXTRACTION SPÉCIFIQUE CERTIFICAT_VISALE:
   Si le document est un CERTIFICAT_VISALE, tu DOIS extraire:
   - numero_visa: Format VXXXXXXXXX (ex: V123456789) - généralement en haut du document
   - date_validite: Date de fin de validité du certificat (format YYYY-MM-DD)
   - loyer_maximum_garanti: Montant maximum du loyer garanti par Visale (normalisé, sans €)
   - Cherche un code 2D-Doc (code-barres 2D rectangulaire) sur le document
     * Si tu détectes un code 2D-Doc, note-le dans code_2d_doc (essaye de lire les données si possible)
     * Sinon, laisse code_2d_doc à null
   - Le code 2D-Doc sera vérifié séparément côté serveur

3. PROFILS DÉTECTÉS:
   - STUDENT: Étudiant (bourse, certificat scolarité)
   - SALARIED: Salarié (bulletin de salaire, contrat CDI/CDD)
   - INDEPENDENT: Indépendant (avis d'imposition avec revenus non salariés)
   - RETIRED: Retraité (pension)
   - UNKNOWN: Non déterminable

4. CALCUL monthly_net_income:
   - Pour BULLETIN_SALAIRE: utiliser salaireNet mensuel
   - Pour AVIS_IMPOSITION: revenu_fiscal_reference / 12 (approximation)
   - Pour ATTESTATION_BOURSE: montant_bourse mensuel
   - Pour AIDE_LOGEMENT: montant_apl mensuel
   - Pour PENSION: montant_pension mensuel
   - Si non disponible, mettre 0.00

5. is_recurring:
   - true: Salaire, pension, bourse, APL (revenus réguliers)
   - false: Prime ponctuelle, allocation exceptionnelle

6. is_owner_match:
   - Comparer owner_name avec l'identité Didit fournie
   - true si le nom correspond, false sinon

7. impact_on_patrimometer:
   - +40 si Didit vérifié (géré côté frontend)
   - +10 par document valide
   - +20 bonus si STUDENT + garant
   - -15 si incohérence détectée
   - Ici, retourner uniquement les points liés au document (ex: 10 pour document valide)

8. math_validation:
   - true si Brut - Cotisations ≈ Net à payer avec une tolérance maximale de 0,50€
   - false si |(Brut - Cotisations) - Net à payer| > 0,50€

9. forensic_alerts:
   - Liste des alertes détectées (ex: ["Police incohérente", "Montant superposé", "Date invalide"])
   - Vide [] si aucune anomalie`;
}

/**
 * Normalise et valide la structure NormalizedDocumentAnalysis
 * S'assure que tous les montants sont bien normalisés
 */
function normalizeAndValidateAnalysis(
  rawResult: any,
  diditIdentity?: { firstName?: string | null; lastName?: string | null; birthDate?: string | null }
): NormalizedDocumentAnalysis {
  // Vérifier si c'est déjà la nouvelle structure
  if (rawResult.document_metadata && rawResult.financial_data) {
    const normalized = rawResult as NormalizedDocumentAnalysis;
    
    // Normaliser tous les montants
    normalized.financial_data.monthly_net_income = normalizeAmount(normalized.financial_data.monthly_net_income);
    
    if (normalized.financial_data.extra_details) {
      normalized.financial_data.extra_details.brut_annuel = normalizeAmount(normalized.financial_data.extra_details.brut_annuel);
      normalized.financial_data.extra_details.revenu_fiscal_reference = normalizeAmount(normalized.financial_data.extra_details.revenu_fiscal_reference);
      normalized.financial_data.extra_details.salaire_brut_mensuel = normalizeAmount(normalized.financial_data.extra_details.salaire_brut_mensuel);
      normalized.financial_data.extra_details.cotisations_mensuelles = normalizeAmount(normalized.financial_data.extra_details.cotisations_mensuelles);
      normalized.financial_data.extra_details.montant_bourse = normalizeAmount(normalized.financial_data.extra_details.montant_bourse);
      normalized.financial_data.extra_details.montant_apl = normalizeAmount(normalized.financial_data.extra_details.montant_apl);
      normalized.financial_data.extra_details.montant_pension = normalizeAmount(normalized.financial_data.extra_details.montant_pension);
    }
    
    // Vérifier is_owner_match si Didit identity disponible
    if (diditIdentity?.firstName && diditIdentity?.lastName) {
      const diditName = `${diditIdentity.lastName} ${diditIdentity.firstName}`.toUpperCase();
      const ownerName = normalized.document_metadata.owner_name.toUpperCase();
      normalized.document_metadata.is_owner_match = ownerName.includes(diditName) || diditName.includes(ownerName);
    }
    
    return normalized;
  }
  
  // Sinon, transformer depuis l'ancienne structure (compatibilité)
  const legacy = rawResult as DocumentAnalysisV2Result;
  
  // Déterminer le type de document
  let docType: NormalizedDocumentAnalysis['document_metadata']['type'] = 'AUTRE';
  const docTypeLower = legacy.documentType?.toLowerCase() || '';
  if (docTypeLower.includes('bulletin') || docTypeLower.includes('salaire') || docTypeLower.includes('paie')) {
    docType = 'BULLETIN_SALAIRE';
  } else if (docTypeLower.includes('avis') || docTypeLower.includes('imposition')) {
    docType = 'AVIS_IMPOSITION';
  } else if (docTypeLower.includes('bourse') || docTypeLower.includes('crous')) {
    docType = 'ATTESTATION_BOURSE';
  } else if (docTypeLower.includes('apl') || docTypeLower.includes('caf') || docTypeLower.includes('aide')) {
    docType = 'AIDE_LOGEMENT';
  } else if (docTypeLower.includes('pension') || docTypeLower.includes('retraite')) {
    docType = 'PENSION';
  } else if (docTypeLower.includes('contrat')) {
    docType = 'CONTRAT_TRAVAIL';
  } else if (docTypeLower.includes('carte') || docTypeLower.includes('identité') || docTypeLower.includes('cni')) {
    docType = 'CARTE_IDENTITE';
  } else if (docTypeLower.includes('domicile') || docTypeLower.includes('facture') || docTypeLower.includes('quittance')) {
    docType = 'JUSTIFICATIF_DOMICILE';
  }
  
  // Calculer monthly_net_income
  let monthlyNetIncome = 0;
  if (legacy.extractedData?.salaireNet) {
    monthlyNetIncome = normalizeAmount(legacy.extractedData.salaireNet);
  } else if (legacy.extractedData?.montants && legacy.extractedData.montants.length > 0) {
    // Prendre le plus grand montant comme revenu net
    monthlyNetIncome = Math.max(...legacy.extractedData.montants.map(m => normalizeAmount(m)));
  }
  
  // Déterminer le profil
  let detectedProfile: NormalizedDocumentAnalysis['ai_analysis']['detected_profile'] = 'UNKNOWN';
  if (legacy.personaMatch?.detectedProfile) {
    const profileLower = legacy.personaMatch.detectedProfile.toLowerCase();
    if (profileLower.includes('student') || profileLower.includes('étudiant')) {
      detectedProfile = 'STUDENT';
    } else if (profileLower.includes('salaried') || profileLower.includes('salarié')) {
      detectedProfile = 'SALARIED';
    } else if (profileLower.includes('independent') || profileLower.includes('indépendant')) {
      detectedProfile = 'INDEPENDENT';
    } else if (profileLower.includes('retired') || profileLower.includes('retraité')) {
      detectedProfile = 'RETIRED';
    }
  }
  
  // Vérifier is_owner_match
  let isOwnerMatch = false;
  if (diditIdentity?.firstName && diditIdentity?.lastName) {
    const diditName = `${diditIdentity.lastName} ${diditIdentity.firstName}`.toUpperCase();
    const ownerName = (legacy.ownerName || '').toUpperCase();
    isOwnerMatch = ownerName.includes(diditName) || diditName.includes(ownerName);
  }
  
  // Construire forensic_alerts depuis fraudAudit
  const forensicAlerts: string[] = [];
  if (legacy.fraudAudit) {
    if (legacy.fraudAudit.structureAnalysis?.details) {
      forensicAlerts.push(...legacy.fraudAudit.structureAnalysis.details);
    }
    if (legacy.fraudAudit.mathematicalAudit?.details) {
      forensicAlerts.push(...legacy.fraudAudit.mathematicalAudit.details);
    }
    if (legacy.fraudAudit.consistencyCheck?.details) {
      forensicAlerts.push(...legacy.fraudAudit.consistencyCheck.details);
    }
    if (legacy.fraudAudit.metadataAnalysis?.details) {
      forensicAlerts.push(...legacy.fraudAudit.metadataAnalysis.details);
    }
  }
  if (legacy.fraudIndicators?.reasons) {
    forensicAlerts.push(...legacy.fraudIndicators.reasons);
  }
  
  // Calculer math_validation
  const mathValidation = legacy.fraudAudit?.mathematicalAudit?.calculationErrors === false;
  
  return {
    document_metadata: {
      type: docType,
      owner_name: legacy.ownerName || '',
      is_owner_match: isOwnerMatch,
      date_emission: legacy.date || '',
      suggested_file_name: legacy.suggestedFileName || '',
    },
    financial_data: {
      monthly_net_income: monthlyNetIncome,
      currency: 'EUR',
      is_recurring: docType === 'BULLETIN_SALAIRE' || docType === 'PENSION' || docType === 'ATTESTATION_BOURSE' || docType === 'AIDE_LOGEMENT',
      extra_details: {
        brut_annuel: legacy.extractedData?.salaireBrut ? normalizeAmount(legacy.extractedData.salaireBrut) * 12 : undefined,
        revenu_fiscal_reference: undefined,
        nombre_mois_payes: 12,
        salaire_brut_mensuel: normalizeAmount(legacy.extractedData?.salaireBrut),
        cotisations_mensuelles: normalizeAmount(legacy.extractedData?.cotisations),
        montant_bourse: docType === 'ATTESTATION_BOURSE' ? monthlyNetIncome : undefined,
        montant_apl: docType === 'AIDE_LOGEMENT' ? monthlyNetIncome : undefined,
        montant_pension: docType === 'PENSION' ? monthlyNetIncome : undefined,
      },
    },
    trust_and_security: {
      fraud_score: legacy.fraudScore || 0,
      forensic_alerts: forensicAlerts,
      math_validation: mathValidation,
    },
    ai_analysis: {
      detected_profile: detectedProfile,
      impact_on_patrimometer: legacy.fraudScore && legacy.fraudScore > 30 ? -15 : 10,
      expert_advice: legacy.recommendations?.[0] || 'Document analysé avec succès.',
    },
  };
}

/**
 * Appelle GPT-4o Vision avec les images et métadonnées
 * Retourne la structure normalisée NormalizedDocumentAnalysis
 */
async function analyzeWithVision(
  images: string[],
  prompt: string,
  openaiApiKey: string,
  pdfMetadata?: { creator?: string; producer?: string; suspicious: boolean; details: string[] },
  diditIdentity?: { firstName?: string | null; lastName?: string | null; birthDate?: string | null }
): Promise<NormalizedDocumentAnalysis> {
  // Ajouter les métadonnées PDF au prompt si disponibles
  let enhancedPrompt = prompt;
  if (pdfMetadata && (pdfMetadata.creator || pdfMetadata.producer)) {
    enhancedPrompt += `\n\n--- MÉTADONNÉES PDF ---\n`;
    if (pdfMetadata.creator) enhancedPrompt += `Créateur: ${pdfMetadata.creator}\n`;
    if (pdfMetadata.producer) enhancedPrompt += `Producteur: ${pdfMetadata.producer}\n`;
    if (pdfMetadata.suspicious) {
      enhancedPrompt += `⚠️ ATTENTION: Ce PDF a été créé par un logiciel de retouche (${pdfMetadata.creator || pdfMetadata.producer}). Analyse avec suspicion accrue.\n`;
    }
    enhancedPrompt += `\nUtilise ces métadonnées pour remplir fraudAudit.metadataAnalysis.`;
  }
  
  console.log(`🤖 Appel GPT-4o Vision avec ${images.length} image(s)...`);
  
  // Séparer le prompt système des images pour une meilleure qualité de réponse
  const imageContent: Array<{ type: string; image_url?: { url: string; detail?: string } }> = [];
  for (const image of images) {
    imageContent.push({
      type: 'image_url',
      image_url: { url: image, detail: 'high' }
    });
  }
  
  const AI_TIMEOUT_MS = 55_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: enhancedPrompt
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyse ce document et retourne le JSON structuré demandé.' },
              ...imageContent
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`⏱️ Timeout GPT-4o (${AI_TIMEOUT_MS}ms) — analyse mise en file d'attente`);
      throw new Error('AI_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ Erreur OpenAI:', response.status, errorData);
    throw new Error(`Erreur OpenAI (${response.status}): ${errorData.error?.message || 'Erreur inconnue'}`);
  }

  const data = await response.json();
  const resultText = data.choices?.[0]?.message?.content || '{}';
  
  console.log('📝 Réponse GPT-4o brute:', resultText.substring(0, 200) + '...');
  
  // Parser le JSON
  let rawResult: any;
  try {
    rawResult = JSON.parse(resultText);
  } catch {
    // Essayer d'extraire le JSON du texte
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawResult = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Réponse IA non parsable en JSON');
    }
  }
  
  // Normaliser et valider la structure
  const normalized = normalizeAndValidateAnalysis(rawResult, diditIdentity);
  
  console.log('✅ Analyse normalisée:', {
    type: normalized.document_metadata.type,
    monthly_net_income: normalized.financial_data.monthly_net_income,
    fraud_score: normalized.trust_and_security.fraud_score,
    profile: normalized.ai_analysis.detected_profile,
  });
  
  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const candidateStatus = formData.get('candidateStatus') as string | null;
    const candidateName = formData.get('candidateName') as string | null;
    const originalFileName = formData.get('originalFileName') as string | null;
    const diditFirstName = formData.get('diditFirstName') as string | null;
    const diditLastName = formData.get('diditLastName') as string | null;
    const diditBirthDate = formData.get('diditBirthDate') as string | null;
    const rentAmountStr = formData.get('rentAmount') as string | null; // Loyer de l'annonce pour vérification Visale
    const rentAmount = rentAmountStr ? parseFloat(rentAmountStr) : undefined;
    const documentCategory = formData.get('category') as string | null; // 'identity' | 'resources' | 'guarantor'

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
    const fileName = originalFileName || file.name;
    const fileSizeKB = file.size / 1024;
    const fileSizeMB = fileSizeKB / 1024;
    
    console.log(`\n📄 ═══════════════════════════════════════════`);
    console.log(`📄 ANALYSE V2: ${fileName}`);
    console.log(`📄 Taille: ${fileSizeKB.toFixed(0)}KB (${fileSizeMB.toFixed(2)}MB) | Type: ${isPDF ? 'PDF' : 'Image'}`);
    
    // Vérifier la taille du fichier
    if (fileSizeMB > 10) {
      console.warn(`⚠️ Fichier volumineux (${fileSizeMB.toFixed(2)}MB), cela peut ralentir l'analyse`);
    }
    
    // Vérifier que c'est bien un PDF valide
    if (isPDF) {
      const uint8Array = new Uint8Array(buffer);
      const pdfHeader = Array.from(uint8Array.slice(0, 4))
        .map(b => String.fromCharCode(b))
        .join('');
      
      if (pdfHeader !== '%PDF') {
        console.error('❌ Le fichier ne semble pas être un PDF valide (header incorrect)');
        return NextResponse.json({
          document_metadata: {
            type: 'AUTRE',
            owner_name: '',
            is_owner_match: false,
            date_emission: '',
            suggested_file_name: fileName,
          },
          financial_data: {
            monthly_net_income: 0,
            currency: 'EUR',
            is_recurring: false,
            extra_details: {},
          },
          trust_and_security: {
            fraud_score: 0,
            forensic_alerts: ['Header PDF invalide - fichier corrompu ou non-PDF'],
            math_validation: false,
          },
          ai_analysis: {
            detected_profile: 'UNKNOWN',
            impact_on_patrimometer: 0,
            expert_advice: `Le fichier "${fileName}" ne semble pas être un PDF valide. Veuillez vérifier que le fichier n'est pas corrompu.`,
          },
          originalFileName: fileName,
          isIllegible: true,
          errorMessage: `Le fichier "${fileName}" ne semble pas être un PDF valide. Veuillez vérifier que le fichier n'est pas corrompu.`,
        });
      }
      console.log(`✅ Header PDF valide détecté`);
    }
    
    console.log(`📄 ═══════════════════════════════════════════\n`);

    let images: string[] = [];
    let pdfMetadata: { creator?: string; producer?: string; suspicious: boolean; details: string[] } | undefined;

    if (isPDF) {
      // Extraire les métadonnées PDF pour l'analyse anti-fraude
      console.log('🔍 Extraction des métadonnées PDF...');
      try {
        pdfMetadata = await extractPDFMetadata(buffer);
        if (pdfMetadata.suspicious) {
          console.log(`⚠️ Métadonnées suspectes détectées: ${pdfMetadata.creator || pdfMetadata.producer}`);
        } else {
          console.log(`✅ Métadonnées PDF: ${pdfMetadata.creator || pdfMetadata.producer || 'Non disponible'}`);
        }
      } catch (error) {
        console.log('⚠️ Impossible d\'extraire les métadonnées:', error);
      }
      
      // Convertir le PDF en images
      console.log('🔄 Conversion PDF → Images PNG haute résolution...');
      let conversionError: Error | null = null;
      
      try {
        images = await convertPDFToImages(buffer, 3, 200);
      } catch (error) {
        conversionError = error instanceof Error ? error : new Error(String(error));
        console.error('❌ Échec conversion PDF:', conversionError.message);
        console.error('Détails:', conversionError);
        
        // Fallback 1: Essayer l'extraction de texte avec pdf-parse
        try {
          console.log('🔄 Fallback 1: Extraction de texte du PDF...');
          const pdfParse = (await import('pdf-parse')).default;
          const pdfBuffer = Buffer.from(buffer);
          const data = await pdfParse(pdfBuffer);
          
          console.log(`📝 Texte extrait: ${data.text?.length || 0} caractères`);
          
          if (data.text && data.text.trim().length > 50) {
            // Analyser le texte extrait avec GPT-4o
            console.log('🤖 Analyse du texte extrait avec GPT-4o...');
            const prompt = getExtractionPrompt(
              candidateStatus || undefined, 
              candidateName || undefined,
              {
                firstName: diditFirstName,
                lastName: diditLastName,
                birthDate: diditBirthDate,
              },
              documentCategory || undefined
            );
            
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
                    content: `${prompt}\n\n--- CONTENU DU DOCUMENT (extrait texte) ---\n${data.text.substring(0, 15000)}`
                  }
                ],
                max_tokens: 4000,
                temperature: 0.1,
                response_format: { type: 'json_object' },
              }),
            });
            
            if (response.ok) {
              const aiData = await response.json();
              const resultText = aiData.choices?.[0]?.message?.content || '{}';
              let rawResult: any;
              
              try {
                rawResult = JSON.parse(resultText);
              } catch {
                const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  rawResult = JSON.parse(jsonMatch[0]);
                } else {
                  throw new Error('Réponse IA non parsable');
                }
              }
              
              // Normaliser la structure
              const diditIdentity = {
                firstName: diditFirstName,
                lastName: diditLastName,
                birthDate: diditBirthDate,
              };
              const result = normalizeAndValidateAnalysis(rawResult, diditIdentity);
              
              console.log('✅ Analyse par extraction de texte réussie');
              
              return NextResponse.json({
                ...result,
                originalFileName: fileName,
                analysisMethod: 'text_extraction',
              });
            } else {
              const errorData = await response.json().catch(() => ({}));
              console.error('❌ Erreur OpenAI lors du fallback:', errorData);
            }
          } else {
            console.warn('⚠️ PDF ne contient pas assez de texte extractible');
          }
        } catch (fallbackError) {
          console.error('❌ Échec fallback extraction texte:', fallbackError);
        }
        
        // Fallback 2: Essayer avec une résolution encore plus basse
        try {
          console.log('🔄 Fallback 2: Tentative avec résolution très basse (72 DPI)...');
          images = await convertPDFToImages(buffer, 1, 72); // Une seule page, très basse résolution
          console.log('✅ Conversion réussie avec résolution réduite');
        } catch (lowResError) {
          console.error('❌ Échec même avec résolution réduite:', lowResError);
        }
      }
      
      // Si toujours pas d'images après tous les fallbacks
      if (images.length === 0) {
        const errorDetails = conversionError?.message || 'Erreur inconnue';
        console.error('❌ Tous les fallbacks ont échoué');
        
        return NextResponse.json({
          document_metadata: {
            type: 'AUTRE',
            owner_name: '',
            is_owner_match: false,
            date_emission: '',
            suggested_file_name: fileName,
          },
          financial_data: {
            monthly_net_income: 0,
            currency: 'EUR',
            is_recurring: false,
            extra_details: {},
          },
          trust_and_security: {
            fraud_score: 0,
            forensic_alerts: [`Impossible d'analyser le PDF: ${errorDetails}`],
            math_validation: false,
          },
          ai_analysis: {
            detected_profile: 'UNKNOWN',
            impact_on_patrimometer: 0,
            expert_advice: 'Document non analysable. Essayez de convertir votre PDF en image JPG/PNG, vérifiez que le PDF n\'est pas protégé par mot de passe, ou utilisez un PDF natif (non scanné) si possible.',
          },
          originalFileName: fileName,
          isIllegible: true,
          errorMessage: `Ce document PDF n'a pas pu être analysé automatiquement. Raison: ${errorDetails}. Solutions: 1) Convertissez le PDF en image JPG/PNG et réessayez, 2) Vérifiez que le PDF n'est pas protégé ou corrompu, 3) Utilisez un PDF natif (non scanné) si possible.`,
        });
      }
    } else {
      // Pour les images: encoder en base64 directement
      const base64 = Buffer.from(buffer).toString('base64');
      let mimeType = 'image/jpeg';
      if (file.type.includes('png')) mimeType = 'image/png';
      if (file.type.includes('webp')) mimeType = 'image/webp';
      
      images = [`data:${mimeType};base64,${base64}`];
    }

    if (images.length === 0) {
      return NextResponse.json({
        documentType: 'Inconnu',
        ownerName: '',
        date: '',
        suggestedFileName: fileName,
        confidenceScore: 0,
        isIllegible: true,
        errorMessage: 'Impossible de lire ce fichier. Format non supporté.',
        originalFileName: fileName,
      }, { status: 200 });
    }

    // Analyser avec GPT-4o Vision
    const diditIdentity = {
      firstName: diditFirstName,
      lastName: diditLastName,
      birthDate: diditBirthDate,
    };
    
    const prompt = getExtractionPrompt(
      candidateStatus || undefined,
      candidateName || undefined,
      diditIdentity,
      documentCategory || undefined
    );

    let result = await analyzeWithVision(
      images, 
      prompt, 
      OPENAI_API_KEY, 
      pdfMetadata,
      diditIdentity
    );

    // --- Ajustements backend supplémentaires pour la sécurité documentaire ---
    // S'assurer que les tableaux existent
    if (!result.trust_and_security.forensic_alerts) {
      result.trust_and_security.forensic_alerts = [];
    }

    // 1) Métadonnées PDF suspectes → boost du fraud_score
    if (pdfMetadata?.suspicious) {
      const baseScore = result.trust_and_security.fraud_score || 0;
      result.trust_and_security.fraud_score = Math.min(100, baseScore + 50);
      result.trust_and_security.forensic_alerts.push(
        'PDF créé ou modifié avec un logiciel de design (Canva/Photoshop/Illustrator...) – analyse sous doute renforcé.'
      );
    }

    // 2) Audit mathématique strict côté backend (Net = Brut - Cotisations, tolérance 0,50€)
    const extra = result.financial_data.extra_details;
    if (
      extra &&
      typeof extra.salaire_brut_mensuel === 'number' &&
      typeof extra.cotisations_mensuelles === 'number' &&
      typeof result.financial_data.monthly_net_income === 'number'
    ) {
      const brut = extra.salaire_brut_mensuel;
      const cot = extra.cotisations_mensuelles;
      const net = result.financial_data.monthly_net_income;
      const diff = Math.abs((brut - cot) - net);

      if (Number.isFinite(diff)) {
        if (diff > 0.5) {
          result.trust_and_security.math_validation = false;
          const baseScore = result.trust_and_security.fraud_score || 0;
          result.trust_and_security.fraud_score = Math.min(100, baseScore + 30);
          const diffLabel = diff.toFixed(2).replace('.', ',');
          result.trust_and_security.forensic_alerts.push(
            `Écart de ${diffLabel}€ entre Salaire Brut - Cotisations et Net à payer (>0,50€ de tolérance).`
          );
        } else if (result.trust_and_security.math_validation === undefined) {
          // Si l'IA n'a rien mis, on marque explicitement comme valide
          result.trust_and_security.math_validation = true;
        }
      }
    }

    // 3) Audit identité GARANT : validation MRZ pour toute pièce d'identité de garant
    if (documentCategory === 'guarantor' && result.document_metadata.type === 'CARTE_IDENTITE') {
      const ts = result.trust_and_security;
      const line1 = ts.mrz_line1?.trim();
      const line2 = ts.mrz_line2?.trim();
      const line3 = ts.mrz_line3?.trim();
      if (line1 && line2) {
        try {
          const mrzResult = await validateMRZ(line1, line2, line3 || undefined);
          ts.mrz_validated = mrzResult.isValid;
          if (!mrzResult.isValid) {
            result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 40);
            result.trust_and_security.forensic_alerts.push(
              'Pièce d\'identité garant : zone MRZ invalide ou checksums incorrects (validation cryptographique échouée).'
            );
          } else {
            result.trust_and_security.forensic_alerts.push('✅ Identité garant : MRZ validée (checksums OK).');
          }
        } catch (e) {
          ts.mrz_validated = false;
          result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 40);
          result.trust_and_security.forensic_alerts.push('Pièce d\'identité garant : erreur lors de la validation MRZ.');
        }
      } else {
        ts.mrz_validated = false;
        result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 30);
        result.trust_and_security.forensic_alerts.push('Pièce d\'identité garant : zone MRZ non extraite – document marqué SUSPECT.');
      }
    }

    // Log du résultat d'audit
    console.log(`\n🔍 ═══════════════════════════════════════════`);
    console.log(`🔍 AUDIT ANTI-FRAUDE`);
    console.log(`🔍 Type: ${result.document_metadata.type}`);
    console.log(`🔍 Propriétaire: ${result.document_metadata.owner_name}`);
    console.log(`🔍 Match Didit: ${result.document_metadata.is_owner_match ? '✅' : '❌'}`);
    console.log(`🔍 Fraud Score: ${result.trust_and_security.fraud_score}/100`);
    console.log(`🔍 Revenu net mensuel: ${result.financial_data.monthly_net_income.toFixed(2)}€`);
    console.log(`🔍 Profil détecté: ${result.ai_analysis.detected_profile}`);
    console.log(`🔍 Impact PatrimoMeter: +${result.ai_analysis.impact_on_patrimometer} points`);
    
    if (result.trust_and_security.fraud_score > 50) {
      console.log(`🔍 ⚠️ ALERTE FRAUDE SUSPECTÉE`);
    } else if (result.trust_and_security.fraud_score > 30) {
      console.log(`🔍 ⚠️ Suspicion modérée - Revue manuelle recommandée`);
    } else if (result.trust_and_security.fraud_score > 10) {
      console.log(`🔍 ⚠️ Incohérences mineures détectées`);
    } else {
      console.log(`🔍 ✅ Document authentique`);
    }
    
    if (result.trust_and_security.forensic_alerts.length > 0) {
      console.log(`🔍 Alertes: ${result.trust_and_security.forensic_alerts.join('; ')}`);
    }
    
    if (!result.trust_and_security.math_validation) {
      console.log(`🔍 ⚠️ Erreur de calcul détectée (Brut - Cotisations ≠ Net)`);
    }
    
    console.log(`🔍 ═══════════════════════════════════════════\n`);

    // Vérifier si le document est suspect (fraud_score > 30)
    if (result.trust_and_security.fraud_score > 30) {
      console.log(`⚠️ Document suspect (fraud_score: ${result.trust_and_security.fraud_score}) - Revue manuelle requise`);
      
      return NextResponse.json({
        ...result,
        originalFileName: fileName,
        analysisMethod: isPDF ? 'pdf_to_image_vision' : 'direct_vision',
        requiresManualReview: true,
        reviewReason: `Score de fraude élevé (${result.trust_and_security.fraud_score}/100). Alertes: ${result.trust_and_security.forensic_alerts.join(', ')}`,
      });
    }

    // Vérification spécifique pour les certificats Visale avec décodage 2D-Doc
    if (result.document_metadata.type === 'CERTIFICAT_VISALE' && result.financial_data.extra_details.visale) {
      console.log('🔍 Vérification certificat Visale avec décodage 2D-Doc...');
      
      const visaleData = result.financial_data.extra_details.visale;
      
      // Vérification du sceau numérique 2D-Doc
      if (images.length > 0) {
        try {
          const { verify2DDocSeal } = await import('@/app/utils/2d-doc-decoder');
          
          // Vérifier le sceau 2D-Doc sur toutes les images (le sceau peut être sur n'importe quelle page)
          let sealVerified = false;
          let decodedData: any = null;
          
          for (const image of images) {
            const verificationResult = await verify2DDocSeal(image, diditIdentity);
            
            if (verificationResult.decoded && verificationResult.signatureValid) {
              sealVerified = true;
              decodedData = verificationResult.data;
              
              // Mettre à jour les données Visale avec les données décodées du sceau
              if (decodedData) {
                visaleData.code_2d_doc = 'SCEAU_2D_DOC_DECODE';
                visaleData.code_2d_doc_valide = true;
                
                // Utiliser les données décodées si elles sont plus précises
                if (decodedData.numeroVisa && !visaleData.numero_visa) {
                  visaleData.numero_visa = decodedData.numeroVisa;
                }
                if (decodedData.dateEmission && !visaleData.date_validite) {
                  visaleData.date_validite = decodedData.dateEmission;
                }
                if (decodedData.loyerMaximumGaranti && !visaleData.loyer_maximum_garanti) {
                  visaleData.loyer_maximum_garanti = decodedData.loyerMaximumGaranti;
                }
                
                console.log(`✅ Sceau 2D-Doc décodé et vérifié:`);
                console.log(`   Nom: ${decodedData.nom} ${decodedData.prenom}`);
                console.log(`   Signature valide: ${verificationResult.signatureValid}`);
                console.log(`   Correspondance Didit: ${verificationResult.matchesDiditIdentity ? '✅' : '❌'}`);
                
                // Si la signature est valide ET correspond à l'identité Didit, marquer comme authentifié
                if (verificationResult.signatureValid && verificationResult.matchesDiditIdentity) {
                  // Marquer comme authentifié par sceau numérique
                  result.trust_and_security.digital_seal_authenticated = true;
                  result.trust_and_security.digital_seal_status = 'AUTHENTIFIÉ_PAR_SCELLEMENT_NUMÉRIQUE';
                  
                  // Ajouter dans les alertes forensiques (positif cette fois)
                  result.trust_and_security.forensic_alerts.push('✅ AUTHENTIFIÉ PAR SCELLEMENT NUMÉRIQUE 2D-Doc');
                  result.trust_and_security.fraud_score = Math.max(0, result.trust_and_security.fraud_score - 20); // Réduire le score de fraude
                  
                  // Mettre à jour l'expert advice
                  result.ai_analysis.expert_advice = `✅ Certificat Visale authentifié par sceau numérique 2D-Doc. Les données ont été vérifiées et signées par Action Logement. ${result.ai_analysis.expert_advice}`;
                  
                  console.log(`🔐 ✅ DOCUMENT AUTHENTIFIÉ PAR SCELLEMENT NUMÉRIQUE`);
                } else if (verificationResult.signatureValid && !verificationResult.matchesDiditIdentity) {
                  // Signature valide mais nom ne correspond pas
                  result.trust_and_security.digital_seal_authenticated = false;
                  result.trust_and_security.digital_seal_status = 'NOM_NON_CORRESPONDANT';
                  result.trust_and_security.forensic_alerts.push('⚠️ Sceau 2D-Doc valide mais nom ne correspond pas à l\'identité Didit');
                  result.ai_analysis.expert_advice = `⚠️ Le sceau numérique est valide mais le nom sur le certificat (${decodedData.nom} ${decodedData.prenom}) ne correspond pas à votre identité certifiée. ${result.ai_analysis.expert_advice}`;
                } else if (!verificationResult.signatureValid) {
                  // Signature invalide – marquer comme SUSPECT
                  result.trust_and_security.digital_seal_authenticated = false;
                  result.trust_and_security.digital_seal_status = 'SIGNATURE_INVALIDE';
                  result.trust_and_security.forensic_alerts.push('❌ Signature numérique du sceau 2D-Doc invalide – Document suspect');
                  result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 40);
                }
              }
              
              break; // On a trouvé et vérifié le sceau, pas besoin de continuer
            }
          }
          
          if (!sealVerified) {
            console.log('⚠️ Sceau 2D-Doc non détecté ou non décodable – document marqué SUSPECT');
            result.trust_and_security.digital_seal_authenticated = false;
            result.trust_and_security.digital_seal_status = 'NON_DÉTECTÉ';
            result.trust_and_security.forensic_alerts.push('⚠️ Sceau numérique 2D-Doc non détecté ou non décodable – certificat Visale marqué SUSPECT');
            result.trust_and_security.fraud_score = Math.min(100, (result.trust_and_security.fraud_score || 0) + 40);
          }
        } catch (error) {
          console.error('⚠️ Erreur décodage sceau 2D-Doc:', error);
          result.trust_and_security.forensic_alerts.push('⚠️ Erreur lors du décodage du sceau 2D-Doc');
        }
      }
      
      // Vérifier le certificat et comparer avec le loyer
      if (rentAmount && visaleData.loyer_maximum_garanti > 0) {
        const { generateVisaleAlert } = await import('@/app/utils/visale-verification');
        const alert = generateVisaleAlert(visaleData, rentAmount);
        
        if (alert) {
          result.ai_analysis.visale_alert = alert;
          // Ajouter l'alerte dans expert_advice
          result.ai_analysis.expert_advice = `${result.ai_analysis.expert_advice} ${alert}`;
          console.log(`⚠️ Alerte Visale: ${alert}`);
        } else {
          console.log(`✅ Loyer (${rentAmount}€) dans les limites Visale (${visaleData.loyer_maximum_garanti}€)`);
        }
      }
      
      console.log(`📋 Données Visale extraites:`);
      console.log(`   Numéro Visa: ${visaleData.numero_visa}`);
      console.log(`   Date validité: ${visaleData.date_validite}`);
      console.log(`   Loyer max garanti: ${visaleData.loyer_maximum_garanti}€`);
      console.log(`   Sceau 2D-Doc: ${visaleData.code_2d_doc_valide ? '✅ Validé' : '❌ Non validé'}`);
    }

    console.log(`✅ Analyse V2 terminée avec succès`);
    console.log(`   Type: ${result.document_metadata.type}`);
    console.log(`   Propriétaire: ${result.document_metadata.owner_name}`);
    console.log(`   Nouveau nom: ${result.document_metadata.suggested_file_name}`);
    console.log(`   Revenu net mensuel: ${result.financial_data.monthly_net_income.toFixed(2)}€`);
    
    // Extraire les champs de "Bienveillance Sécuritaire"
    const needsHumanReview = result.trust_and_security.needs_human_review || 
                             result.trust_and_security.partial_extraction ||
                             (result.trust_and_security.fraud_score > 20 && result.trust_and_security.fraud_score <= 50);
    
    const extractedFields = result.trust_and_security.extracted_fields || 
                           Object.entries(result.document_metadata)
                             .filter(([_, v]) => v && v !== '')
                             .map(([k]) => k);
    
    // Construire un tableau "anomalies" lisible à partir des alertes forensiques
    const anomalies: string[] = [...(result.trust_and_security.forensic_alerts || [])];

    console.log(`   Needs Human Review: ${needsHumanReview ? 'Oui' : 'Non'}`);
    console.log(`   Champs extraits: ${extractedFields.join(', ')}`);
    if (anomalies.length > 0) {
      console.log(`   Anomalies détectées: ${anomalies.join(' | ')}`);
    }
    console.log('');

    return NextResponse.json({
      ...result,
      originalFileName: fileName,
      analysisMethod: isPDF ? 'pdf_to_image_vision' : 'direct_vision',
      // Champs de niveau supérieur pour compatibilité frontend
      needsHumanReview,
      humanReviewReason: result.trust_and_security.human_review_reason,
      partialExtraction: result.trust_and_security.partial_extraction,
      extractedFields,
      improvementTip: result.ai_analysis.improvement_tip,
      expertAdvice: result.ai_analysis.expert_advice,
      anomalies,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    const isTimeout = errorMessage === 'AI_TIMEOUT';
    const isOpenAIError = errorMessage.startsWith('Erreur OpenAI');

    if (isTimeout || isOpenAIError) {
      console.warn(`⚠️ Fallback 202 activé (${isTimeout ? 'timeout' : 'erreur OpenAI'}): document mis en file d'attente`);
      return NextResponse.json(
        { 
          status: 'delayed',
          message: "Analyse mise en file d'attente. Votre document a bien été reçu et sera analysé sous peu.",
          document_metadata: { type: 'PENDING', status: 'pending_manual_review' },
          ai_analysis: { fraud_score: 0, expert_advice: "Le document a été reçu et sera analysé manuellement." },
          financial_data: {},
          trust_and_security: { fraud_score: 0, forensic_alerts: [] },
        },
        { status: 202 }
      );
    }

    console.error('❌ Erreur analyse V2:', error);
    return NextResponse.json(
      { 
        error: errorMessage,
        isIllegible: true,
        errorMessage: 'Une erreur technique est survenue. Veuillez réessayer.'
      },
      { status: 500 }
    );
  }
}
