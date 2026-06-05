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

export interface VisaleCoherenceResult {
  numeroPresent: boolean;
  numeroFormatPlausible: boolean;
  /** Visa expiré (date de validité passée) — null si date absente/illisible. */
  isExpired: boolean | null;
  /** Le plafond garanti couvre le loyer demandé — null si loyer inconnu. */
  loyerCovers: boolean | null;
  alerts: string[];
  status:
    | 'A_VERIFIER_SUR_VISALE'
    | 'VISA_EXPIRE'
    | 'PLAFOND_INSUFFISANT'
    | 'NUMERO_MANQUANT'
    | 'FORMAT_INATTENDU';
  advice: string;
}

/**
 * Vérification de COHÉRENCE d'un visa Visale.
 *
 * Le visa Visale ne porte PAS de sceau 2D-Doc : son authenticité se vérifie sur
 * visale.fr (numéro de visa + nom du bénéficiaire), puis via la SIGNATURE du contrat
 * de cautionnement (« le visa seul ne constitue pas la garantie »). On automatise
 * ici les seuls contrôles automatisables (format du n°, validité, plafond ≥ loyer)
 * et on guide le bailleur vers la vérification officielle.
 *
 * Aucune pénalité de fraude : expiration / non-couverture sont des informations de
 * garantie, pas des falsifications. La concordance du NOM du bénéficiaire vs l'identité
 * du dossier est traitée par le module de concordance d'identité.
 */
export function verifyVisaleCoherence(
  visaleData: VisaleData,
  ctx: { rentAmount?: number | null; today?: Date } = {}
): VisaleCoherenceResult {
  const alerts: string[] = [];
  const numero = String(visaleData?.numero_visa || '').trim();
  const numeroPresent = numero.length > 0;
  // Format officiel : « V » suivi de chiffres (ex: V123456789).
  const numeroFormatPlausible = /^V\s?\d[\d\s]{5,}$/i.test(numero);
  if (!numeroPresent) {
    alerts.push('⚠️ Numéro de visa Visale non détecté — vérification impossible sans lui.');
  } else if (!numeroFormatPlausible) {
    alerts.push(`⚠️ Numéro de visa au format inattendu (« ${numero} ») — à confirmer sur visale.fr.`);
  }

  const today = ctx.today || new Date();
  let isExpired: boolean | null = null;
  const validity = String(visaleData?.date_validite || '').trim();
  const validityMatch = validity.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (validityMatch) {
    const d = new Date(`${validityMatch[1]}-${validityMatch[2]}-${validityMatch[3]}T23:59:59`);
    if (!Number.isNaN(d.getTime())) {
      isExpired = d.getTime() < today.getTime();
      if (isExpired) {
        alerts.push(`❌ Visa Visale expiré le ${validity} — la garantie ne peut plus être activée.`);
      }
    }
  }

  let loyerCovers: boolean | null = null;
  const rent = Number(ctx.rentAmount || 0);
  const plafond = Number(visaleData?.loyer_maximum_garanti || 0);
  if (rent > 0 && plafond > 0) {
    loyerCovers = plafond >= rent;
    if (!loyerCovers) {
      alerts.push(
        `⚠️ Loyer demandé (${rent.toLocaleString('fr-FR')} €) supérieur au plafond garanti Visale ` +
          `(${plafond.toLocaleString('fr-FR')} €) — la garantie ne couvrirait pas. Garant complémentaire recommandé.`
      );
    }
  }

  const status: VisaleCoherenceResult['status'] = !numeroPresent
    ? 'NUMERO_MANQUANT'
    : isExpired
      ? 'VISA_EXPIRE'
      : loyerCovers === false
        ? 'PLAFOND_INSUFFISANT'
        : !numeroFormatPlausible
          ? 'FORMAT_INATTENDU'
          : 'A_VERIFIER_SUR_VISALE';

  const advice =
    "ℹ️ Le visa Visale n'est pas une preuve de garantie en soi. Pour activer la couverture, " +
    `vérifiez ce visa sur visale.fr (numéro${numeroPresent ? ` ${numero}` : ''} + nom du locataire) ` +
    'puis signez le contrat de cautionnement Action Logement.';

  return { numeroPresent, numeroFormatPlausible, isExpired, loyerCovers, alerts, status, advice };
}
