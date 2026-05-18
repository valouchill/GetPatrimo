// Service de scoring objectif (GetPatrimo / PatrimoTrust V1.2)
//
// Critères métier alignés sur les standards français de location :
//  - Pilier 1 Solvabilité (50 pts)  : taux d'effort ≤ 33% + reste-à-vivre seuils région
//  - Pilier 2 Stabilité   (20 pts) : type contrat + ancienneté + période d'essai
//  - Pilier 3 Authenticité (15 pts): identité Didit + audit Forensic + cohérence docs
//  - Pilier 4 Garantie    (15 pts) : Visale / garant solvable / aucune
//
// Modificateurs globaux :
//  - CDD/freelance/étudiant SANS garant Visale ou solvable : -15 pts (forte pénalité)
//  - Identité Didit FAILED : -10 pts
//  - 1+ document REJECTED : -8 pts
//
// Hard gates (plafond max) :
//  - Aucune fiche de paie + aucun avis d'imposition : score max 30
//  - Audit Forensic ALERT : score max 45
//  - Aucun document : score max 10

const { computeCandidatureScoreV1PlusDocs } = require('../../scoring');

// ── Constantes seuils ──────────────────────────────────────────────────────

const THRESHOLDS = {
  EFFORT_RATE_EXCELLENT: 0.28,    // ≤28% du revenu → max points solvabilité
  EFFORT_RATE_OK: 0.33,           // ≤33% standard FR
  EFFORT_RATE_LIMIT: 0.38,        // 33-38% acceptable avec garant
  EFFORT_RATE_INSUFFICIENT: 0.45, // >45% blocage

  REMAINING_EXCELLENT: 1500,      // ≥1500€ excellent
  REMAINING_GOOD: 1000,           // ≥1000€ bon
  REMAINING_OK: 800,              // ≥800€ standard (province)
  REMAINING_TIGHT: 600,           // 600-800€ tendu (warning)
  // <600€ critique
};

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Calcule le reste-à-vivre et le taux d'effort.
 */
function calculateRemainingIncome(netSalary, rentAmount, chargesAmount = 0) {
  if (rentAmount <= 0 || netSalary <= 0) {
    return { ratio: 0, remaining: 0, percentage: 0, effortRate: 0, chargesEstimated: chargesAmount, rentAmount: 0, monthlyCost: 0 };
  }

  const chargesEstimated = chargesAmount > 0
    ? chargesAmount
    : Math.max(50, rentAmount * 0.1);

  const monthlyCost = rentAmount + chargesEstimated;
  const remaining = netSalary - monthlyCost;
  const percentage = (monthlyCost / netSalary) * 100;
  const effortRate = monthlyCost / netSalary;
  const ratio = netSalary / monthlyCost;

  return {
    ratio: Number(ratio.toFixed(2)),
    remaining: Number(remaining.toFixed(2)),
    percentage: Number(percentage.toFixed(1)),
    effortRate: Number(effortRate.toFixed(3)),
    chargesEstimated: Number(chargesEstimated.toFixed(2)),
    rentAmount: Number(rentAmount.toFixed(2)),
    monthlyCost: Number(monthlyCost.toFixed(2)),
  };
}

// ── Pilier 1 : Solvabilité (50 pts) ────────────────────────────────────────

/**
 * Solvabilité = combinaison du taux d'effort et du reste-à-vivre.
 * 30 pts max sur le taux d'effort, 20 pts max sur le reste-à-vivre.
 */
function calculateSolvabilityScore(netSalary, rentAmount, chargesAmount = 0) {
  const calc = calculateRemainingIncome(netSalary, rentAmount, chargesAmount);
  const alerts = [];
  const criteria = {};

  // Sub-score 1 : Taux d'effort (sur 30 pts)
  let effortPoints = 0;
  let effortStatus = 'ok';
  let effortVerdict = '';
  if (calc.effortRate === 0) {
    effortPoints = 0;
    effortStatus = 'alert';
    effortVerdict = 'Revenus non détectés';
  } else if (calc.effortRate <= THRESHOLDS.EFFORT_RATE_EXCELLENT) {
    effortPoints = 30;
    effortStatus = 'excellent';
    effortVerdict = 'Excellent (≤28%)';
  } else if (calc.effortRate <= THRESHOLDS.EFFORT_RATE_OK) {
    effortPoints = 25;
    effortStatus = 'ok';
    effortVerdict = 'Conforme (≤33%)';
  } else if (calc.effortRate <= THRESHOLDS.EFFORT_RATE_LIMIT) {
    effortPoints = 15;
    effortStatus = 'warn';
    effortVerdict = 'Limite — garant recommandé (33-38%)';
    alerts.push({
      type: 'warning',
      code: 'EFFORT_RATE_LIMIT',
      message: `Taux d'effort ${calc.percentage.toFixed(1)}% au-dessus du standard 33%. Garant recommandé.`,
    });
  } else if (calc.effortRate <= THRESHOLDS.EFFORT_RATE_INSUFFICIENT) {
    effortPoints = 5;
    effortStatus = 'alert';
    effortVerdict = 'Insuffisant (38-45%)';
    alerts.push({
      type: 'critical',
      code: 'EFFORT_RATE_INSUFFICIENT',
      message: `Taux d'effort ${calc.percentage.toFixed(1)}% au-dessus du seuil bancaire (33%). Risque d'impayé.`,
    });
  } else {
    effortPoints = 0;
    effortStatus = 'alert';
    effortVerdict = 'Bloquant (>45%)';
    alerts.push({
      type: 'critical',
      code: 'EFFORT_RATE_BLOCKING',
      message: `Taux d'effort ${calc.percentage.toFixed(1)}% extrême. Risque majeur d'impayé.`,
    });
  }
  criteria.effortRate = {
    value: calc.effortRate,
    percentage: calc.percentage,
    threshold: 33,
    points: effortPoints,
    maxPoints: 30,
    status: effortStatus,
    verdict: effortVerdict,
  };

  // Sub-score 2 : Reste-à-vivre (sur 20 pts)
  let remainPoints = 0;
  let remainStatus = 'ok';
  let remainVerdict = '';
  if (calc.remaining >= THRESHOLDS.REMAINING_EXCELLENT) {
    remainPoints = 20;
    remainStatus = 'excellent';
    remainVerdict = 'Confort financier élevé';
  } else if (calc.remaining >= THRESHOLDS.REMAINING_GOOD) {
    remainPoints = 17;
    remainStatus = 'ok';
    remainVerdict = 'Marge confortable';
  } else if (calc.remaining >= THRESHOLDS.REMAINING_OK) {
    remainPoints = 12;
    remainStatus = 'ok';
    remainVerdict = 'Standard (≥800€)';
  } else if (calc.remaining >= THRESHOLDS.REMAINING_TIGHT) {
    remainPoints = 6;
    remainStatus = 'warn';
    remainVerdict = 'Marge tendue (600-800€)';
    alerts.push({
      type: 'warning',
      code: 'REMAINING_TIGHT',
      message: `Reste-à-vivre ${calc.remaining.toFixed(0)}€ tendu. Garant ou caution recommandés.`,
    });
  } else {
    remainPoints = 0;
    remainStatus = 'alert';
    remainVerdict = 'Critique (<600€)';
    alerts.push({
      type: 'critical',
      code: 'REMAINING_CRITICAL',
      message: `Reste-à-vivre ${calc.remaining.toFixed(0)}€ insuffisant. Risque très élevé.`,
    });
  }
  criteria.remainingIncome = {
    value: calc.remaining,
    threshold: THRESHOLDS.REMAINING_OK,
    points: remainPoints,
    maxPoints: 20,
    status: remainStatus,
    verdict: remainVerdict,
  };

  const points = Math.max(0, Math.min(50, effortPoints + remainPoints));
  const detail = `Taux d'effort ${calc.percentage.toFixed(1)}% · Reste-à-vivre ${calc.remaining.toFixed(0)}€`;

  return {
    points,
    maxPoints: 50,
    ratio: calc.ratio,
    remaining: calc.remaining,
    percentage: calc.percentage,
    effortRate: calc.effortRate,
    alerts,
    criteria,
    detail,
    thresholdExceeded: calc.effortRate > THRESHOLDS.EFFORT_RATE_OK,
  };
}

// ── Pilier 2 : Stabilité (20 pts) ──────────────────────────────────────────

function calculateStabilityScore(contractType, extractedData = {}) {
  const ct = String(contractType || '').toUpperCase().trim();
  const alerts = [];
  const criteria = {};
  let contractPoints = 0;
  let seniorityPoints = 0;
  let contractVerdict = '';
  let contractStatus = 'ok';

  const ancienneteMonths = Number(extractedData.ancienneteMonths || 0);
  const isProbationPeriod = Boolean(extractedData.isProbationPeriod);

  // Sub-score 1 : Type de contrat (12 pts max)
  if (ct === 'CDI' || ct === 'FONCTIONNAIRE' || ct === 'PUBLIC') {
    if (isProbationPeriod) {
      contractPoints = 7;
      contractStatus = 'warn';
      contractVerdict = 'CDI en période d\'essai';
      alerts.push({
        type: 'warning',
        code: 'PROBATION_PERIOD',
        message: 'Contrat CDI en période d\'essai. Stabilité réduite.',
      });
    } else {
      contractPoints = 12;
      contractStatus = 'excellent';
      contractVerdict = ct === 'CDI' ? 'CDI confirmé' : 'Fonction publique';
    }
  } else if (ct === 'CDD') {
    contractPoints = 7;
    contractStatus = 'warn';
    contractVerdict = 'CDD (stabilité limitée)';
    alerts.push({
      type: 'warning',
      code: 'CDD',
      message: 'Contrat CDD. Garant recommandé pour sécuriser.',
    });
  } else if (ct === 'FREELANCE' || ct === 'INDEPENDANT' || ct === 'AUTO_ENTREPRENEUR') {
    contractPoints = ancienneteMonths >= 24 ? 7 : 3;
    contractStatus = ancienneteMonths >= 24 ? 'warn' : 'alert';
    contractVerdict = ancienneteMonths >= 24
      ? 'Freelance établi (>2 ans)'
      : 'Freelance récent';
    alerts.push({
      type: 'warning',
      code: 'FREELANCE',
      message: 'Statut indépendant. Garant recommandé.',
    });
  } else if (ct === 'ETUDIANT' || ct === 'STUDENT' || ct === 'ÉTUDIANT') {
    contractPoints = 3;
    contractStatus = 'alert';
    contractVerdict = 'Étudiant (garant attendu)';
  } else if (ct === 'RETRAITE' || ct === 'RETRAITÉ') {
    contractPoints = 11;
    contractStatus = 'excellent';
    contractVerdict = 'Retraité (revenus pérennes)';
  } else {
    contractPoints = 2;
    contractStatus = 'alert';
    contractVerdict = ct || 'Non renseigné';
  }
  criteria.contractType = {
    value: ct,
    points: contractPoints,
    maxPoints: 12,
    status: contractStatus,
    verdict: contractVerdict,
  };

  // Sub-score 2 : Ancienneté (8 pts max)
  let seniorityStatus = 'ok';
  let seniorityVerdict = '';
  if (ancienneteMonths >= 60) {
    seniorityPoints = 8;
    seniorityStatus = 'excellent';
    seniorityVerdict = '> 5 ans';
  } else if (ancienneteMonths >= 24) {
    seniorityPoints = 6;
    seniorityStatus = 'ok';
    seniorityVerdict = '2-5 ans';
  } else if (ancienneteMonths >= 12) {
    seniorityPoints = 4;
    seniorityStatus = 'ok';
    seniorityVerdict = '1-2 ans';
  } else if (ancienneteMonths >= 6) {
    seniorityPoints = 2;
    seniorityStatus = 'warn';
    seniorityVerdict = '6-12 mois';
  } else if (ancienneteMonths > 0) {
    seniorityPoints = 1;
    seniorityStatus = 'warn';
    seniorityVerdict = '< 6 mois';
  } else {
    seniorityPoints = 0;
    seniorityStatus = 'warn';
    seniorityVerdict = 'Non renseignée';
  }
  criteria.seniority = {
    value: ancienneteMonths,
    points: seniorityPoints,
    maxPoints: 8,
    status: seniorityStatus,
    verdict: seniorityVerdict,
  };

  const points = Math.max(0, Math.min(20, contractPoints + seniorityPoints));
  const detail = `${criteria.contractType.verdict} · Ancienneté ${seniorityVerdict.toLowerCase()}`;

  return {
    points,
    maxPoints: 20,
    detail,
    alerts,
    criteria,
    contractType: ct,
    isLimited: ['CDD', 'FREELANCE', 'INDEPENDANT', 'AUTO_ENTREPRENEUR', 'ETUDIANT', 'STUDENT', 'ÉTUDIANT'].includes(ct),
  };
}

// ── Pilier 3 : Authenticité (15 pts) ───────────────────────────────────────

function calculateAuthenticityScore({ consistencyCheck, payslipAudits = [], diditStatus = 'PENDING', auditStatus = 'PENDING' }) {
  const alerts = [];
  const criteria = {};

  // Sub-score 1 : Identité Didit (5 pts)
  let identityPoints = 0;
  let identityStatus = 'ok';
  let identityVerdict = '';
  const dStatus = String(diditStatus || '').toUpperCase();
  if (dStatus === 'VERIFIED') {
    identityPoints = 5;
    identityStatus = 'excellent';
    identityVerdict = 'Identité vérifiée (Didit)';
  } else if (dStatus === 'PENDING') {
    identityPoints = 2;
    identityStatus = 'warn';
    identityVerdict = 'Vérification en cours';
  } else {
    identityPoints = 0;
    identityStatus = 'alert';
    identityVerdict = 'Identité non vérifiée';
    alerts.push({
      type: 'critical',
      code: 'IDENTITY_NOT_VERIFIED',
      message: 'Vérification biométrique Didit échouée ou absente.',
    });
  }
  criteria.identity = {
    value: dStatus,
    points: identityPoints,
    maxPoints: 5,
    status: identityStatus,
    verdict: identityVerdict,
  };

  // Sub-score 2 : Audit Forensic (10 pts)
  let forensicPoints = 0;
  let forensicStatus = 'ok';
  let forensicVerdict = '';
  const aStatus = String(auditStatus || '').toUpperCase();
  if (aStatus === 'CLEAR') {
    forensicPoints = 10;
    forensicStatus = 'excellent';
    forensicVerdict = 'Aucune fraude détectée';
  } else if (aStatus === 'REVIEW') {
    forensicPoints = 5;
    forensicStatus = 'warn';
    forensicVerdict = 'Alertes mineures à examiner';
  } else if (aStatus === 'ALERT') {
    forensicPoints = 0;
    forensicStatus = 'alert';
    forensicVerdict = 'Fraude suspectée';
    alerts.push({
      type: 'critical',
      code: 'FORENSIC_ALERT',
      message: 'Audit Forensic en alerte. Vérification manuelle requise.',
    });
  } else {
    forensicPoints = 3;
    forensicStatus = 'warn';
    forensicVerdict = 'En cours d\'analyse';
  }
  criteria.forensic = {
    value: aStatus,
    points: forensicPoints,
    maxPoints: 10,
    status: forensicStatus,
    verdict: forensicVerdict,
  };

  // Apply legacy consistency/payslip checks comme malus complémentaires
  let consistencyMalus = 0;
  if (consistencyCheck && !consistencyCheck.isValid) {
    consistencyMalus += 3 * (consistencyCheck.inconsistencies || []).length;
    (consistencyCheck.inconsistencies || []).forEach(inc => {
      alerts.push({
        type: 'critical',
        code: 'NAME_MISMATCH',
        message: `Incohérence détectée entre l'identité et ${inc.documentType}`,
      });
    });
  }
  (payslipAudits || []).forEach((audit, index) => {
    if (!audit.isValid) {
      consistencyMalus += 2;
      (audit.alerts || []).forEach(alert => {
        alerts.push({
          type: alert.severity === 'critical' ? 'critical' : 'warning',
          code: alert.code,
          message: `Fiche de paie ${index + 1}: ${alert.message}`,
        });
      });
    }
  });

  const points = Math.max(0, Math.min(15, identityPoints + forensicPoints - consistencyMalus));
  const detail = `${criteria.identity.verdict} · ${criteria.forensic.verdict}`;

  return {
    points,
    maxPoints: 15,
    detail,
    alerts,
    criteria,
  };
}

// ── Pilier 4 : Garantie (15 pts) ───────────────────────────────────────────

function calculateGuaranteeScore({ guaranteeMode, guarantorIncome = 0, monthlyRent = 0, visaleConfirmed = false }) {
  const alerts = [];
  const criteria = {};
  const mode = String(guaranteeMode || 'NONE').toUpperCase();

  let points = 0;
  let status = 'ok';
  let verdict = '';
  let coverage = 0; // 0-100 (couverture du loyer par la garantie)

  if (mode === 'VISALE' && visaleConfirmed) {
    points = 15;
    status = 'excellent';
    verdict = 'Visale confirmée — couverture totale 36 mois';
    coverage = 100;
  } else if (mode === 'VISALE') {
    points = 12;
    status = 'ok';
    verdict = 'Visale (en attente de confirmation)';
    coverage = 90;
  } else if (mode === 'PHYSICAL') {
    // Garant solvable si revenus garant ≥ 3× loyer
    const guarantorRatio = monthlyRent > 0 ? (guarantorIncome / monthlyRent) : 0;
    if (guarantorRatio >= 3) {
      points = 13;
      status = 'excellent';
      verdict = `Garant solvable (${guarantorRatio.toFixed(1)}× loyer)`;
      coverage = 95;
    } else if (guarantorRatio >= 2) {
      points = 7;
      status = 'warn';
      verdict = `Garant partiel (${guarantorRatio.toFixed(1)}× loyer)`;
      coverage = 60;
      alerts.push({
        type: 'warning',
        code: 'GUARANTOR_INSUFFICIENT',
        message: `Revenus garant ${guarantorRatio.toFixed(1)}× loyer (recommandé : 3×).`,
      });
    } else if (guarantorRatio > 0) {
      points = 3;
      status = 'alert';
      verdict = `Garant insuffisant (${guarantorRatio.toFixed(1)}× loyer)`;
      coverage = 30;
      alerts.push({
        type: 'critical',
        code: 'GUARANTOR_WEAK',
        message: 'Revenus garant trop faibles. Garantie peu protectrice.',
      });
    } else {
      points = 6;
      status = 'warn';
      verdict = 'Garant déclaré (revenus à vérifier)';
      coverage = 50;
    }
  } else if (mode === 'BANK_DEPOSIT' || mode === 'CAUTION_BANCAIRE') {
    points = 12;
    status = 'excellent';
    verdict = 'Caution bancaire';
    coverage = 95;
  } else {
    points = 0;
    status = 'warn';
    verdict = 'Aucune garantie';
    coverage = 0;
    alerts.push({
      type: 'warning',
      code: 'NO_GUARANTEE',
      message: 'Aucune garantie déclarée. Visale recommandée (gratuit pour le bailleur).',
    });
  }

  criteria.guarantee = {
    value: mode,
    coverage,
    points,
    maxPoints: 15,
    status,
    verdict,
  };

  return {
    points: Math.max(0, Math.min(15, points)),
    maxPoints: 15,
    detail: verdict,
    alerts,
    criteria,
    mode,
    isStrong: ['VISALE', 'BANK_DEPOSIT'].includes(mode) || (mode === 'PHYSICAL' && points >= 13),
  };
}

// ── Modificateurs globaux ──────────────────────────────────────────────────

function applyGlobalModifiers({ baseScore, stability, guarantee, diditStatus, documentsRejectedCount = 0 }) {
  const modifiers = [];
  let score = baseScore;

  // Modif 1 : profil limite (CDD/freelance/étudiant) SANS garant solide → -15 pts
  if (stability.isLimited && !guarantee.isStrong) {
    modifiers.push({
      code: 'LIMITED_PROFILE_NO_GUARANTEE',
      points: -15,
      message: `Profil ${stability.contractType} sans garantie solide — Visale ou garant solvable fortement recommandés.`,
      severity: 'warning',
    });
    score -= 15;
  }

  // Modif 2 : Identité Didit FAILED → -10 pts
  if (String(diditStatus || '').toUpperCase() === 'FAILED') {
    modifiers.push({
      code: 'IDENTITY_FAILED',
      points: -10,
      message: 'Vérification biométrique Didit échouée. Risque d\'usurpation.',
      severity: 'critical',
    });
    score -= 10;
  }

  // Modif 3 : Document(s) REJECTED → -8 pts
  if (documentsRejectedCount > 0) {
    const malus = Math.min(15, 8 * documentsRejectedCount);
    modifiers.push({
      code: 'DOCUMENTS_REJECTED',
      points: -malus,
      message: `${documentsRejectedCount} document(s) rejeté(s) par l'audit IA.`,
      severity: 'warning',
    });
    score -= malus;
  }

  return { score: Math.max(0, score), modifiers };
}

// ── Hard gates ─────────────────────────────────────────────────────────────

function applyHardGates({ score, hasPayslips, hasTaxNotice, hasAnyDocument, auditStatus }) {
  let capped = score;
  const gates = [];

  if (!hasAnyDocument) {
    capped = Math.min(capped, 10);
    gates.push({ code: 'NO_DOCUMENTS', cap: 10, message: 'Aucun document fourni.' });
  } else if (!hasPayslips && !hasTaxNotice) {
    capped = Math.min(capped, 30);
    gates.push({ code: 'NO_INCOME_PROOF', cap: 30, message: 'Aucune fiche de paie ni avis d\'imposition.' });
  }

  if (String(auditStatus || '').toUpperCase() === 'ALERT') {
    capped = Math.min(capped, 45);
    gates.push({ code: 'FORENSIC_ALERT', cap: 45, message: 'Audit Forensic en alerte — score plafonné.' });
  }

  return { score: capped, gates };
}

// ── Grade ──────────────────────────────────────────────────────────────────

function deriveGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

// ── Score global ───────────────────────────────────────────────────────────

/**
 * Calcule le score complet d'un candidat selon les critères V1.2 objectifs.
 * @param {Object} params
 * @param {Object} params.cand - Document Candidature/Application
 * @param {Object} params.property - Document Property
 * @param {Object} [params.extractedData] - Données extraites par IA
 * @param {Object} [params.consistencyCheck] - Résultat de cohérence
 * @param {Array}  [params.payslipAudits] - Audits fiches de paie
 * @param {string} [params.diditStatus] - VERIFIED / PENDING / FAILED
 * @param {string} [params.auditStatus] - CLEAR / REVIEW / ALERT / PENDING
 * @param {Object} [params.guarantee] - { mode, guarantorIncome, visaleConfirmed }
 * @param {number} [params.documentsRejectedCount]
 * @returns {Object} - Score complet avec breakdown, criteria, alerts, flags
 */
function computePatrimoCoreScore({
  cand,
  property,
  extractedData = null,
  consistencyCheck = null,
  payslipAudits = [],
  diditStatus = null,
  auditStatus = null,
  guarantee = null,
  documentsRejectedCount = 0,
} = {}) {
  const breakdown = [];
  const flags = [];
  const alerts = [];

  const rent = Number(property?.rentAmount || 0) || 0;
  const charges = Number(property?.chargesAmount || 0) || 0;

  const netSalary = extractedData?.netSalary || Number(cand?.monthlyNetIncome || 0) || 0;
  const contractType = extractedData?.contractType || String(cand?.contractType || '').trim();

  // Détection présence documents
  const docs = Array.isArray(cand?.docs) ? cand.docs : [];
  const hasPayslips = (payslipAudits && payslipAudits.length > 0) || docs.some(d => {
    const name = (d.originalName || '').toLowerCase();
    return name.includes('paie') || name.includes('bulletin') || name.includes('salaire');
  });
  const hasTaxNotice = docs.some(d => {
    const name = (d.originalName || '').toLowerCase();
    return name.includes('imposition') || name.includes('fiscal') || name.includes('avis');
  });
  const hasAnyDocument = docs.length > 0;

  // Résolution Didit / Audit fallback depuis cand
  const resolvedDiditStatus = diditStatus || cand?.didit?.status || 'PENDING';
  const resolvedAuditStatus = auditStatus || cand?.aiAudit?.status || cand?.trustAnalysis?.status || 'PENDING';
  const resolvedGuarantee = guarantee || {
    mode: cand?.guarantee?.mode || 'NONE',
    guarantorIncome: Number(cand?.guarantee?.guarantorIncome || 0),
    visaleConfirmed: Boolean(cand?.guarantee?.visaleConfirmed),
  };

  // ── Hard gate immédiat : aucun document ──
  if (!hasAnyDocument) {
    return {
      version: 'patrimo-criteria-v3',
      total: 0,
      grade: 'E',
      ratio: 0,
      breakdown: [{
        key: 'hard_gate',
        label: 'Hard Gate',
        points: 0,
        detail: 'Aucun document fourni.',
      }],
      flags: ['no_documents', 'hard_gate_triggered'],
      alerts: [{
        type: 'critical',
        code: 'NO_DOCUMENTS',
        message: 'Aucun document fourni. Dossier incomplet.',
      }],
      hardGateTriggered: true,
    };
  }

  // ── Piliers ──
  const solvability = calculateSolvabilityScore(netSalary, rent, charges);
  breakdown.push({
    key: 'solvability',
    label: 'Solvabilité (50 pts)',
    points: solvability.points,
    maxPoints: 50,
    detail: solvability.detail,
  });
  alerts.push(...solvability.alerts);

  const stability = calculateStabilityScore(contractType, extractedData);
  breakdown.push({
    key: 'stability',
    label: 'Stabilité (20 pts)',
    points: stability.points,
    maxPoints: 20,
    detail: stability.detail,
  });
  alerts.push(...stability.alerts);

  const authenticity = calculateAuthenticityScore({
    consistencyCheck,
    payslipAudits,
    diditStatus: resolvedDiditStatus,
    auditStatus: resolvedAuditStatus,
  });
  breakdown.push({
    key: 'authenticity',
    label: 'Authenticité (15 pts)',
    points: authenticity.points,
    maxPoints: 15,
    detail: authenticity.detail,
  });
  alerts.push(...authenticity.alerts);

  const guaranteeScore = calculateGuaranteeScore({
    guaranteeMode: resolvedGuarantee.mode,
    guarantorIncome: resolvedGuarantee.guarantorIncome,
    monthlyRent: rent,
    visaleConfirmed: resolvedGuarantee.visaleConfirmed,
  });
  breakdown.push({
    key: 'guarantee',
    label: 'Garantie (15 pts)',
    points: guaranteeScore.points,
    maxPoints: 15,
    detail: guaranteeScore.detail,
  });
  alerts.push(...guaranteeScore.alerts);

  // ── Score brut ──
  const baseScore = solvability.points + stability.points + authenticity.points + guaranteeScore.points;

  // ── Modificateurs globaux ──
  const { score: modifiedScore, modifiers } = applyGlobalModifiers({
    baseScore,
    stability,
    guarantee: guaranteeScore,
    diditStatus: resolvedDiditStatus,
    documentsRejectedCount,
  });

  // ── Hard gates ──
  const { score: cappedScore, gates } = applyHardGates({
    score: modifiedScore,
    hasPayslips,
    hasTaxNotice,
    hasAnyDocument,
    auditStatus: resolvedAuditStatus,
  });

  const total = Math.max(0, Math.min(100, Math.round(cappedScore)));
  const grade = deriveGrade(total);

  // Flags
  if (solvability.effortRate > 0.33) flags.push('rent_too_high');
  if (stability.isLimited && !guaranteeScore.isStrong) flags.push('limited_profile_no_guarantee');
  if (authenticity.points < 8) flags.push('authenticity_issues');
  if (alerts.some(a => a.type === 'critical')) flags.push('critical_alerts');
  if (gates.length > 0) flags.push('hard_gate_triggered');

  // Critères consolidés pour l'UI
  const criteria = {
    ...solvability.criteria,
    ...stability.criteria,
    ...authenticity.criteria,
    ...guaranteeScore.criteria,
  };

  return {
    version: 'patrimo-criteria-v3',
    total,
    grade,
    ratio: solvability.ratio,
    remaining: solvability.remaining,
    effortRate: solvability.effortRate,
    breakdown,
    criteria,
    flags: Array.from(new Set(flags)),
    alerts,
    modifiers,
    hardGates: gates,
    hardGateTriggered: gates.length > 0,
    extractedData: extractedData ? {
      netSalary,
      grossSalary: extractedData.grossSalary,
      contractType,
      siret: extractedData.siret,
    } : null,
  };
}

module.exports = {
  computePatrimoCoreScore,
  calculateSolvabilityScore,
  calculateStabilityScore,
  calculateAuthenticityScore,
  calculateGuaranteeScore,
  THRESHOLDS,
};
