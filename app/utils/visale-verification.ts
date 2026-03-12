/**
 * Module de vérification pour les certificats Visale
 * 
 * Fonctionnalités:
 * - Scan du code 2D-Doc (DataMatrix)
 * - Vérification de la validité du certificat
 * - Comparaison du loyer maximum garanti avec le loyer de l'annonce
 * - Génération d'alertes expert
 */

// @ts-ignore - jsqr n'a pas de types officiels
import jsQR from 'jsqr';
import { createCanvas, loadImage } from 'canvas';

export interface VisaleData {
  numero_visa: string; // Format: VXXXXXXXXX
  date_validite: string; // Format: "YYYY-MM-DD"
  loyer_maximum_garanti: number; // Montant maximum garanti
  code_2d_doc?: string; // Code 2D-Doc scanné
  code_2d_doc_valide?: boolean; // Validation du code
}

export interface VisaleVerificationResult {
  isValid: boolean;
  isExpired: boolean;
  code2DDocScanned: boolean;
  code2DDocValid: boolean;
  loyerExceedsPlafond: boolean;
  loyerDifference?: number;
  alertMessage?: string;
}

/**
 * Tente de scanner un code 2D-Doc (DataMatrix) depuis une image
 * Les codes 2D-Doc sont généralement des DataMatrix codes présents sur les documents officiels français
 */
export async function scan2DDocFromImage(imageDataUrl: string): Promise<{
  code: string | null;
  isValid: boolean;
}> {
  try {
    // Charger l'image avec canvas
    const img = await loadImage(imageDataUrl);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Convertir en ImageData pour jsQR
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Essayer de scanner avec jsQR (supporte QR codes et peut détecter certains DataMatrix)
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

    if (qrCode && qrCode.data) {
      // Vérifier si c'est un code 2D-Doc (format spécifique français)
      const data = qrCode.data;
      
      // Les codes 2D-Doc commencent généralement par des préfixes spécifiques
      // Format typique: séquence de caractères encodés
      if (data.length > 20) {
        // Vérifier la structure basique d'un code 2D-Doc
        // Note: La validation complète nécessiterait la bibliothèque officielle 2D-Doc
        return {
          code: data,
          isValid: true, // On assume valide si on arrive à le scanner
        };
      }
    }

    // Si jsQR n'a pas fonctionné, on peut essayer d'autres méthodes
    // Pour l'instant, on retourne null
    return {
      code: null,
      isValid: false,
    };
  } catch (error) {
    console.error('Erreur scan 2D-Doc:', error);
    return {
      code: null,
      isValid: false,
    };
  }
}

/**
 * Vérifie la validité d'un certificat Visale
 */
export function verifyVisaleCertificate(
  visaleData: VisaleData,
  rentAmount?: number
): VisaleVerificationResult {
  const result: VisaleVerificationResult = {
    isValid: true,
    isExpired: false,
    code2DDocScanned: !!visaleData.code_2d_doc,
    code2DDocValid: visaleData.code_2d_doc_valide || false,
    loyerExceedsPlafond: false,
  };

  // Vérifier la date de validité
  if (visaleData.date_validite) {
    const validiteDate = new Date(visaleData.date_validite);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (validiteDate < today) {
      result.isExpired = true;
      result.isValid = false;
    }
  }

  // Vérifier le format du numéro de visa
  if (!visaleData.numero_visa || !/^V\d{9}$/.test(visaleData.numero_visa)) {
    result.isValid = false;
  }

  // Comparer le loyer avec le plafond Visale
  if (rentAmount && visaleData.loyer_maximum_garanti > 0) {
    if (rentAmount > visaleData.loyer_maximum_garanti) {
      result.loyerExceedsPlafond = true;
      result.loyerDifference = rentAmount - visaleData.loyer_maximum_garanti;
      
      result.alertMessage = `Attention : Le loyer (${rentAmount.toLocaleString('fr-FR')}€) dépasse le plafond de votre garantie Visale (${visaleData.loyer_maximum_garanti.toLocaleString('fr-FR')}€). Veuillez ajouter un garant complémentaire.`;
    }
  }

  return result;
}

/**
 * Génère un message d'alerte pour l'Expert PatrimoTrust
 */
export function generateVisaleAlert(
  visaleData: VisaleData,
  rentAmount: number
): string | null {
  if (rentAmount > visaleData.loyer_maximum_garanti) {
    return `Attention : Le loyer (${rentAmount.toLocaleString('fr-FR')}€) dépasse le plafond de votre garantie Visale (${visaleData.loyer_maximum_garanti.toLocaleString('fr-FR')}€). Veuillez ajouter un garant complémentaire.`;
  }
  return null;
}
