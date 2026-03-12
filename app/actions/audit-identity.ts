'use server';

import { validateMRZ, compareMRZWithIdentity } from './validate-mrz';

/**
 * Server Action pour l'Audit d'Identité PatrimoTrust
 * Fallback quand Didit n'est pas disponible ou échoue
 * 
 * Méthodes de vérification :
 * 1. Validation MRZ de la CNI (checksums cryptographiques)
 * 2. Cross-check OCR entre CNI, avis d'imposition et bulletins de salaire
 * 3. Validation 2D-Doc si présent sur les documents fiscaux
 */

interface DocumentData {
  type: 'CNI' | 'PASSEPORT' | 'AVIS_IMPOSITION' | 'BULLETIN_SALAIRE' | 'AUTRE';
  fileName: string;
  extractedName?: string;
  extractedFirstName?: string;
  extractedLastName?: string;
  extractedBirthDate?: string;
  mrzLines?: string[]; // Pour CNI/Passeport
  has2DDoc?: boolean;
  docAuthenticated?: boolean; // Si 2D-Doc validé
  rawText?: string;
}

interface AuditResult {
  success: boolean;
  verificationLevel: 'VERIFIED_DIDIT' | 'VERIFIED_AUDIT' | 'PARTIAL_AUDIT' | 'FAILED';
  score: number; // 0-100
  patrimometerPoints: number; // Points à ajouter au PatrimoMeter
  badge?: string;
  identity: {
    firstName: string;
    lastName: string;
    birthDate?: string;
    source: string; // D'où vient l'identité validée
  } | null;
  checks: {
    mrzValidation: {
      performed: boolean;
      valid: boolean;
      score: number;
      details: string[];
    };
    nameConsistency: {
      performed: boolean;
      valid: boolean;
      score: number;
      matchingDocuments: string[];
      details: string[];
    };
    doc2DValidation: {
      performed: boolean;
      valid: boolean;
      authenticatedBy: string[];
      details: string[];
    };
  };
  expertAdvice: string;
  requiresManualReview: boolean;
  errors: string[];
}

/**
 * Normalise un nom pour la comparaison
 */
function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^A-Z\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compare deux noms avec tolérance
 */
function compareNames(name1: string, name2: string): { match: boolean; confidence: number } {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  if (n1 === n2) {
    return { match: true, confidence: 100 };
  }
  
  // Vérifier si l'un contient l'autre (cas des noms composés)
  if (n1.includes(n2) || n2.includes(n1)) {
    return { match: true, confidence: 80 };
  }
  
  // Calculer la distance de Levenshtein pour les petites erreurs OCR
  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similarity = ((maxLen - distance) / maxLen) * 100;
  
  if (similarity >= 85) {
    return { match: true, confidence: Math.round(similarity) };
  }
  
  return { match: false, confidence: Math.round(similarity) };
}

/**
 * Distance de Levenshtein pour mesurer la similarité
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Extrait les noms depuis un texte OCR
 */
function extractNamesFromOCR(text: string, documentType: string): { firstName?: string; lastName?: string } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Patterns communs selon le type de document
  const patterns = {
    avisImposition: [
      /(?:Nom|NOM)\s*(?:de famille|:)?\s*[:\s]*([A-ZÀ-Ÿ\-\s]+)/i,
      /(?:Prénom|PRENOM)\s*[:\s]*([A-ZÀ-Ÿa-zà-ÿ\-\s]+)/i,
      /Déclarant\s*(?:1|principal)?\s*[:\s]*([A-ZÀ-Ÿ\-\s]+)\s+([A-Za-zà-ÿ\-\s]+)/i,
    ],
    bulletinSalaire: [
      /(?:Nom|NOM)\s*[:\s]*([A-ZÀ-Ÿ\-\s]+)/i,
      /(?:Prénom|PRENOM)\s*[:\s]*([A-Za-zà-ÿ\-\s]+)/i,
      /Salarié\s*[:\s]*([A-ZÀ-Ÿ\-\s]+)\s+([A-Za-zà-ÿ\-\s]+)/i,
    ]
  };
  
  let firstName: string | undefined;
  let lastName: string | undefined;
  
  const docPatterns = documentType.includes('IMPOSITION') 
    ? patterns.avisImposition 
    : patterns.bulletinSalaire;
  
  for (const line of lines) {
    for (const pattern of docPatterns) {
      const match = line.match(pattern);
      if (match) {
        if (match[2]) {
          // Pattern avec nom et prénom
          lastName = match[1].trim();
          firstName = match[2].trim();
        } else if (pattern.source.includes('Prénom')) {
          firstName = match[1].trim();
        } else {
          lastName = match[1].trim();
        }
      }
    }
    
    if (firstName && lastName) break;
  }
  
  return { firstName, lastName };
}

/**
 * Audit d'identité principal
 */
export async function auditIdentity(
  documents: DocumentData[],
  referenceIdentity?: { firstName: string; lastName: string; birthDate?: string }
): Promise<AuditResult> {
  const errors: string[] = [];
  const checks: AuditResult['checks'] = {
    mrzValidation: { performed: false, valid: false, score: 0, details: [] },
    nameConsistency: { performed: false, valid: false, score: 0, matchingDocuments: [], details: [] },
    doc2DValidation: { performed: false, valid: false, authenticatedBy: [], details: [] }
  };
  
  let extractedIdentity: AuditResult['identity'] = null;
  let totalScore = 0;
  
  // 1. Rechercher et valider la MRZ (CNI ou Passeport)
  const identityDoc = documents.find(d => d.type === 'CNI' || d.type === 'PASSEPORT');
  
  if (identityDoc?.mrzLines && identityDoc.mrzLines.length >= 2) {
    checks.mrzValidation.performed = true;
    
    const mrzResult = await validateMRZ(
      identityDoc.mrzLines[0],
      identityDoc.mrzLines[1],
      identityDoc.mrzLines[2] // Pour CNI
    );
    
    if (mrzResult.isValid && mrzResult.extractedData) {
      checks.mrzValidation.valid = true;
      checks.mrzValidation.score = mrzResult.score;
      checks.mrzValidation.details.push('✅ MRZ validée avec succès (checksums corrects)');
      checks.mrzValidation.details.push(`Identité extraite: ${mrzResult.extractedData.firstName} ${mrzResult.extractedData.lastName}`);
      
      extractedIdentity = {
        firstName: mrzResult.extractedData.firstName,
        lastName: mrzResult.extractedData.lastName,
        birthDate: mrzResult.extractedData.birthDate,
        source: 'MRZ CNI/Passeport'
      };
      
      totalScore += 40; // MRZ valide = 40 points de confiance
    } else {
      checks.mrzValidation.details.push('❌ Validation MRZ échouée');
      checks.mrzValidation.details.push(...mrzResult.errors);
    }
    
    // Si on a une identité de référence (ex: depuis Didit précédent ou saisi par l'utilisateur)
    if (referenceIdentity && mrzResult.extractedData) {
      const comparison = await compareMRZWithIdentity(mrzResult.extractedData, referenceIdentity);
      if (comparison.matches) {
        checks.mrzValidation.details.push('✅ Identité MRZ correspond à l\'identité de référence');
        totalScore += 10;
      } else {
        checks.mrzValidation.details.push('⚠️ Identité MRZ diffère de l\'identité de référence');
        checks.mrzValidation.details.push(...comparison.details);
      }
    }
  }
  
  // 2. Cross-check des noms sur tous les documents
  const nameExtractions: { docName: string; firstName?: string; lastName?: string }[] = [];
  
  for (const doc of documents) {
    if (doc.extractedFirstName || doc.extractedLastName) {
      nameExtractions.push({
        docName: doc.fileName,
        firstName: doc.extractedFirstName,
        lastName: doc.extractedLastName
      });
    } else if (doc.rawText && (doc.type === 'AVIS_IMPOSITION' || doc.type === 'BULLETIN_SALAIRE')) {
      const extracted = extractNamesFromOCR(doc.rawText, doc.type);
      if (extracted.firstName || extracted.lastName) {
        nameExtractions.push({
          docName: doc.fileName,
          ...extracted
        });
      }
    }
  }
  
  if (nameExtractions.length >= 2) {
    checks.nameConsistency.performed = true;
    
    // Comparer tous les noms extraits entre eux
    let consistencyScore = 0;
    let matchCount = 0;
    
    // Utiliser le premier document comme référence ou l'identité MRZ si disponible
    const referenceDoc = extractedIdentity 
      ? { docName: 'MRZ', firstName: extractedIdentity.firstName, lastName: extractedIdentity.lastName }
      : nameExtractions[0];
    
    for (let i = extractedIdentity ? 0 : 1; i < nameExtractions.length; i++) {
      const doc = nameExtractions[i];
      
      let docMatch = true;
      
      if (referenceDoc.lastName && doc.lastName) {
        const lastNameMatch = compareNames(referenceDoc.lastName, doc.lastName);
        if (lastNameMatch.match) {
          checks.nameConsistency.details.push(`✅ ${doc.docName}: Nom correspond (${lastNameMatch.confidence}%)`);
        } else {
          checks.nameConsistency.details.push(`❌ ${doc.docName}: Nom ne correspond pas (${referenceDoc.lastName} ≠ ${doc.lastName})`);
          docMatch = false;
        }
      }
      
      if (referenceDoc.firstName && doc.firstName) {
        const firstNameMatch = compareNames(referenceDoc.firstName, doc.firstName);
        if (firstNameMatch.match) {
          checks.nameConsistency.details.push(`✅ ${doc.docName}: Prénom correspond (${firstNameMatch.confidence}%)`);
        } else {
          checks.nameConsistency.details.push(`❌ ${doc.docName}: Prénom ne correspond pas (${referenceDoc.firstName} ≠ ${doc.firstName})`);
          docMatch = false;
        }
      }
      
      if (docMatch) {
        matchCount++;
        checks.nameConsistency.matchingDocuments.push(doc.docName);
        consistencyScore += 100 / (nameExtractions.length - 1);
      }
    }
    
    checks.nameConsistency.score = Math.round(consistencyScore);
    checks.nameConsistency.valid = consistencyScore >= 80;
    
    if (checks.nameConsistency.valid) {
      totalScore += 30;
    } else if (consistencyScore >= 50) {
      totalScore += 15;
    }
  }
  
  // 3. Vérification 2D-Doc
  const docsWithSeal = documents.filter(d => d.has2DDoc);
  
  if (docsWithSeal.length > 0) {
    checks.doc2DValidation.performed = true;
    
    for (const doc of docsWithSeal) {
      if (doc.docAuthenticated) {
        checks.doc2DValidation.valid = true;
        checks.doc2DValidation.authenticatedBy.push(doc.fileName);
        checks.doc2DValidation.details.push(`✅ ${doc.fileName}: Sceau 2D-Doc authentifié`);
        totalScore += 15;
      } else {
        checks.doc2DValidation.details.push(`❌ ${doc.fileName}: Sceau 2D-Doc invalide ou non vérifié`);
      }
    }
  }
  
  // Calculer le niveau de vérification et les points PatrimoMeter
  let verificationLevel: AuditResult['verificationLevel'];
  let patrimometerPoints: number;
  let badge: string | undefined;
  let expertAdvice: string;
  let requiresManualReview = false;
  
  if (totalScore >= 80) {
    verificationLevel = 'VERIFIED_AUDIT';
    patrimometerPoints = 30;
    badge = 'Identité Auditée & Cohérente';
    expertAdvice = 'Excellent ! L\'audit documentaire confirme la cohérence de votre identité sur l\'ensemble des documents. Votre dossier gagne en crédibilité.';
  } else if (totalScore >= 50) {
    verificationLevel = 'PARTIAL_AUDIT';
    patrimometerPoints = 15;
    badge = 'Audit Partiel';
    expertAdvice = 'L\'audit a pu vérifier certains éléments, mais des incohérences mineures ont été détectées. Une vérification Didit reste recommandée pour maximiser votre score.';
    requiresManualReview = true;
  } else {
    verificationLevel = 'FAILED';
    patrimometerPoints = 0;
    expertAdvice = 'L\'audit n\'a pas pu confirmer la cohérence de votre identité. Veuillez vérifier que tous vos documents sont lisibles et au même nom. Une certification Didit est fortement recommandée.';
    requiresManualReview = true;
    errors.push('Audit d\'identité échoué: cohérence insuffisante entre les documents');
  }
  
  // Si aucune identité n'a pu être extraite, utiliser la référence ou créer depuis les documents
  if (!extractedIdentity && nameExtractions.length > 0) {
    extractedIdentity = {
      firstName: nameExtractions[0].firstName || '',
      lastName: nameExtractions[0].lastName || '',
      source: 'OCR Documents'
    };
  }
  
  return {
    success: verificationLevel === 'VERIFIED_AUDIT',
    verificationLevel,
    score: totalScore,
    patrimometerPoints,
    badge,
    identity: extractedIdentity,
    checks,
    expertAdvice,
    requiresManualReview,
    errors
  };
}

/**
 * Audit simplifié pour le garant (documents uploadés)
 */
export async function auditGuarantorIdentity(
  guarantorId: string,
  uploadedDocuments: Array<{
    fileName: string;
    type: string;
    analysisResult?: {
      document_metadata?: { owner_name: string };
      trust_and_security?: { digital_seal_authenticated?: boolean };
    };
    mrzLines?: string[];
  }>
): Promise<AuditResult> {
  // Convertir les documents uploadés au format attendu
  const documents: DocumentData[] = uploadedDocuments.map(doc => {
    const docType = doc.type.toUpperCase();
    let type: DocumentData['type'] = 'AUTRE';
    
    if (docType.includes('CNI') || docType.includes('CARTE')) {
      type = 'CNI';
    } else if (docType.includes('PASSEPORT')) {
      type = 'PASSEPORT';
    } else if (docType.includes('IMPOSITION')) {
      type = 'AVIS_IMPOSITION';
    } else if (docType.includes('SALAIRE') || docType.includes('BULLETIN')) {
      type = 'BULLETIN_SALAIRE';
    }
    
    // Extraire nom/prénom depuis owner_name
    let extractedFirstName: string | undefined;
    let extractedLastName: string | undefined;
    
    if (doc.analysisResult?.document_metadata?.owner_name) {
      const parts = doc.analysisResult.document_metadata.owner_name.split(' ');
      if (parts.length >= 2) {
        extractedLastName = parts[0];
        extractedFirstName = parts.slice(1).join(' ');
      }
    }
    
    return {
      type,
      fileName: doc.fileName,
      extractedFirstName,
      extractedLastName,
      mrzLines: doc.mrzLines,
      has2DDoc: !!doc.analysisResult?.trust_and_security?.digital_seal_authenticated,
      docAuthenticated: doc.analysisResult?.trust_and_security?.digital_seal_authenticated
    };
  });
  
  return auditIdentity(documents);
}
