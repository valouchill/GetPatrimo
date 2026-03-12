// Service IA pour l'extraction de données et détection de fraude documentaire (GetPatrimo)
const fs = require('fs');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

if (!OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY manquant: extraction IA désactivée");
}

/**
 * Convertit un fichier en base64 pour l'API OpenAI
 * @param {string} filePath - Chemin absolu du fichier
 * @returns {Promise<string>} - Base64 string avec préfixe data URI
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
 * Extrait les données d'un document avec audit approfondi selon le type
 * @param {string} filePath - Chemin absolu du fichier (PDF ou image)
 * @param {string} [documentType] - Type de document: 'id', 'payslip', 'tax', 'contract'
 * @returns {Promise<Object>} - Données extraites avec scores et alertes
 */
async function extractDocumentData(filePath, documentType = 'auto') {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY non configurée");
  }

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("Fichier introuvable");
    }

    const base64Image = await fileToBase64(filePath);

    // Appel à l'API OpenAI Vision (gpt-4o)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: getExtractionPrompt(documentType)
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erreur API OpenAI: ${response.status} - ${errorData.error?.message || 'Erreur inconnue'}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    // Parse la réponse JSON
    let extracted;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        extracted = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Erreur parsing réponse OpenAI:", content);
      throw new Error("Impossible de parser la réponse de l'IA. Le document est peut-être illisible.");
    }

    // Normalise et valide les données selon le type
    if (documentType === 'id') {
      return normalizeIdData(extracted);
    } else if (documentType === 'payslip') {
      return normalizePayslipData(extracted);
    } else {
      return normalizeGenericData(extracted);
    }
  } catch (error) {
    if (error.message.includes('illisible') || error.message.includes('parse')) {
      throw new Error("Le document est illisible ou corrompu. Veuillez vérifier que le fichier est un PDF ou une image valide.");
    }
    throw error;
  }
}

/**
 * Normalise les données d'une pièce d'identité avec vérifications de fraude
 */
function normalizeIdData(extracted) {
  return {
    firstName: String(extracted.firstName || '').trim(),
    lastName: String(extracted.lastName || '').trim(),
    fullName: String(extracted.fullName || '').trim(),
    documentNumber: String(extracted.documentNumber || '').trim(),
    birthDate: String(extracted.birthDate || '').trim(),
    mrzLine1: String(extracted.mrzLine1 || '').trim(),
    mrzLine2: String(extracted.mrzLine2 || '').trim(),
    isMrzValid: extracted.isMrzValid === true,
    hasRetouchingSuspicion: extracted.hasRetouchingSuspicion === true,
    retouchingDetails: String(extracted.retouchingDetails || '').trim(),
    score: Number(extracted.score || 100),
    alerts: Array.isArray(extracted.alerts) ? extracted.alerts : []
  };
}

/**
 * Normalise les données d'une fiche de paie avec audits mathématiques
 */
function normalizePayslipData(extracted) {
  return {
    netSalary: Number(extracted.netSalary || 0) || 0,
    grossSalary: Number(extracted.grossSalary || 0) || 0,
    totalDeductions: Number(extracted.totalDeductions || 0) || 0,
    taxableIncome: Number(extracted.taxableIncome || 0) || 0,
    cumulativeTaxableIncome: Number(extracted.cumulativeTaxableIncome || 0) || 0,
    monthNumber: Number(extracted.monthNumber || 0) || 0,
    pasRate: Number(extracted.pasRate || 0) || 0,
    pasAmount: Number(extracted.pasAmount || 0) || 0,
    contractType: String(extracted.contractType || '').trim().toUpperCase() || '',
    siret: String(extracted.siret || '').trim().replace(/\s/g, '') || '',
    companyName: String(extracted.companyName || '').trim(),
    firstName: String(extracted.firstName || '').trim(),
    lastName: String(extracted.lastName || '').trim(),
    fullName: String(extracted.fullName || '').trim(),
    startDate: String(extracted.startDate || '').trim(),
    ancienneteMonths: Number(extracted.ancienneteMonths || 0) || 0,
    isProbationPeriod: extracted.isProbationPeriod === true,
    // Résultats des audits
    mathConsistencyCheck: extracted.mathConsistencyCheck || {},
    cumulativeConsistencyCheck: extracted.cumulativeConsistencyCheck || {},
    fiscalConsistencyCheck: extracted.fiscalConsistencyCheck || {},
    siretValidation: extracted.siretValidation || {},
    isValid: extracted.isValid !== false,
    score: Number(extracted.score || 100),
    alerts: Array.isArray(extracted.alerts) ? extracted.alerts : []
  };
}

/**
 * Normalise les données génériques
 */
function normalizeGenericData(extracted) {
  return {
    netSalary: Number(extracted.netSalary || 0) || 0,
    grossSalary: Number(extracted.grossSalary || 0) || 0,
    contractType: String(extracted.contractType || '').trim().toUpperCase() || '',
    siret: String(extracted.siret || '').trim().replace(/\s/g, '') || '',
    firstName: String(extracted.firstName || '').trim(),
    lastName: String(extracted.lastName || '').trim(),
    fullName: String(extracted.fullName || '').trim()
  };
}

/**
 * Génère le prompt d'extraction selon le type de document avec audits approfondis
 */
function getExtractionPrompt(documentType) {
  if (documentType === 'id') {
    return `Tu es un expert en détection de fraude documentaire bancaire. Analyse cette pièce d'identité (CNI, Passeport, Permis de conduire) et effectue les vérifications suivantes :

EXTRACTION DE DONNÉES :
1. Prénom (texte exact)
2. Nom de famille (texte exact)
3. Nom complet (prénom + nom)
4. Numéro de document
5. Date de naissance (format JJ/MM/AAAA)

DÉTECTION DE FRAUDE :
1. ANALYSE DE PIXELISATION : Examine la zone autour du nom et des chiffres. Si une zone semble plus floue, pixellisée ou modifiée (signes de retouche Photoshop), marque hasRetouchingSuspicion = true et décris les zones suspectes dans retouchingDetails.

2. VÉRIFICATION MRZ (Machine Readable Zone) : 
   - Extrais les deux lignes en bas du document (MRZ)
   - Vérifie si elles contiennent le nom et la date de naissance corrects
   - Marque isMrzValid = true uniquement si les données MRZ correspondent aux données visibles

3. SCORE D'AUTHENTICITÉ : Attribue un score de 0 à 100 selon la qualité et l'authenticité du document.

Réponds UNIQUEMENT au format JSON suivant :
{
  "firstName": "",
  "lastName": "",
  "fullName": "",
  "documentNumber": "",
  "birthDate": "",
  "mrzLine1": "",
  "mrzLine2": "",
  "isMrzValid": false,
  "hasRetouchingSuspicion": false,
  "retouchingDetails": "",
  "score": 100,
  "alerts": []
}

Si hasRetouchingSuspicion = true, ajoute une alerte : {"code": "RETOUCHING_SUSPICION", "severity": "critical", "message": "Suspicion de retouche détectée sur [zone]"}
Si isMrzValid = false, ajoute une alerte : {"code": "MRZ_INVALID", "severity": "critical", "message": "Les données MRZ ne correspondent pas aux données visibles"}`;

  } else if (documentType === 'payslip') {
    return `Tu es un expert en audit comptable et détection de fraude bancaire. Analyse cette fiche de paie et effectue les vérifications suivantes :

EXTRACTION DE DONNÉES :
1. Salaire Net mensuel (en euros)
2. Salaire Brut mensuel (en euros)
3. Total des cotisations/déductions (Brut - Net)
4. Revenu Net Imposable du mois
5. Cumul Annuel Imposable (depuis janvier)
6. Numéro du mois (1-12)
7. Taux PAS (Prélèvement à la Source) en %
8. Montant PAS prélevé
9. Type de contrat (CDI, CDD, etc.)
10. SIRET de l'employeur (14 chiffres)
11. Nom de l'entreprise
12. Prénom et Nom du salarié
13. Date de début de contrat
14. Ancienneté en mois
15. Période d'essai (true/false)

AUDITS DE COHÉRENCE (CRITIQUES) :

1. VÉRIFICATION MATHÉMATIQUE :
   Calcule : Salaire Brut - Total Cotisations = Salaire Net
   Si l'écart est > 2%, marque mathConsistencyCheck.isValid = false
   mathConsistencyCheck = {
     "isValid": true/false,
     "calculatedNet": [valeur calculée],
     "declaredNet": [valeur déclarée],
     "difference": [écart en euros],
     "differencePercent": [écart en %]
   }

2. VÉRIFICATION DU CUMUL :
   Calcule : Revenu Net Imposable × Numéro du mois ≈ Cumul Annuel Imposable
   Si l'écart est > 5%, marque cumulativeConsistencyCheck.isValid = false
   cumulativeConsistencyCheck = {
     "isValid": true/false,
     "expectedCumulative": [valeur attendue],
     "declaredCumulative": [valeur déclarée],
     "difference": [écart],
     "differencePercent": [écart en %]
   }

3. VÉRIFICATION FISCALE (PAS) :
   Vérifie : Revenu Net Imposable × (Taux PAS / 100) ≈ Montant PAS
   Si l'écart est > 3%, marque fiscalConsistencyCheck.isValid = false
   fiscalConsistencyCheck = {
     "isValid": true/false,
     "expectedPAS": [montant attendu],
     "declaredPAS": [montant déclaré],
     "difference": [écart]
   }

4. VÉRIFICATION SIRET :
   - Format : 14 chiffres exactement
   - Vérifie si le SIRET correspond au nom de l'entreprise
   siretValidation = {
     "isValid": true/false,
     "formatValid": true/false,
     "matchesCompany": true/false
   }

5. SCORE GLOBAL :
   - Score de base : 100
   - -20 points par incohérence mathématique
   - -15 points par incohérence de cumul
   - -10 points par incohérence fiscale
   - -10 points si SIRET invalide

Réponds UNIQUEMENT au format JSON suivant :
{
  "netSalary": 0,
  "grossSalary": 0,
  "totalDeductions": 0,
  "taxableIncome": 0,
  "cumulativeTaxableIncome": 0,
  "monthNumber": 0,
  "pasRate": 0,
  "pasAmount": 0,
  "contractType": "",
  "siret": "",
  "companyName": "",
  "firstName": "",
  "lastName": "",
  "fullName": "",
  "startDate": "",
  "ancienneteMonths": 0,
  "isProbationPeriod": false,
  "mathConsistencyCheck": {},
  "cumulativeConsistencyCheck": {},
  "fiscalConsistencyCheck": {},
  "siretValidation": {},
  "isValid": true,
  "score": 100,
  "alerts": []
}

Si une incohérence est détectée, ajoute une alerte dans le tableau alerts avec :
- code: "MATH_INCONSISTENCY", "CUMUL_INCONSISTENCY", "FISCAL_INCONSISTENCY", ou "SIRET_INVALID"
- severity: "critical" ou "warning"
- message: Description détaillée de l'incohérence`;

  } else {
    return `Extrais les informations suivantes de ce document professionnel :

1. Salaire Net mensuel (en euros)
2. Salaire Brut mensuel (en euros)
3. Type de contrat (CDI, CDD, ou Autre)
4. SIRET de l'employeur (14 chiffres)
5. Prénom du titulaire (si visible)
6. Nom de famille du titulaire (si visible)
7. Nom complet du titulaire (si visible)

Réponds UNIQUEMENT au format JSON suivant :
{
  "netSalary": 0,
  "grossSalary": 0,
  "contractType": "",
  "siret": "",
  "firstName": "",
  "lastName": "",
  "fullName": ""
}

Si une information n'est pas trouvée, utilise 0 pour les nombres et "" pour les chaînes.`;
  }
}

/**
 * Vérifie la cohérence entre plusieurs documents (nom sur ID vs nom sur autres documents)
 * @param {Array<Object>} documents - Tableau d'objets { type, filePath, extractedData }
 * @returns {Promise<Object>} - { isValid: boolean, inconsistencies: Array, messages: Array }
 */
async function verifyDocumentConsistency(documents) {
  if (!OPENAI_API_KEY || !documents || documents.length === 0) {
    return { isValid: true, inconsistencies: [], messages: [] };
  }

  try {
    // Trouve le document d'identité
    const idDoc = documents.find(d => d.type === 'id');
    if (!idDoc || !idDoc.extractedData) {
      return { isValid: true, inconsistencies: [], messages: [] };
    }

    const idName = (idDoc.extractedData.fullName || 
                   `${idDoc.extractedData.firstName} ${idDoc.extractedData.lastName}`).trim().toLowerCase();

    const inconsistencies = [];
    const messages = [];

    // Vérifie les alertes de fraude sur l'ID
    if (idDoc.extractedData.hasRetouchingSuspicion) {
      messages.push({
        type: 'critical',
        title: 'Suspicion de fraude détectée',
        message: `Suspicion de retouche détectée sur votre pièce d'identité : ${idDoc.extractedData.retouchingDetails || 'Zone suspecte détectée'}. Veuillez fournir l'original non modifié.`
      });
    }

    if (!idDoc.extractedData.isMrzValid) {
      messages.push({
        type: 'critical',
        title: 'Données MRZ invalides',
        message: 'Les données de la zone MRZ (lignes en bas du document) ne correspondent pas aux données visibles. Veuillez vérifier votre pièce d\'identité.'
      });
    }

    // Compare avec les autres documents
    for (const doc of documents) {
      if (doc.type === 'id' || !doc.extractedData) continue;

      const docName = (doc.extractedData.fullName || 
                      `${doc.extractedData.firstName} ${doc.extractedData.lastName}`).trim().toLowerCase();

      if (docName && idName && docName !== idName) {
        const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
        const normalizedId = normalize(idName);
        const normalizedDoc = normalize(docName);

        if (normalizedId !== normalizedDoc) {
          inconsistencies.push({
            documentType: doc.type,
            idName: idDoc.extractedData.fullName || `${idDoc.extractedData.firstName} ${idDoc.extractedData.lastName}`,
            docName: doc.extractedData.fullName || `${doc.extractedData.firstName} ${doc.extractedData.lastName}`
          });

          const docLabels = {
            'payslip': 'bulletin de salaire',
            'tax': 'avis d\'imposition',
            'contract': 'contrat de travail'
          };

          messages.push({
            type: 'warning',
            title: 'Incohérence de nom détectée',
            message: `Le nom sur votre ${docLabels[doc.type] || 'document'} (${doc.extractedData.fullName || doc.extractedData.firstName + ' ' + doc.extractedData.lastName}) ne correspond pas exactement à celui de votre pièce d'identité (${idDoc.extractedData.fullName || idDoc.extractedData.firstName + ' ' + idDoc.extractedData.lastName}). Veuillez vérifier que les documents appartiennent bien à la même personne.`
          });
        }
      }
    }

    return {
      isValid: inconsistencies.length === 0 && !idDoc.extractedData.hasRetouchingSuspicion && idDoc.extractedData.isMrzValid,
      inconsistencies,
      messages
    };
  } catch (error) {
    console.error('Erreur vérification cohérence:', error);
    return { isValid: true, inconsistencies: [], messages: [] };
  }
}

/**
 * Audit approfondi d'une fiche de paie avec vérifications mathématiques
 * @param {Object} payslipData - Données extraites d'une fiche de paie
 * @returns {Object} - Résultat de l'audit avec alertes
 */
function auditPayslip(payslipData) {
  const alerts = [];
  let isValid = true;

  // Vérification mathématique
  if (payslipData.grossSalary > 0 && payslipData.netSalary > 0) {
    const calculatedNet = payslipData.grossSalary - (payslipData.totalDeductions || 0);
    const difference = Math.abs(calculatedNet - payslipData.netSalary);
    const differencePercent = (difference / payslipData.grossSalary) * 100;

    if (differencePercent > 2) {
      isValid = false;
      alerts.push({
        code: 'MATH_INCONSISTENCY',
        severity: 'critical',
        message: `Incohérence mathématique détectée : Le calcul Brut - Cotisations (${calculatedNet.toFixed(2)}€) ne correspond pas au Net déclaré (${payslipData.netSalary.toFixed(2)}€). Écart de ${difference.toFixed(2)}€ (${differencePercent.toFixed(1)}%).`
      });
    }
  }

  // Vérification du cumul
  if (payslipData.monthNumber > 0 && payslipData.taxableIncome > 0 && payslipData.cumulativeTaxableIncome > 0) {
    const expectedCumulative = payslipData.taxableIncome * payslipData.monthNumber;
    const difference = Math.abs(expectedCumulative - payslipData.cumulativeTaxableIncome);
    const differencePercent = (difference / expectedCumulative) * 100;

    if (differencePercent > 5) {
      isValid = false;
      alerts.push({
        code: 'CUMUL_INCONSISTENCY',
        severity: 'critical',
        message: `Incohérence de cumul détectée : Le cumul annuel déclaré (${payslipData.cumulativeTaxableIncome.toFixed(2)}€) ne correspond pas au calcul attendu pour ${payslipData.monthNumber} mois (${expectedCumulative.toFixed(2)}€). Écart de ${differencePercent.toFixed(1)}%.`
      });
    }
  }

  // Vérification fiscale (PAS)
  if (payslipData.taxableIncome > 0 && payslipData.pasRate > 0) {
    const expectedPAS = payslipData.taxableIncome * (payslipData.pasRate / 100);
    const difference = Math.abs(expectedPAS - (payslipData.pasAmount || 0));
    const differencePercent = (difference / expectedPAS) * 100;

    if (differencePercent > 3) {
      isValid = false;
      alerts.push({
        code: 'FISCAL_INCONSISTENCY',
        severity: 'warning',
        message: `Incohérence fiscale détectée : Le PAS déclaré (${(payslipData.pasAmount || 0).toFixed(2)}€) ne correspond pas au calcul attendu avec le taux ${payslipData.pasRate}% (${expectedPAS.toFixed(2)}€).`
      });
    }
  }

  // Vérification SIRET
  if (payslipData.siret) {
    const siretValid = /^\d{14}$/.test(payslipData.siret);
    if (!siretValid) {
      isValid = false;
      alerts.push({
        code: 'SIRET_INVALID',
        severity: 'warning',
        message: `Format SIRET invalide : Le SIRET doit contenir exactement 14 chiffres.`
      });
    }
  }

  return {
    isValid,
    alerts,
    payslipData
  };
}

/**
 * Génère un insight IA résumant les points forts et points de vigilance d'un dossier candidature
 * @param {Object} candidature - Document candidature avec scoring et données
 * @param {Object} property - Document bien immobilier
 * @returns {Promise<Object>} - { strengths: Array<string>, warnings: Array<string>, summary: string }
 */
async function generateCandidatureInsight(candidature, property) {
  if (!OPENAI_API_KEY) {
    // Fallback sans IA
    const scoring = candidature.scoring || {};
    const strengths = [];
    const warnings = [];
    
    if (scoring.total >= 70) {
      strengths.push('Score PatrimoTrust élevé');
    }
    if (scoring.ratio >= 3.0) {
      strengths.push('Ratio loyer/revenus excellent');
    }
    if (candidature.contractType === 'CDI') {
      strengths.push('Contrat CDI (stabilité)');
    }
    if (candidature.hasGuarantor) {
      strengths.push('Garant présent');
    }
    
    if (scoring.total < 40) {
      warnings.push('Score PatrimoTrust faible');
    }
    if (scoring.ratio < 2.5) {
      warnings.push('Ratio loyer/revenus fragile');
    }
    if (candidature.contractType === 'CDD' || candidature.contractType === 'FREELANCE') {
      warnings.push('Stabilité professionnelle limitée');
    }
    
    return {
      strengths: strengths.length > 0 ? strengths : ['Dossier complet'],
      warnings: warnings.length > 0 ? warnings : [],
      summary: strengths.length > warnings.length 
        ? 'Dossier solide avec quelques points à vérifier.'
        : 'Dossier nécessitant une attention particulière.'
    };
  }

  try {
    const scoring = candidature.scoring || {};
    const rent = Number(property?.rentAmount || 0);
    const charges = Number(property?.chargesAmount || 0);
    const income = Number(candidature.monthlyNetIncome || 0);
    const ratio = scoring.ratio || (income > 0 ? income / (rent + charges || 1) : 0);
    
    const prompt = `Tu es un expert en analyse de dossiers locatifs pour GetPatrimo, une plateforme Wealth-Tech de gestion locative sécurisée par IA.

Analyse ce dossier candidature et génère un insight professionnel en français avec :
1. 2-4 points forts (bullet points concis)
2. 1-3 points de vigilance (bullet points concis)
3. Un résumé en 1-2 phrases

DONNÉES DU DOSSIER :
- Score PatrimoTrust: ${scoring.total || 0}/100 (Grade: ${scoring.grade || 'N/A'})
- Ratio loyer/revenus: ${ratio.toFixed(2)}
- Revenus nets mensuels: ${income.toFixed(2)}€
- Loyer + charges: ${(rent + charges).toFixed(2)}€
- Type de contrat: ${candidature.contractType || 'Non renseigné'}
- Garant: ${candidature.hasGuarantor ? 'Oui' : 'Non'}
- Nombre de documents: ${(candidature.docs || []).length}
- Alertes: ${(scoring.alerts || []).map(a => a.message).join('; ') || 'Aucune'}

RÉPONDS UNIQUEMENT EN JSON VALIDE :
{
  "strengths": ["point fort 1", "point fort 2"],
  "warnings": ["vigilance 1", "vigilance 2"],
  "summary": "Résumé en 1-2 phrases"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Tu es un expert en analyse de dossiers locatifs. Réponds uniquement en JSON valide.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`API OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    try {
      const parsed = JSON.parse(content);
      return {
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        summary: String(parsed.summary || 'Analyse en cours...')
      };
    } catch (parseError) {
      // Fallback si le JSON est invalide
      return {
        strengths: ['Dossier analysé'],
        warnings: [],
        summary: 'Analyse IA disponible'
      };
    }
  } catch (error) {
    console.error('Erreur génération insight IA:', error);
    // Retourne un fallback
    return {
      strengths: ['Dossier complet'],
      warnings: [],
      summary: 'Analyse disponible'
    };
  }
}

module.exports = {
  extractDocumentData,
  verifyDocumentConsistency,
  auditPayslip,
  generateCandidatureInsight
};
