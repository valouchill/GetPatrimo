/**
 * Service d'analyse Vision : appel GPT-4o, normalisation des résultats,
 * et compatibilité legacy. Extrait de app/api/analyze-document-v2/route.ts.
 */

const {
  computeLegacyConfidenceScore,
  getDocumentCertificationDecision,
  inferAnalysisDocumentTypeFromSignals,
  normalizeAnalysisDocumentType,
  buildCategoryMismatchMessage,
} = require('../utils/documentCertificationRules');

const {
  getDocumentIncomeContribution,
  pickBestDocumentNetIncome,
} = require('../utils/financialExtraction');

const { recordLlmCost } = require('./api-cost-logger');

const AI_TIMEOUT_MS = 55_000;

/**
 * Normalise un montant financier : supprime les symboles €, transforme les virgules en points.
 * @param {string|number|undefined|null} value
 * @returns {number}
 */
function normalizeAmount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;

  let cleaned = String(value)
    .trim()
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.');

  const parts = cleaned.split('.');
  if (parts.length > 2) {
    cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Construit le payload de compatibilité legacy à partir de NormalizedDocumentAnalysis.
 * @param {object} result - NormalizedDocumentAnalysis
 * @param {string|null} documentCategory
 * @returns {object}
 */
function buildLegacyCompatibilityPayload(result, documentCategory) {
  const normalizedType = normalizeAnalysisDocumentType(result.document_metadata.type);
  const decision = documentCategory
    ? getDocumentCertificationDecision({
        uploadCategory: documentCategory,
        aiDocumentType: normalizedType,
        fraudScore: result.trust_and_security.fraud_score || 0,
        isIllegible: false,
        needsHumanReview: Boolean(result.trust_and_security.needs_human_review),
        partialExtraction: Boolean(result.trust_and_security.partial_extraction),
        hasCompatibleChecklistHint: false,
      })
    : null;

  const confidenceScore = computeLegacyConfidenceScore({
    fraudScore: result.trust_and_security.fraud_score || 0,
    needsHumanReview: Boolean(result.trust_and_security.needs_human_review),
    partialExtraction: Boolean(result.trust_and_security.partial_extraction),
    categoryMatch: decision ? decision.categoryMatch : true,
    recognizedType: normalizedType !== 'AUTRE',
    isIllegible: false,
  });

  const categoryMismatchReason =
    decision && !decision.categoryMatch
      ? buildCategoryMismatchMessage(documentCategory, normalizedType)
      : '';

  return {
    documentType: normalizedType,
    ownerName: result.document_metadata.owner_name,
    date: result.document_metadata.date_emission,
    suggestedFileName: result.document_metadata.suggested_file_name,
    confidenceScore,
    recommendations: [result.ai_analysis.expert_advice].filter(Boolean),
    fraudIndicators: {
      suspicious: (result.trust_and_security.fraud_score || 0) > 30,
      reasons: result.trust_and_security.forensic_alerts || [],
    },
    fraudScore: result.trust_and_security.fraud_score || 0,
    categoryMatch: decision ? decision.categoryMatch : true,
    categoryMismatchReason,
  };
}

/**
 * Normalise et valide la structure NormalizedDocumentAnalysis retournée par l'IA.
 * @param {any} rawResult
 * @param {{firstName?:string|null, lastName?:string|null, birthDate?:string|null}|undefined} diditIdentity
 * @param {string|null} fileName
 * @returns {object} NormalizedDocumentAnalysis
 */
/**
 * Pièces qu'un bailleur n'a pas le droit d'exiger (décret n° 2015-1437) — AIPD action n°12.
 * Détection sur le type BRUT renvoyé par l'IA (avant inférence), car l'inférence par signaux
 * peut rabattre un libellé inconnu vers AUTRE.
 */
const FORBIDDEN_DOC_LABEL = 'PIECE_INTERDITE';
const FORBIDDEN_DOC_PATTERNS = /(piece[_\s]?interdite|relev[ée][^a-z]{0,3}(de[^a-z]{0,3})?compte|bancaire|bonne tenue de compte|m[ée]dical|carte vitale|s[ée]curit[ée] sociale|casier judiciaire|contrat de mariage|jugement de divorce)/i;

function isForbiddenDocumentLabel(label) {
  const t = String(label || '').trim();
  if (!t) return false;
  return t.toUpperCase() === FORBIDDEN_DOC_LABEL || FORBIDDEN_DOC_PATTERNS.test(t);
}

/** Neutralise une analyse portant sur une pièce interdite : aucune PII conservée. */
function applyForbiddenDocumentPolicy(normalized) {
  normalized.document_metadata.type = FORBIDDEN_DOC_LABEL;
  normalized.document_metadata.owner_name = '';
  normalized.document_metadata.is_owner_match = false;
  normalized.financial_data.monthly_net_income = 0;
  normalized.financial_data.extra_details = {};
  normalized.trust_and_security.fraud_score = 0;
  normalized.trust_and_security.extracted_fields = [];
  normalized.trust_and_security.forensic_alerts = [
    'Pièce non autorisée (décret n° 2015-1437) : un bailleur ne peut pas exiger ce document. Elle n\'est pas conservée.',
  ];
  normalized.ai_analysis = normalized.ai_analysis || {};
  normalized.ai_analysis.expert_advice =
    'Ce document (relevé bancaire, pièce médicale, casier judiciaire…) ne peut pas être exigé pour un dossier de location — il n\'est pas conservé. Fournissez uniquement les pièces demandées (identité, revenus, domicile).';
  normalized.isForbiddenDocument = true;
  return normalized;
}

function normalizeAndValidateAnalysis(rawResult, diditIdentity, fileName) {
  // Type BRUT (avant inférence par signaux) pour la détection des pièces interdites.
  const rawAiType = rawResult?.document_metadata?.type || rawResult?.documentType || '';
  if (rawResult.document_metadata && rawResult.financial_data) {
    const normalized = rawResult;
    normalized.trust_and_security = normalized.trust_and_security || {};
    // Sécurité (pentest recent-2) : contrôle serveur INDÉPENDANT du label IA. Si le texte
    // extrait trahit une pièce interdite (relevé bancaire, casier…) — même si l'IA ne l'a
    // pas étiquetée PIECE_INTERDITE (prompt-injection possible) — on applique la politique.
    const extractedTextBlob = [
      normalized.document_metadata && normalized.document_metadata.suggested_file_name,
      normalized.document_metadata && normalized.document_metadata.owner_name,
      normalized.ai_analysis && normalized.ai_analysis.expert_advice,
      normalized.ai_analysis && normalized.ai_analysis.improvement_tip,
    ].filter(Boolean).join(' ');
    if (isForbiddenDocumentLabel(rawAiType) || FORBIDDEN_DOC_PATTERNS.test(extractedTextBlob)) {
      return applyForbiddenDocumentPolicy(normalized);
    }

    normalized.document_metadata.type = inferAnalysisDocumentTypeFromSignals({
      aiDocumentType: normalized.document_metadata.type,
      fileName,
      rawText: [
        normalized.document_metadata.suggested_file_name,
        normalized.document_metadata.owner_name,
        normalized.ai_analysis?.expert_advice,
        normalized.ai_analysis?.improvement_tip,
      ].filter(Boolean).join(' '),
    });

    normalized.financial_data.monthly_net_income = normalizeAmount(normalized.financial_data.monthly_net_income);

    if (normalized.financial_data.extra_details) {
      const ed = normalized.financial_data.extra_details;
      ed.brut_annuel = normalizeAmount(ed.brut_annuel);
      ed.revenu_fiscal_reference = normalizeAmount(ed.revenu_fiscal_reference);
      ed.salaire_brut_mensuel = normalizeAmount(ed.salaire_brut_mensuel);
      ed.cotisations_mensuelles = normalizeAmount(ed.cotisations_mensuelles);
      ed.montant_bourse = normalizeAmount(ed.montant_bourse);
      ed.montant_apl = normalizeAmount(ed.montant_apl);
      ed.montant_pension = normalizeAmount(ed.montant_pension);
    }

    const repairedIncome = pickBestDocumentNetIncome({
      documentType: normalized.document_metadata.type,
      financialData: normalized.financial_data,
    });
    if (repairedIncome.amount > 0) {
      normalized.financial_data.monthly_net_income = repairedIncome.amount;
    }

    if (diditIdentity?.firstName && diditIdentity?.lastName) {
      const diditName = `${diditIdentity.lastName} ${diditIdentity.firstName}`.toUpperCase();
      const ownerName = normalized.document_metadata.owner_name.toUpperCase();
      normalized.document_metadata.is_owner_match = ownerName.includes(diditName) || diditName.includes(ownerName);
    }

    return normalized;
  }

  // Compatibilité avec l'ancienne structure
  const legacy = rawResult;
  const docType = inferAnalysisDocumentTypeFromSignals({
    aiDocumentType: legacy.documentType,
    fileName,
    rawText: [legacy.ownerName, legacy.suggestedFileName, legacy.recommendations?.join(' ')]
      .filter(Boolean).join(' '),
  });

  const resolvedLegacyIncome = getDocumentIncomeContribution({ documentType: docType, analysis: legacy });
  const monthlyNetIncome = normalizeAmount(resolvedLegacyIncome.amount);

  let detectedProfile = 'UNKNOWN';
  if (legacy.personaMatch?.detectedProfile) {
    const p = legacy.personaMatch.detectedProfile.toLowerCase();
    if (p.includes('student') || p.includes('étudiant')) detectedProfile = 'STUDENT';
    else if (p.includes('salaried') || p.includes('salarié')) detectedProfile = 'SALARIED';
    else if (p.includes('independent') || p.includes('indépendant')) detectedProfile = 'INDEPENDENT';
    else if (p.includes('retired') || p.includes('retraité')) detectedProfile = 'RETIRED';
  }

  let isOwnerMatch = false;
  if (diditIdentity?.firstName && diditIdentity?.lastName) {
    const diditName = `${diditIdentity.lastName} ${diditIdentity.firstName}`.toUpperCase();
    const ownerName = (legacy.ownerName || '').toUpperCase();
    isOwnerMatch = ownerName.includes(diditName) || diditName.includes(ownerName);
  }

  const forensicAlerts = [];
  if (legacy.fraudAudit) {
    ['structureAnalysis', 'mathematicalAudit', 'consistencyCheck', 'metadataAnalysis'].forEach(k => {
      if (legacy.fraudAudit[k]?.details) forensicAlerts.push(...legacy.fraudAudit[k].details);
    });
  }
  if (legacy.fraudIndicators?.reasons) forensicAlerts.push(...legacy.fraudIndicators.reasons);

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
      is_recurring: ['BULLETIN_SALAIRE', 'PENSION', 'ATTESTATION_BOURSE', 'AIDE_LOGEMENT'].includes(docType),
      extra_details: {
        brut_annuel: legacy.extractedData?.salaireBrut ? normalizeAmount(legacy.extractedData.salaireBrut) * 12 : undefined,
        revenu_fiscal_reference: undefined,
        nombre_mois_payes: 12,
        salaire_brut_mensuel: normalizeAmount(legacy.extractedData?.salaireBrut),
        cotisations_mensuelles: normalizeAmount(legacy.extractedData?.cotisations),
        montant_bourse: docType === 'ATTESTATION_BOURSE' ? monthlyNetIncome : undefined,
        montant_apl: docType === 'AIDE_LOGEMENT' ? monthlyNetIncome : undefined,
        montant_pension: docType === 'PENSION' ? monthlyNetIncome : undefined,
        // Employeur (raison sociale) capté par l'OCR → exposé pour la Synthèse du passeport.
        employeur:
          (legacy.extractedData &&
            (legacy.extractedData.companyName ||
              legacy.extractedData.employeur ||
              legacy.extractedData.employerName)) ||
          legacy.companyName ||
          legacy.employerName ||
          undefined,
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
 * Appelle GPT-4o Vision et retourne la structure NormalizedDocumentAnalysis.
 * @param {string[]} images - Images base64
 * @param {string} prompt
 * @param {string} openaiApiKey
 * @param {{creator?:string, producer?:string, suspicious:boolean, details:string[]}|undefined} pdfMetadata
 * @param {{firstName?:string|null, lastName?:string|null, birthDate?:string|null}|undefined} diditIdentity
 * @param {string|null} fileName
 * @returns {Promise<object>} NormalizedDocumentAnalysis
 */
async function analyzeWithVision(images, prompt, openaiApiKey, pdfMetadata, diditIdentity, fileName) {
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

  const imageContent = images.map(img => ({
    type: 'image_url',
    image_url: { url: img, detail: 'high' },
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: enhancedPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyse ce document et retourne le JSON structuré demandé.' },
              ...imageContent,
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Erreur OpenAI (${response.status}): ${errorData.error?.message || 'Erreur inconnue'}`);
  }

  const data = await response.json();

  // Coût RÉEL de cet appel LLM, calculé depuis data.usage (fire-and-forget :
  // ne pas await — n'ajoute aucune latence et n'interrompt jamais l'analyse).
  recordLlmCost({ model: 'gpt-4o', usage: data.usage, category: 'LLM_VISION', meta: { fileName } });

  const resultText = data.choices?.[0]?.message?.content || '{}';

  let rawResult;
  try {
    rawResult = JSON.parse(resultText);
  } catch {
    // Tolérance : retirer d'éventuelles clôtures markdown ```json … ``` puis extraire l'objet
    // du premier '{' au dernier '}'.
    const cleaned = resultText.replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        rawResult = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        throw new Error('Réponse IA non parsable en JSON');
      }
    } else {
      throw new Error('Réponse IA non parsable en JSON');
    }
  }

  return normalizeAndValidateAnalysis(rawResult, diditIdentity, fileName);
}

module.exports = {
  normalizeAmount,
  buildLegacyCompatibilityPayload,
  normalizeAndValidateAnalysis,
  isForbiddenDocumentLabel,
  analyzeWithVision,
};
