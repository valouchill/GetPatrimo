/**
 * Module de décodage et vérification des sceaux 2D-Doc
 * 
 * Utilise la bibliothèque @teko13/certiscan pour décoder les codes 2D-Doc
 * selon la spécification ANTS (Agence Nationale des Titres Sécurisés)
 * 
 * Fonctionnalités:
 * - Extraction du sceau 2D-Doc depuis une image PDF
 * - Décodage des données signées (Nom, Date, Type de Visa)
 * - Vérification de la signature numérique
 * - Comparaison avec l'identité Didit
 */

import { createCanvas, loadImage } from 'canvas';
// @ts-ignore - jsqr n'a pas de types officiels
import jsQR from 'jsqr';

export interface Decoded2DDocData {
  nom: string;
  prenom: string;
  dateNaissance?: string;
  dateEmission?: string;
  typeVisa?: string;
  numeroVisa?: string;
  loyerMaximumGaranti?: number;
  signatureValide: boolean;
  issuer?: string; // Émetteur (Action Logement pour Visale)
}

export interface TwoDDocVerificationResult {
  decoded: boolean;
  data?: Decoded2DDocData;
  signatureValid: boolean;
  matchesDiditIdentity: boolean;
  error?: string;
}

/**
 * Détecte et extrait le code 2D-Doc depuis une image
 * Les codes 2D-Doc sont généralement des DataMatrix codes carrés présents sur les documents officiels français
 */
export async function extract2DDocFromImage(imageDataUrl: string): Promise<{
  code: string | null;
  position?: { x: number; y: number; width: number; height: number };
}> {
  try {
    // Charger l'image avec canvas
    const img = await loadImage(imageDataUrl);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Convertir en ImageData pour jsQR
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Essayer de scanner avec jsQR (peut détecter certains DataMatrix)
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

      if (qrCode && qrCode.data) {
        const data = qrCode.data;
        
        // Vérifier si c'est un code 2D-Doc (commence généralement par des préfixes spécifiques)
        // Les codes 2D-Doc français ont une structure particulière
        if (data.length > 20 && (data.startsWith('DC') || data.match(/^[A-Z0-9]{2,}/))) {
          const result: { code: string; position?: { x: number; y: number; width: number; height: number } } = {
            code: data,
          };
          
          if (qrCode.location) {
            // Calculer la dimension à partir des coins
            const width = Math.abs(qrCode.location.topRightCorner.x - qrCode.location.topLeftCorner.x);
            const height = Math.abs(qrCode.location.bottomLeftCorner.y - qrCode.location.topLeftCorner.y);
            result.position = {
              x: qrCode.location.topLeftCorner.x,
              y: qrCode.location.topLeftCorner.y,
              width,
              height,
            };
          }
          
          return result;
        }
      }

    // Si jsQR n'a pas fonctionné, essayer de détecter manuellement
    // Les codes 2D-Doc sont généralement des carrés de taille fixe
    // On pourrait utiliser une détection de contours, mais pour l'instant on retourne null
    return {
      code: null,
    };
  } catch (error) {
    console.error('Erreur extraction 2D-Doc:', error);
    return {
      code: null,
    };
  }
}

/**
 * Décode un code 2D-Doc et vérifie sa signature numérique
 * Utilise la bibliothèque certiscan pour le décodage selon la spécification ANTS
 */
export async function decode2DDoc(
  code2DDoc: string
): Promise<{
  decoded: boolean;
  data?: Decoded2DDocData;
  signatureValid: boolean;
  error?: string;
}> {
  try {
    // Utiliser certiscan pour décoder le code 2D-Doc
    // @ts-ignore - certiscan n'a pas de types TypeScript officiels
    const { decoderQrCode } = await import('@teko13/certiscan');
    
    // Décoder le code 2D-Doc (decoderQrCode est async)
    const result = await decoderQrCode(code2DDoc);
    
    if (!result.success) {
      return {
        decoded: false,
        signatureValid: false,
        error: result.error || 'Code 2D-Doc invalide ou non décodable',
      };
    }

    // Vérifier la signature numérique
    const signatureValid = result.signature?.valid || false;

    // Extraire les données du dataset (les données sont dans result.message.dataset comme un objet)
    const dataset = result.message?.dataset || {};
    
    // Créer un objet pour faciliter l'accès aux données
    const dataMap: Record<string, any> = {};
    
    // Parcourir les clés du dataset
    Object.keys(dataset).forEach((key) => {
      const value = dataset[key];
      const keyLower = key.toLowerCase();
      
      // Normaliser les clés selon les noms possibles dans un certificat Visale
      if (keyLower.includes('nom') || keyLower.includes('lastname') || keyLower.includes('name') && !keyLower.includes('first')) {
        dataMap.nom = String(value);
      } else if (keyLower.includes('prenom') || keyLower.includes('firstname') || keyLower.includes('first')) {
        dataMap.prenom = String(value);
      } else if (keyLower.includes('naissance') || keyLower.includes('birth') || keyLower.includes('date') && keyLower.includes('naissance')) {
        dataMap.dateNaissance = String(value);
      } else if (keyLower.includes('emission') || keyLower.includes('issue') || (keyLower.includes('date') && keyLower.includes('emission'))) {
        dataMap.dateEmission = String(value);
      } else if (keyLower.includes('visa')) {
        if (keyLower.includes('numero') || keyLower.includes('number') || keyLower.includes('num')) {
          dataMap.numeroVisa = String(value);
        } else if (keyLower.includes('type')) {
          dataMap.typeVisa = String(value);
        }
      } else if (keyLower.includes('loyer') || keyLower.includes('rent') || keyLower.includes('montant') || keyLower.includes('plafond')) {
        dataMap.loyerMaximumGaranti = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.,]/g, '').replace(',', '.'));
      }
    });

    // Extraire aussi depuis le header si disponible
    const header = result.header || {};
    if (header.emit_date && !dataMap.dateEmission) {
      dataMap.dateEmission = header.emit_date;
    }

    // Construire l'objet de données décodées
    const data: Decoded2DDocData = {
      nom: dataMap.nom || '',
      prenom: dataMap.prenom || '',
      dateNaissance: dataMap.dateNaissance,
      dateEmission: dataMap.dateEmission || header.emit_date,
      typeVisa: dataMap.typeVisa,
      numeroVisa: dataMap.numeroVisa,
      loyerMaximumGaranti: dataMap.loyerMaximumGaranti,
      signatureValide: signatureValid,
      issuer: header.ca_id || 'Action Logement', // L'émetteur est généralement dans le header
    };

    return {
      decoded: true,
      data,
      signatureValid,
    };
  } catch (error) {
    console.error('Erreur décodage 2D-Doc:', error);
    return {
      decoded: false,
      signatureValid: false,
      error: error instanceof Error ? error.message : 'Erreur lors du décodage',
    };
  }
}

/**
 * Vérifie que les données décodées du 2D-Doc correspondent à l'identité Didit
 */
export function verify2DDocAgainstDidit(
  decodedData: Decoded2DDocData,
  diditIdentity: { firstName?: string | null; lastName?: string | null; birthDate?: string | null }
): boolean {
  if (!diditIdentity.firstName || !diditIdentity.lastName) {
    return false; // Pas d'identité Didit à comparer
  }

  // Normaliser les noms pour la comparaison (enlever accents, majuscules)
  const normalizeName = (name: string) => 
    name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const decodedNom = normalizeName(decodedData.nom);
  const decodedPrenom = normalizeName(decodedData.prenom);
  const diditNom = normalizeName(diditIdentity.lastName);
  const diditPrenom = normalizeName(diditIdentity.firstName);

  // Vérifier la correspondance des noms
  const nomMatch = decodedNom === diditNom || decodedNom.includes(diditNom) || diditNom.includes(decodedNom);
  const prenomMatch = decodedPrenom === diditPrenom || decodedPrenom.includes(diditPrenom) || diditPrenom.includes(decodedPrenom);

  // Vérifier la date de naissance si disponible
  let birthDateMatch = true;
  if (decodedData.dateNaissance && diditIdentity.birthDate) {
    const decodedDate = new Date(decodedData.dateNaissance);
    const diditDate = new Date(diditIdentity.birthDate);
    birthDateMatch = decodedDate.getTime() === diditDate.getTime();
  }

  return nomMatch && prenomMatch && birthDateMatch;
}

/**
 * Fonction principale pour vérifier un sceau 2D-Doc complet
 * Combine extraction, décodage et vérification
 */
export async function verify2DDocSeal(
  imageDataUrl: string,
  diditIdentity?: { firstName?: string | null; lastName?: string | null; birthDate?: string | null }
): Promise<TwoDDocVerificationResult> {
  try {
    // 1. Extraire le code 2D-Doc depuis l'image
    const extraction = await extract2DDocFromImage(imageDataUrl);
    
    if (!extraction.code) {
      return {
        decoded: false,
        signatureValid: false,
        matchesDiditIdentity: false,
        error: 'Aucun code 2D-Doc détecté dans l\'image',
      };
    }

    // 2. Décoder le code 2D-Doc
    const decodeResult = await decode2DDoc(extraction.code);
    
    if (!decodeResult.decoded || !decodeResult.data) {
      return {
        decoded: false,
        signatureValid: false,
        matchesDiditIdentity: false,
        error: decodeResult.error || 'Impossible de décoder le code 2D-Doc',
      };
    }

    // 3. Vérifier la signature numérique
    if (!decodeResult.signatureValid) {
      return {
        decoded: true,
        data: decodeResult.data,
        signatureValid: false,
        matchesDiditIdentity: false,
        error: 'Signature numérique invalide - Le document peut être falsifié',
      };
    }

    // 4. Comparer avec l'identité Didit si disponible
    let matchesDidit = false;
    if (diditIdentity) {
      matchesDidit = verify2DDocAgainstDidit(decodeResult.data, diditIdentity);
    }

    return {
      decoded: true,
      data: decodeResult.data,
      signatureValid: true,
      matchesDiditIdentity: matchesDidit,
    };
  } catch (error) {
    console.error('Erreur vérification sceau 2D-Doc:', error);
    return {
      decoded: false,
      signatureValid: false,
      matchesDiditIdentity: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la vérification',
    };
  }
}
