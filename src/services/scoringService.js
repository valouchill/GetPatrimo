// Service de scoring professionnel avec détection de fraude (GetPatrimo)
const { computeCandidatureScoreV1PlusDocs } = require('../../scoring');

/**
 * Calcule le reste-à-vivre (revenu disponible après loyer et charges fixes)
 * Formule: Reste_à_vivre = Revenu_Net - Loyer - Charges_Estimées_fixes
 * @param {number} netSalary - Salaire net mensuel
 * @param {number} rentAmount - Loyer mensuel
 * @param {number} chargesAmount - Charges mensuelles déclarées
 * @returns {Object} - { ratio: number, remaining: number, percentage: number, chargesEstimated: number }
 */
function calculateRemainingIncome(netSalary, rentAmount, chargesAmount = 0) {
  if (rentAmount <= 0 || netSalary <= 0) {
    return { ratio: 0, remaining: 0, percentage: 0, chargesEstimated: chargesAmount };
  }

  // Charges estimées fixes : si non déclarées, estime à 10% du loyer (minimum 50€)
  const chargesEstimated = chargesAmount > 0 
    ? chargesAmount 
    : Math.max(50, rentAmount * 0.1);

  const monthlyCost = rentAmount + chargesEstimated;
  const remaining = netSalary - monthlyCost;
  const percentage = (monthlyCost / netSalary) * 100;
  const ratio = netSalary / monthlyCost;

  return {
    ratio: Number(ratio.toFixed(2)),
    remaining: Number(remaining.toFixed(2)),
    percentage: Number(percentage.toFixed(1)),
    chargesEstimated: Number(chargesEstimated.toFixed(2)),
    rentAmount: Number(rentAmount.toFixed(2)),
    monthlyCost: Number(monthlyCost.toFixed(2))
  };
}

/**
 * Calcule le score de solvabilité avec règles strictes bancaires
 * Prend en compte le reste-à-vivre absolu : si < 800€, malus sévère même si ratio OK
 * @param {number} netSalary - Salaire net mensuel
 * @param {number} rentAmount - Loyer mensuel
 * @param {number} chargesAmount - Charges mensuelles (optionnel)
 * @returns {Object} - { points: number, ratio: number, remaining: number, alerts: Array, detail: string }
 */
function calculateSolvabilityScore(netSalary, rentAmount, chargesAmount = 0) {
  const calc = calculateRemainingIncome(netSalary, rentAmount, chargesAmount);
  const alerts = [];
  let points = 0;
  let detail = '';
  
  // SEUIL CRITIQUE : Reste-à-vivre absolu < 800€ = MALUS DRastique
  // Un locataire qui gagne 1500€ et paie 500€ est plus "à risque" qu'un qui gagne 6000€ et paie 2000€
  const REMAINING_INCOME_THRESHOLD = 800; // Seuil minimum pour une personne seule
  
  if (calc.remaining < REMAINING_INCOME_THRESHOLD) {
    // Malus progressif selon l'écart au seuil
    const deficit = REMAINING_INCOME_THRESHOLD - calc.remaining;
    const malus = Math.min(40, Math.floor(deficit / 20)); // -1 point tous les 20€ de déficit, max -40 pts
    points = Math.max(0, 60 - malus);
    
    alerts.push({
      type: 'critical',
      code: 'LOW_REMAINING_INCOME',
      message: `Reste-à-vivre insuffisant : ${calc.remaining.toFixed(2)}€/mois (seuil minimum recommandé: ${REMAINING_INCOME_THRESHOLD}€). Risque élevé de difficultés financières, même si le ratio loyer/revenu est acceptable.`
    });
    
    detail = `Reste-à-vivre critique: ${calc.remaining.toFixed(2)}€/mois (${calc.percentage.toFixed(1)}% du revenu) - En dessous du seuil de sécurité`;
    
    // Si le reste-à-vivre est très faible (< 500€), applique un malus supplémentaire
    if (calc.remaining < 500) {
      points = Math.max(0, points - 15);
      alerts.push({
        type: 'critical',
        code: 'VERY_LOW_REMAINING_INCOME',
        message: `Reste-à-vivre très faible (${calc.remaining.toFixed(2)}€). Risque de surendettement élevé.`
      });
    }
    
    return {
      points: Math.max(0, Math.min(60, points)),
      ratio: calc.ratio,
      remaining: calc.remaining,
      percentage: calc.percentage,
      alerts,
      detail,
      thresholdExceeded: true
    };
  }

  // Si reste-à-vivre >= 800€, applique la logique basée sur le pourcentage
  // Hard Gate : Si loyer > 33% du revenu net = MALUS SÉVÈRE
  if (calc.percentage > 33) {
    points = Math.max(0, 60 - (calc.percentage - 33) * 2); // Malus progressif
    alerts.push({
      type: 'critical',
      code: 'RENT_TOO_HIGH',
      message: `Le loyer représente ${calc.percentage.toFixed(1)}% de vos revenus (seuil recommandé: 33%). Risque de surendettement.`
    });
    detail = `Reste-à-vivre faible: ${calc.remaining.toFixed(2)}€/mois (${calc.percentage.toFixed(1)}% du revenu)`;
  } else if (calc.percentage > 30) {
    points = 50;
    alerts.push({
      type: 'warning',
      code: 'RENT_HIGH',
      message: `Le loyer représente ${calc.percentage.toFixed(1)}% de vos revenus. Proche du seuil de 33%.`
    });
    detail = `Reste-à-vivre: ${calc.remaining.toFixed(2)}€/mois (${calc.percentage.toFixed(1)}% du revenu)`;
  } else if (calc.percentage <= 25) {
    // Bonus si reste-à-vivre élevé ET pourcentage faible
    if (calc.remaining >= 1200) {
      points = 60; // Score maximum
      detail = `Reste-à-vivre excellent: ${calc.remaining.toFixed(2)}€/mois (${calc.percentage.toFixed(1)}% du revenu)`;
    } else {
      points = 55;
      detail = `Reste-à-vivre bon: ${calc.remaining.toFixed(2)}€/mois (${calc.percentage.toFixed(1)}% du revenu)`;
    }
  } else {
    points = 45;
    detail = `Reste-à-vivre correct: ${calc.remaining.toFixed(2)}€/mois (${calc.percentage.toFixed(1)}% du revenu)`;
  }

  return {
    points: Math.max(0, Math.min(60, points)),
    ratio: calc.ratio,
    remaining: calc.remaining,
    percentage: calc.percentage,
    alerts,
    detail,
    thresholdExceeded: false
  };
}

/**
 * Calcule le score de stabilité avec analyse d'ancienneté
 * @param {string} contractType - Type de contrat
 * @param {Object} extractedData - Données extraites (peut contenir startDate, ancienneté)
 * @returns {Object} - { points: number, detail: string, alerts: Array }
 */
function calculateStabilityScore(contractType, extractedData = {}) {
  const ct = String(contractType || '').toUpperCase().trim();
  const alerts = [];
  let points = 0;
  let detail = '';

  // Analyse de l'ancienneté si disponible
  const ancienneteMonths = extractedData.ancienneteMonths || 0;
  const isProbationPeriod = extractedData.isProbationPeriod || false;

  if (ct === 'CDI') {
    if (isProbationPeriod) {
      points = 15; // CDI en période d'essai = malus
      alerts.push({
        type: 'warning',
        code: 'PROBATION_PERIOD',
        message: 'Contrat CDI en période d\'essai. Stabilité réduite.'
      });
      detail = 'CDI (période d\'essai)';
    } else if (ancienneteMonths >= 6) {
      points = 25; // CDI hors période d'essai avec ancienneté = bonus
      detail = `CDI (ancienneté: ${ancienneteMonths} mois)`;
    } else if (ancienneteMonths > 0) {
      points = 18; // CDI récent
      alerts.push({
        type: 'warning',
        code: 'LOW_SENIORITY',
        message: `Ancienneté faible: ${ancienneteMonths} mois (recommandé: ≥6 mois)`
      });
      detail = `CDI (ancienneté: ${ancienneteMonths} mois)`;
    } else {
      points = 20; // CDI sans info d'ancienneté
      detail = 'CDI';
    }
  } else if (ct === 'CDD') {
    if (ancienneteMonths >= 6) {
      points = 15; // CDD avec ancienneté
      detail = `CDD (ancienneté: ${ancienneteMonths} mois)`;
    } else {
      points = 10; // CDD récent = malus
      alerts.push({
        type: 'warning',
        code: 'CDD_RECENT',
        message: 'CDD récent. Stabilité limitée.'
      });
      detail = `CDD (ancienneté: ${ancienneteMonths} mois)`;
    }
  } else if (ct === 'FREELANCE') {
    points = 8;
    alerts.push({
      type: 'warning',
      code: 'FREELANCE',
      message: 'Statut indépendant. Stabilité réduite.'
    });
    detail = 'Indépendant / Freelance';
  } else {
    points = 5;
    detail = ct || 'Non renseigné';
  }

  return {
    points: Math.max(0, Math.min(25, points)),
    detail,
    alerts
  };
}

/**
 * Calcule le score d'authenticité basé sur la cohérence des documents
 * @param {Object} consistencyCheck - Résultat de verifyDocumentConsistency
 * @param {Array} payslipAudits - Résultats des audits des fiches de paie
 * @returns {Object} - { points: number, detail: string, alerts: Array }
 */
function calculateAuthenticityScore(consistencyCheck, payslipAudits = []) {
  let points = 15; // Score de base
  const alerts = [];
  let detail = 'Documents cohérents';

  // Vérifie la cohérence des noms entre documents
  if (consistencyCheck && !consistencyCheck.isValid) {
    points -= 5 * consistencyCheck.inconsistencies.length;
    consistencyCheck.inconsistencies.forEach(inc => {
      alerts.push({
        type: 'critical',
        code: 'NAME_MISMATCH',
        message: `Incohérence de nom détectée entre la pièce d'identité et le document ${inc.documentType}`
      });
    });
    detail = 'Incohérences détectées entre documents';
  }

  // Vérifie les audits des fiches de paie
  payslipAudits.forEach((audit, index) => {
    if (!audit.isValid) {
      points -= 3;
      audit.alerts.forEach(alert => {
        alerts.push({
          type: alert.severity === 'critical' ? 'critical' : 'warning',
          code: alert.code,
          message: `Fiche de paie ${index + 1}: ${alert.message}`
        });
      });
      detail = 'Incohérences mathématiques détectées';
    }
  });

  return {
    points: Math.max(0, Math.min(15, points)),
    detail,
    alerts
  };
}

/**
 * Calcule le score complet avec Hard Gates et détection de fraude
 * @param {Object} params - Paramètres de scoring
 * @param {Object} params.cand - Document candidature
 * @param {Object} params.property - Document bien immobilier
 * @param {Object} [params.extractedData] - Données extraites par IA
 * @param {Object} [params.consistencyCheck] - Résultat de vérification de cohérence
 * @param {Array} [params.payslipAudits] - Résultats des audits des fiches de paie
 * @returns {Object} - Score complet avec breakdown et alertes
 */
function computePatrimoCoreScore({ cand, property, extractedData = null, consistencyCheck = null, payslipAudits = [] }) {
  const breakdown = [];
  const flags = [];
  const alerts = [];

  const rent = Number(property?.rentAmount || 0) || 0;
  const charges = Number(property?.chargesAmount || 0) || 0;

  // Utilise les données extraites par IA si disponibles
  const netSalary = extractedData?.netSalary || Number(cand?.monthlyNetIncome || 0) || 0;
  const contractType = extractedData?.contractType || String(cand?.contractType || '').trim();

  // HARD GATE 1 : Vérifie la présence de fiches de paie
  const hasPayslips = payslipAudits && payslipAudits.length > 0;
  const docsCount = Array.isArray(cand?.docs) ? cand.docs.length : 0;
  const hasIdDoc = cand?.docs?.some(d => {
    const name = (d.originalName || '').toLowerCase();
    return name.includes('identite') || name.includes('cni') || name.includes('passeport');
  });

  // HARD GATE : Si aucune fiche de paie, score plafonné à 10%
  if (!hasPayslips && netSalary === 0) {
    if (hasIdDoc) {
      return {
        version: 'patrimo-core-v2-hard-gates',
        total: 10,
        grade: 'E',
        ratio: 0,
        breakdown: [{
          key: 'hard_gate',
          label: 'Hard Gate',
          points: 10,
          detail: 'Pièce d\'identité uniquement. Aucune fiche de paie fournie. Score plafonné à 10%.'
        }],
        flags: ['no_payslips', 'hard_gate_triggered'],
        alerts: [{
          type: 'critical',
          code: 'NO_PAYSLIPS',
          message: 'Aucune fiche de paie fournie. Le dossier ne peut pas être validé sans justificatifs de revenus.'
        }],
        hardGateTriggered: true
      };
    } else {
      return {
        version: 'patrimo-core-v2-hard-gates',
        total: 0,
        grade: 'E',
        ratio: 0,
        breakdown: [{
          key: 'hard_gate',
          label: 'Hard Gate',
          points: 0,
          detail: 'Aucun document fourni.'
        }],
        flags: ['no_documents', 'hard_gate_triggered'],
        alerts: [{
          type: 'critical',
          code: 'NO_DOCUMENTS',
          message: 'Aucun document fourni. Dossier incomplet.'
        }],
        hardGateTriggered: true
      };
    }
  }

  // 1. SOLVABILITÉ (60% du score)
  // Utilise la formule: Reste_à_vivre = Revenu_Net - Loyer - Charges_Estimées_fixes
  const solvability = calculateSolvabilityScore(netSalary, rent, charges);
  breakdown.push({
    key: 'solvability',
    label: 'Solvabilité (60%)',
    points: solvability.points,
    detail: solvability.detail
  });
  alerts.push(...solvability.alerts);

  // 2. STABILITÉ (25% du score)
  const stability = calculateStabilityScore(contractType, extractedData);
  breakdown.push({
    key: 'stability',
    label: 'Stabilité (25%)',
    points: stability.points,
    detail: stability.detail
  });
  alerts.push(...stability.alerts);

  // 3. AUTHENTICITÉ (15% du score)
  const authenticity = calculateAuthenticityScore(consistencyCheck, payslipAudits);
  breakdown.push({
    key: 'authenticity',
    label: 'Authenticité (15%)',
    points: authenticity.points,
    detail: authenticity.detail
  });
  alerts.push(...authenticity.alerts);

  // Calcule le total (pondération stricte)
  const total = Math.max(0, Math.min(100,
    solvability.points + // 60%
    stability.points +   // 25%
    authenticity.points  // 15%
  ));

  // Grade avec seuils stricts
  const grade = total >= 85 ? 'A' :
                total >= 70 ? 'B' :
                total >= 55 ? 'C' :
                total >= 40 ? 'D' : 'E';

  // Flags critiques
  if (solvability.percentage > 33) flags.push('rent_too_high');
  if (stability.points < 15) flags.push('low_stability');
  if (authenticity.points < 10) flags.push('authenticity_issues');
  if (alerts.some(a => a.type === 'critical')) flags.push('critical_alerts');

  return {
    version: 'patrimo-core-v2-hard-gates',
    total: Math.round(total),
    grade,
    ratio: solvability.ratio,
    remaining: solvability.remaining,
    breakdown,
    flags: Array.from(new Set(flags)),
    alerts,
    hardGateTriggered: false,
    extractedData: extractedData ? {
      netSalary,
      grossSalary: extractedData.grossSalary,
      contractType,
      siret: extractedData.siret
    } : null
  };
}

module.exports = {
  computePatrimoCoreScore,
  calculateSolvabilityScore,
  calculateStabilityScore,
  calculateAuthenticityScore
};
