function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeComparableValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const PROOF_OF_ADDRESS_EXACT_TYPES = new Set([
  'JUSTIFICATIF_DOMICILE',
  'JUSTIFICATIF_DE_DOMICILE',
  'DOMICILE',
  'FACTURE',
  'QUITTANCE',
  'QUITTANCE_LOYER',
  'ASSURANCE_HABITATION',
  'ATTESTATION_ASSURANCE_HABITATION',
  'AVIS_ECHEANCE',
  'AVIS_D_ECHEANCE',
  'AVIS_ECHEANCE_HABITATION',
  'FACTURE_ELECTRICITE',
  'FACTURE_GAZ',
  'FACTURE_EAU',
  'FACTURE_INTERNET',
  'FACTURE_TELEPHONE',
  'FACTURE_MOBILE',
  'FACTURE_BOX',
  'MULTIRISQUE_HABITATION',
]);

const PROOF_OF_ADDRESS_PROVIDER_TOKENS = [
  'EDF',
  'ENGIE',
  'TOTALENERGIES',
  'ENEDIS',
  'VEOLIA',
  'SAUR',
  'SUEZ',
  'ORANGE',
  'SFR',
  'FREE',
  'BOUYGUES',
];

function includesAnyToken(value, tokens) {
  return tokens.some(token => value.includes(token));
}

function isLikelyProofOfAddressNormalized(normalized) {
  if (!normalized) return false;

  if (PROOF_OF_ADDRESS_EXACT_TYPES.has(normalized)) {
    return true;
  }

  if (
    normalized.includes('DOMICILE') ||
    normalized.includes('FACTURE') ||
    normalized.includes('QUITTANCE') ||
    normalized.includes('LOYER')
  ) {
    return true;
  }

  if (
    normalized.includes('ASSURANCE_HABITATION') ||
    normalized.includes('MULTIRISQUE_HABITATION') ||
    (normalized.includes('ASSURANCE') && normalized.includes('HABITATION'))
  ) {
    return true;
  }

  if (
    normalized.includes('AVIS_ECHEANCE') ||
    normalized.includes('ECHEANCIER') ||
    (normalized.includes('AVIS') && normalized.includes('ECHEANCE'))
  ) {
    return true;
  }

  if (
    normalized.includes('ELECTRICITE') ||
    normalized.includes('ENERGIE') ||
    normalized.includes('GAZ') ||
    normalized.includes('EAU') ||
    normalized.includes('INTERNET') ||
    normalized.includes('FIBRE') ||
    normalized.includes('TELEPHONE') ||
    normalized.includes('MOBILE') ||
    normalized.includes('BOX')
  ) {
    return true;
  }

  return includesAnyToken(normalized, PROOF_OF_ADDRESS_PROVIDER_TOKENS);
}

function normalizeAnalysisDocumentType(value) {
  const normalized = normalizeComparableValue(value);
  if (!normalized) return 'AUTRE';

  if (['CNI', 'CARTE_IDENTITE', 'CARTE_D_IDENTITE', 'PIECE_IDENTITE', 'PASSEPORT'].includes(normalized)) {
    return 'CARTE_IDENTITE';
  }
  if (['BULLETIN', 'BULLETIN_SALAIRE', 'FICHE_PAIE', 'FICHE_DE_PAIE', 'SALAIRE'].includes(normalized)) {
    return 'BULLETIN_SALAIRE';
  }
  if (['AVIS_IMPOSITION', 'AVIS_D_IMPOSITION', 'IMPOT', 'IMPOSITION', 'RFR'].includes(normalized)) {
    return 'AVIS_IMPOSITION';
  }
  if (['ATTESTATION_BOURSE', 'BOURSE', 'CROUS', 'AVIS_BOURSE'].includes(normalized)) {
    return 'ATTESTATION_BOURSE';
  }
  if (['AIDE_LOGEMENT', 'CAF', 'APL', 'ALS', 'ATTESTATION_CAF'].includes(normalized)) {
    return 'AIDE_LOGEMENT';
  }
  if (['PENSION', 'PENSION_ALIMENTAIRE', 'RETRAITE'].includes(normalized)) {
    return 'PENSION';
  }
  if (['CONTRAT_TRAVAIL', 'CONTRAT', 'PROMESSE_EMBAUCHE', 'ATTESTATION_EMPLOYEUR', 'EMPLOYEUR'].includes(normalized)) {
    return 'CONTRAT_TRAVAIL';
  }
  if (isLikelyProofOfAddressNormalized(normalized)) {
    return 'JUSTIFICATIF_DOMICILE';
  }
  if (['CERTIFICAT_VISALE', 'VISALE'].includes(normalized)) {
    return 'CERTIFICAT_VISALE';
  }

  if (normalized.includes('BULLETIN') || normalized.includes('PAIE') || normalized.includes('SALAIRE')) {
    return 'BULLETIN_SALAIRE';
  }
  if (normalized.includes('IMPOSITION') || normalized.includes('RFR') || normalized.includes('IMPOT')) {
    return 'AVIS_IMPOSITION';
  }
  if (normalized.includes('CARTE') || normalized.includes('IDENTITE') || normalized.includes('PASSEPORT')) {
    return 'CARTE_IDENTITE';
  }
  if (isLikelyProofOfAddressNormalized(normalized)) {
    return 'JUSTIFICATIF_DOMICILE';
  }
  if (normalized.includes('VISALE')) {
    return 'CERTIFICAT_VISALE';
  }
  if (normalized.includes('BOURSE') || normalized.includes('CROUS')) {
    return 'ATTESTATION_BOURSE';
  }
  if (normalized.includes('CAF') || normalized.includes('APL') || normalized.includes('ALS')) {
    return 'AIDE_LOGEMENT';
  }
  if (normalized.includes('PENSION') || normalized.includes('RETRAITE')) {
    return 'PENSION';
  }
  if (normalized.includes('CONTRAT') || normalized.includes('EMPLOYEUR')) {
    return 'CONTRAT_TRAVAIL';
  }

  return 'AUTRE';
}

function inferAnalysisDocumentTypeFromSignals({
  aiDocumentType,
  fileName,
  rawText,
}) {
  const normalizedType = normalizeAnalysisDocumentType(aiDocumentType);
  if (normalizedType !== 'AUTRE') {
    return normalizedType;
  }

  const normalizedSignals = normalizeComparableValue([fileName, rawText].filter(Boolean).join(' '));
  if (!normalizedSignals) {
    return normalizedType;
  }

  if (isLikelyProofOfAddressNormalized(normalizedSignals)) {
    return 'JUSTIFICATIF_DOMICILE';
  }

  return normalizedType;
}

const CATEGORY_ALLOWED_TYPES = {
  identity: new Set(['CARTE_IDENTITE']),
  resources: new Set([
    'BULLETIN_SALAIRE',
    'AVIS_IMPOSITION',
    'ATTESTATION_BOURSE',
    'AIDE_LOGEMENT',
    'PENSION',
    'CONTRAT_TRAVAIL',
    'JUSTIFICATIF_DOMICILE',
    'CERTIFICAT_VISALE',
  ]),
  guarantor: new Set([
    'CARTE_IDENTITE',
    'BULLETIN_SALAIRE',
    'AVIS_IMPOSITION',
    'CONTRAT_TRAVAIL',
    'JUSTIFICATIF_DOMICILE',
    'PENSION',
  ]),
};

function isDocumentTypeCompatibleWithUploadCategory(uploadCategory, documentType) {
  const normalizedType = normalizeAnalysisDocumentType(documentType);
  const allowedTypes = CATEGORY_ALLOWED_TYPES[uploadCategory];
  return Boolean(allowedTypes && allowedTypes.has(normalizedType));
}

function isChecklistItemCompatibleWithUploadCategory(item, uploadCategory) {
  if (!item) return false;

  const normalizedCategory = normalizeComparableValue(item.category);
  if (uploadCategory === 'identity') {
    return normalizedCategory === 'IDENTITE';
  }
  if (uploadCategory === 'resources') {
    return ['ACTIVITE', 'RESSOURCES', 'DOMICILE'].includes(normalizedCategory);
  }
  if (uploadCategory === 'guarantor') {
    return normalizedCategory === 'GARANTIE';
  }

  return false;
}

function getChecklistIdForDocumentType(documentType, uploadCategory) {
  const normalizedType = normalizeAnalysisDocumentType(documentType);

  if (normalizedType === 'CARTE_IDENTITE') {
    return uploadCategory === 'guarantor' ? 'garant_id' : uploadCategory === 'identity' ? 'cni' : null;
  }
  if (normalizedType === 'BULLETIN_SALAIRE') {
    return uploadCategory === 'guarantor' ? 'garant_salaires' : uploadCategory === 'resources' ? 'salaire' : null;
  }
  if (normalizedType === 'AVIS_IMPOSITION') {
    return uploadCategory === 'resources' ? 'avis_imposition' : null;
  }
  if (normalizedType === 'ATTESTATION_BOURSE') {
    return uploadCategory === 'resources' ? 'bourse' : null;
  }
  if (normalizedType === 'AIDE_LOGEMENT') {
    return uploadCategory === 'resources' ? 'caf' : null;
  }
  if (normalizedType === 'PENSION') {
    return uploadCategory === 'resources' ? 'pension' : null;
  }
  if (normalizedType === 'CONTRAT_TRAVAIL') {
    return uploadCategory === 'resources' ? 'contrat' : null;
  }
  if (normalizedType === 'JUSTIFICATIF_DOMICILE') {
    return uploadCategory === 'guarantor' ? 'garant_domicile' : uploadCategory === 'resources' ? 'domicile' : null;
  }
  if (normalizedType === 'CERTIFICAT_VISALE') {
    return uploadCategory === 'resources' ? 'visale' : null;
  }

  return null;
}

function buildCategoryMismatchMessage(uploadCategory, documentType) {
  const normalizedType = normalizeAnalysisDocumentType(documentType);

  if (normalizedType === 'AUTRE') {
    if (uploadCategory === 'identity') {
      return "Ce fichier ne ressemble pas a une piece d'identite exploitable. Deposez ici uniquement une CNI ou un passeport lisible.";
    }
    if (uploadCategory === 'guarantor') {
      return "Ce fichier ne ressemble pas a une piece justificative du garant. Ajoutez plutot son identite, ses revenus ou son justificatif de domicile.";
    }
    return "Ce fichier ne ressemble pas a un document utile pour un dossier de location. Ajoutez plutot un justificatif de revenus, d'activite, de domicile ou Visale.";
  }

  if (uploadCategory === 'identity') {
    return "Ce document ne correspond pas a la section Identite. Deposez ici uniquement une piece d'identite officielle.";
  }
  if (uploadCategory === 'guarantor') {
    return 'Ce document n appartient pas a la section Garant. Deposez ici uniquement les justificatifs du garant.';
  }
  return 'Ce document ne correspond pas a la section Revenus et justificatifs. Deposez-le dans la section adaptee.';
}

function computeLegacyConfidenceScore({
  fraudScore = 0,
  needsHumanReview = false,
  partialExtraction = false,
  categoryMatch = true,
  recognizedType = true,
  isIllegible = false,
}) {
  if (isIllegible) return 0;

  let score = clamp(100 - Number(fraudScore || 0), 0, 100);
  if (!recognizedType) score = Math.min(score, 35);
  if (!categoryMatch) score = Math.min(score, 25);
  if (partialExtraction) score = Math.min(score, 75);
  if (needsHumanReview) score = Math.min(score, 79);
  return Math.round(score);
}

function getDocumentCertificationDecision({
  uploadCategory,
  aiDocumentType,
  fraudScore = 0,
  isIllegible = false,
  needsHumanReview = false,
  partialExtraction = false,
  hasCompatibleChecklistHint = false,
}) {
  const normalizedType = normalizeAnalysisDocumentType(aiDocumentType);
  const recognizedType = normalizedType !== 'AUTRE';
  const categoryMatch = isDocumentTypeCompatibleWithUploadCategory(uploadCategory, normalizedType);
  const hasRelevantHint = Boolean(hasCompatibleChecklistHint);
  const isRelevantDocument = (recognizedType && categoryMatch) || hasRelevantHint;

  if (isIllegible) {
    return {
      normalizedType,
      recognizedType,
      categoryMatch,
      isRelevantDocument: false,
      status: 'ILLEGIBLE',
      flagged: false,
      canForceSend: false,
      reason: '',
      confidenceScore: 0,
    };
  }

  if (recognizedType && !categoryMatch) {
    return {
      normalizedType,
      recognizedType,
      categoryMatch,
      isRelevantDocument: false,
      status: 'REJECTED',
      flagged: false,
      canForceSend: false,
      reason: buildCategoryMismatchMessage(uploadCategory, normalizedType),
      confidenceScore: computeLegacyConfidenceScore({
        fraudScore,
        needsHumanReview,
        partialExtraction,
        categoryMatch: false,
        recognizedType,
      }),
    };
  }

  if (!recognizedType && !hasRelevantHint) {
    return {
      normalizedType,
      recognizedType,
      categoryMatch: false,
      isRelevantDocument: false,
      status: 'REJECTED',
      flagged: false,
      canForceSend: false,
      reason: buildCategoryMismatchMessage(uploadCategory, normalizedType),
      confidenceScore: computeLegacyConfidenceScore({
        fraudScore,
        needsHumanReview,
        partialExtraction,
        categoryMatch: false,
        recognizedType: false,
      }),
    };
  }

  if (Number(fraudScore || 0) > 90) {
    return {
      normalizedType,
      recognizedType,
      categoryMatch,
      isRelevantDocument,
      status: 'REJECTED',
      flagged: true,
      canForceSend: false,
      reason: 'Le document presente trop d anomalies techniques pour etre retenu tel quel. Remplacez-le par un original numerique ou un scan plus net.',
      confidenceScore: computeLegacyConfidenceScore({
        fraudScore,
        needsHumanReview,
        partialExtraction,
        categoryMatch,
        recognizedType,
      }),
    };
  }

  if (needsHumanReview || partialExtraction || Number(fraudScore || 0) > 20 || !recognizedType) {
    return {
      normalizedType,
      recognizedType,
      categoryMatch,
      isRelevantDocument,
      status: 'NEEDS_REVIEW',
      flagged: Number(fraudScore || 0) > 50,
      canForceSend: true,
      reason: !recognizedType
        ? 'Le fichier semble proche d un justificatif attendu, mais le type n a pas ete confirme automatiquement. Verifiez-le ou envoyez-le pour revue humaine.'
        : 'Le document a ete recu mais une verification complementaire est recommandee avant certification.',
      confidenceScore: computeLegacyConfidenceScore({
        fraudScore,
        needsHumanReview: true,
        partialExtraction,
        categoryMatch,
        recognizedType,
      }),
    };
  }

  return {
    normalizedType,
    recognizedType,
    categoryMatch,
    isRelevantDocument,
    status: 'CERTIFIED',
    flagged: false,
    canForceSend: false,
    reason: '',
    confidenceScore: computeLegacyConfidenceScore({
      fraudScore,
      needsHumanReview: false,
      partialExtraction,
      categoryMatch,
      recognizedType,
    }),
  };
}

module.exports = {
  buildCategoryMismatchMessage,
  computeLegacyConfidenceScore,
  getChecklistIdForDocumentType,
  getDocumentCertificationDecision,
  inferAnalysisDocumentTypeFromSignals,
  isChecklistItemCompatibleWithUploadCategory,
  isDocumentTypeCompatibleWithUploadCategory,
  isLikelyProofOfAddressNormalized,
  normalizeAnalysisDocumentType,
  normalizeComparableValue,
};
