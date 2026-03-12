/**
 * Service OCR & Extraction Forensic pour documents fiscaux
 * Conformité : Rejette les documents sans NOM propriétaire et ADRESSE bien
 * Intelligence : Isole montants > 500€ (travaux), TEOM (taxe foncière)
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Convertit un fichier en base64 pour l'API OpenAI
 */
async function fileToBase64(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'application/pdf';
    if (['.png'].includes(ext)) mimeType = 'image/png';
    if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  } catch (error) {
    throw new Error(`Erreur lecture fichier: ${error.message}`);
  }
}

/**
 * Extraction via OpenAI avec prompt personnalisé
 */
async function extractWithCustomPrompt(filePath, prompt) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY non configurée");
  }

  const base64Image = await fileToBase64(filePath);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: base64Image } }
        ]
      }],
      max_tokens: 2000,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur API OpenAI: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (e) {
    console.error("Erreur parsing JSON:", e);
    return {};
  }
}

/**
 * Types de documents fiscaux supportés
 */
const DOCUMENT_TYPES = {
  FACTURE_TRAVAUX: 'facture_travaux',
  FACTURE_MOBILIER: 'facture_mobilier',
  TAXE_FONCIERE: 'taxe_fonciere',
  QUITTANCE: 'quittance',
  AUTRE: 'autre'
};

/**
 * Extraction OCR d'un document fiscal avec validation de conformité
 * @param {string} filePath - Chemin absolu du fichier
 * @param {string} documentType - Type de document (voir DOCUMENT_TYPES)
 * @param {Object} propertyData - Données du bien (nom, adresse)
 * @param {Object} ownerData - Données du propriétaire (nom)
 * @returns {Promise<Object>} - Données extraites avec validation
 */
async function extractTaxDocument(filePath, documentType, propertyData, ownerData) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("Fichier introuvable");
    }

    // Extraction via IA avec prompt spécialisé
    const prompt = getTaxExtractionPrompt(documentType, propertyData, ownerData);
    const extracted = await extractWithCustomPrompt(filePath, prompt);
    
    // Validation de conformité (NOM + ADRESSE)
    const validation = validateTaxDocument(extracted, propertyData, ownerData);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: 'CONFORMITY_ERROR',
        message: validation.message,
        extracted: extracted
      };
    }

    // Traitement intelligent selon le type
    let processedData = {};
    
    switch (documentType) {
      case DOCUMENT_TYPES.FACTURE_TRAVAUX:
        processedData = processTravauxInvoice(extracted);
        break;
      case DOCUMENT_TYPES.TAXE_FONCIERE:
        processedData = processTaxeFonciere(extracted);
        break;
      case DOCUMENT_TYPES.FACTURE_MOBILIER:
        processedData = processMobilierInvoice(extracted);
        break;
      case DOCUMENT_TYPES.QUITTANCE:
        processedData = processQuittance(extracted);
        break;
      default:
        processedData = extracted;
    }

    return {
      success: true,
      documentType,
      extracted: extracted,
      processed: processedData,
      validation: validation
    };
  } catch (error) {
    console.error("Erreur extraction document fiscal:", error);
    return {
      success: false,
      error: 'EXTRACTION_ERROR',
      message: error.message
    };
  }
}

/**
 * Prompt spécialisé pour extraction fiscale
 */
function getTaxExtractionPrompt(documentType, propertyData, ownerData) {
  const basePrompt = `Tu es un expert fiscal français. Extrais les données suivantes d'un document fiscal au format JSON strict.`;

  const specificPrompts = {
    [DOCUMENT_TYPES.FACTURE_TRAVAUX]: `
${basePrompt}
Document: FACTURE DE TRAVAUX
Extrais:
- nom_proprietaire (nom complet du propriétaire)
- adresse_bien (adresse complète du bien)
- date_facture (format YYYY-MM-DD)
- montant_ht (montant HT en euros, nombre)
- montant_ttc (montant TTC en euros, nombre)
- tva (taux TVA en %)
- description_travaux (description détaillée)
- entreprise (nom de l'entreprise)
- siret (SIRET si présent)
- lignes_detail (tableau avec: description, quantite, prix_unitaire_ht, montant_ht)
Retourne un JSON valide uniquement.
    `,
    
    [DOCUMENT_TYPES.TAXE_FONCIERE]: `
${basePrompt}
Document: TAXE FONCIÈRE / AVIS D'IMPOSITION
Extrais:
- nom_proprietaire (nom complet)
- adresse_bien (adresse complète)
- annee_imposition (année)
- montant_taxe_fonciere (montant principal)
- montant_teom (Taxe d'Enlèvement des Ordures Ménagères, si présent)
- montant_total (montant total à payer)
- reference_avis (numéro de référence)
- date_echeance (date limite de paiement)
Retourne un JSON valide uniquement.
    `,
    
    [DOCUMENT_TYPES.FACTURE_MOBILIER]: `
${basePrompt}
Document: FACTURE MOBILIER / ÉQUIPEMENTS
Extrais:
- nom_proprietaire (nom complet)
- adresse_bien (adresse complète)
- date_facture (format YYYY-MM-DD)
- montant_ht (montant HT)
- montant_ttc (montant TTC)
- lignes_mobilier (tableau avec: description, quantite, prix_unitaire_ht, montant_ht)
- entreprise (nom du fournisseur)
Retourne un JSON valide uniquement.
    `,
    
    [DOCUMENT_TYPES.QUITTANCE]: `
${basePrompt}
Document: QUITTANCE DE LOYER
Extrais:
- nom_proprietaire (nom complet)
- nom_locataire (nom du locataire)
- adresse_bien (adresse complète)
- periode (ex: "01/2024" ou "janvier 2024")
- montant_loyer_hc (loyer hors charges)
- montant_charges (charges)
- montant_total (total à payer)
- date_emission (date d'émission)
- reference (numéro de quittance)
Retourne un JSON valide uniquement.
    `
  };

  return specificPrompts[documentType] || basePrompt;
}

/**
 * Validation de conformité : NOM propriétaire + ADRESSE bien
 */
function validateTaxDocument(extracted, propertyData, ownerData) {
  const ownerName = String(ownerData?.name || ownerData?.firstName + ' ' + ownerData?.lastName || '').trim().toLowerCase();
  const propertyAddress = String(propertyData?.address || propertyData?.addressLine || '').trim().toLowerCase();
  
  const extractedOwner = String(extracted?.nom_proprietaire || extracted?.owner_name || '').trim().toLowerCase();
  const extractedAddress = String(extracted?.adresse_bien || extracted?.property_address || '').trim().toLowerCase();

  // Vérification du nom (tolérance : correspondance partielle)
  const ownerMatch = ownerName && extractedOwner && (
    extractedOwner.includes(ownerName.split(' ')[0]) || 
    ownerName.includes(extractedOwner.split(' ')[0])
  );

  // Vérification de l'adresse (tolérance : correspondance partielle)
  const addressMatch = propertyAddress && extractedAddress && (
    extractedAddress.includes(propertyAddress.split(',')[0]) ||
    propertyAddress.includes(extractedAddress.split(',')[0])
  );

  if (!ownerMatch && !addressMatch) {
    return {
      isValid: false,
      message: "Document non conforme : Le nom du propriétaire ou l'adresse du bien ne correspondent pas.",
      missingFields: {
        owner: !ownerMatch,
        address: !addressMatch
      }
    };
  }

  if (!ownerMatch) {
    return {
      isValid: false,
      message: "Document non conforme : Le nom du propriétaire ne correspond pas.",
      missingFields: { owner: true, address: false }
    };
  }

  if (!addressMatch) {
    return {
      isValid: false,
      message: "Document non conforme : L'adresse du bien ne correspond pas.",
      missingFields: { owner: false, address: true }
    };
  }

  return {
    isValid: true,
    message: "Document conforme"
  };
}

/**
 * Traitement intelligent des factures de travaux
 * Isole les montants > 500€ pour amortissement
 */
function processTravauxInvoice(extracted) {
  const montantTTC = Number(extracted.montant_ttc || extracted.montant_total || 0);
  const lignes = Array.isArray(extracted.lignes_detail) ? extracted.lignes_detail : [];
  
  // Isolation des montants > 500€
  const travauxAmortissables = lignes.filter(l => {
    const montant = Number(l.montant_ht || l.montant || 0);
    return montant >= 500;
  });

  const montantAmortissable = travauxAmortissables.reduce((sum, l) => {
    return sum + Number(l.montant_ht || l.montant || 0);
  }, 0);

  return {
    montantTotalHT: Number(extracted.montant_ht || 0),
    montantTotalTTC: montantTTC,
    montantAmortissable, // Montants >= 500€
    travauxAmortissables,
    travauxNonAmortissables: lignes.filter(l => {
      const montant = Number(l.montant_ht || l.montant || 0);
      return montant < 500;
    }),
    tva: Number(extracted.tva || 20),
    date: extracted.date_facture,
    entreprise: extracted.entreprise || '',
    siret: extracted.siret || ''
  };
}

/**
 * Traitement de la taxe foncière
 * Isole la TEOM (Taxe d'Enlèvement des Ordures Ménagères)
 */
function processTaxeFonciere(extracted) {
  const montantTaxe = Number(extracted.montant_taxe_fonciere || extracted.montant_principal || 0);
  const montantTEOM = Number(extracted.montant_teom || 0);
  const montantTotal = Number(extracted.montant_total || montantTaxe + montantTEOM);

  return {
    annee: Number(extracted.annee_imposition || new Date().getFullYear()),
    montantTaxeFonciere: montantTaxe,
    montantTEOM, // Isolé pour récupération fiscale
    montantTotal,
    reference: extracted.reference_avis || '',
    dateEcheance: extracted.date_echeance || null
  };
}

/**
 * Traitement des factures de mobilier
 */
function processMobilierInvoice(extracted) {
  const lignes = Array.isArray(extracted.lignes_mobilier) ? extracted.lignes_mobilier : [];
  
  return {
    montantHT: Number(extracted.montant_ht || 0),
    montantTTC: Number(extracted.montant_ttc || extracted.montant_total || 0),
    lignesMobilier: lignes.map(l => ({
      description: l.description || '',
      quantite: Number(l.quantite || 1),
      prixUnitaireHT: Number(l.prix_unitaire_ht || l.prix || 0),
      montantHT: Number(l.montant_ht || l.montant || 0)
    })),
    date: extracted.date_facture,
    fournisseur: extracted.entreprise || ''
  };
}

/**
 * Traitement des quittances
 */
function processQuittance(extracted) {
  return {
    periode: extracted.periode || '',
    montantLoyerHC: Number(extracted.montant_loyer_hc || extracted.loyer || 0),
    montantCharges: Number(extracted.montant_charges || extracted.charges || 0),
    montantTotal: Number(extracted.montant_total || 0),
    dateEmission: extracted.date_emission || null,
    reference: extracted.reference || '',
    locataire: extracted.nom_locataire || ''
  };
}

module.exports = {
  extractTaxDocument,
  DOCUMENT_TYPES,
  validateTaxDocument,
  processTravauxInvoice,
  processTaxeFonciere,
  processMobilierInvoice,
  processQuittance
};
