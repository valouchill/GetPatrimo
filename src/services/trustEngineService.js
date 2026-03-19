const fs = require('fs');
const path = require('path');

const { buildPhase1Audit, runPhase1Audit: runPhase1AuditPure } = require('./phase1AuditService');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculatePatrimoTrustScore(applicationData = {}) {
  const property = applicationData.property || {};
  const candidature = applicationData.candidature || {};
  const monthlyNetIncome = Number(applicationData.monthlyNetIncome || candidature.monthlyNetIncome || 0);
  const annualTaxIncome = Number(applicationData.annualTaxIncome || 0);
  const sumLast12MonthsSalary = Number(applicationData.sumLast12MonthsSalary || (monthlyNetIncome * 12) || 0);
  const contractType = String(applicationData.contractType || candidature.contractType || '').toUpperCase();
  const rentAmount = Number(property.rentAmount || 0) + Number(property.chargesAmount || 0);

  let solvencyScore = 0;
  if (monthlyNetIncome > 0 && rentAmount > 0) {
    const ratio = monthlyNetIncome / rentAmount;
    if (ratio >= 3) solvencyScore = 100;
    else if (ratio >= 2.5) solvencyScore = 85;
    else if (ratio >= 2) solvencyScore = 70;
    else if (ratio >= 1.5) solvencyScore = 45;
    else solvencyScore = 10;
  }

  let coherenceScore = 50;
  if (annualTaxIncome > 0 && sumLast12MonthsSalary > 0) {
    const ratio = Math.abs(annualTaxIncome - sumLast12MonthsSalary) /
      Math.max(annualTaxIncome, sumLast12MonthsSalary, 1);
    if (ratio <= 0.05) coherenceScore = 100;
    else if (ratio <= 0.1) coherenceScore = 75;
    else if (ratio <= 0.15) coherenceScore = 50;
    else coherenceScore = 0;
  }

  let stabilityScore = 30;
  if (contractType === 'CDI') stabilityScore = 100;
  else if (contractType === 'CDD') stabilityScore = 60;
  else if (contractType === 'RETRAITE') stabilityScore = 70;
  else if (contractType === 'FREELANCE' || contractType === 'INDEPENDANT') stabilityScore = 40;

  let integrityScore = 80;
  if (applicationData.metadataStatus === 'flagged' || applicationData.idValidation === false) {
    integrityScore = 0;
  } else if (applicationData.metadataStatus === 'warning') {
    integrityScore = 60;
  } else if (applicationData.idValidation === true) {
    integrityScore = 100;
  }

  const globalScore = Math.round(
    (solvencyScore * 0.4) +
    (coherenceScore * 0.3) +
    (stabilityScore * 0.2) +
    (integrityScore * 0.1)
  );

  return {
    globalScore,
    rating: globalScore >= 85 ? 'A' : globalScore >= 70 ? 'B' : globalScore >= 55 ? 'C' : 'D',
    breakdown: {
      solvency: { score: solvencyScore },
      coherence: { score: coherenceScore },
      stability: { score: stabilityScore },
      integrity: { score: integrityScore },
    },
    aiInsight:
      globalScore >= 80
        ? 'Dossier solide avec signaux de confiance élevés.'
        : globalScore >= 60
          ? 'Dossier acceptable avec quelques réserves.'
          : 'Dossier fragile nécessitant une vérification renforcée.',
  };
}

async function runPhase1Audit(input, options = {}) {
  if (typeof input === 'string' || (input && typeof input === 'object' && input.candidatureId)) {
    const candidatureId = typeof input === 'string' ? input : input.candidatureId;
    const Candidature = require('../../models/Candidature');
    const Property = require('../../models/Property');

    const candidature = await Candidature.findById(candidatureId).lean();
    if (!candidature) {
      throw new Error('Candidature introuvable');
    }

    const property = await Property.findById(candidature.property).lean();

    return runPhase1AuditPure(
      {
        candidature,
        property: property || {},
        documents: candidature.docs || [],
      },
      options
    );
  }

  const payload = input && input.candidature
    ? {
        candidature: input.candidature,
        property: input.property || {},
        documents: input.documents || input.candidature.docs || [],
      }
    : input;

  return runPhase1AuditPure(payload, options);
}

async function analyzeCandidatureTrust(candidature, property, options = {}) {
  return runPhase1Audit(
    {
      candidature,
      property,
      documents: candidature.docs || [],
    },
    options
  );
}

function generateReliabilityReport(candidature = {}) {
  const trustAnalysis = candidature.trustAnalysis || {};
  const phase1 = trustAnalysis.phase1 || {};

  return {
    candidateId: candidature._id || null,
    score: trustAnalysis.score || 0,
    status: trustAnalysis.status || 'PENDING',
    summary: trustAnalysis.summary || 'Aucune analyse disponible.',
    fraudStatus: phase1.fraudStatus || 'PENDING',
    workflowDecision: phase1.workflowDecision || null,
    fraudScore: phase1.fraudScore ?? null,
    pointsIncoherence: phase1.pointsIncoherence || [],
    checks: trustAnalysis.checks || [],
    analyzedAt: trustAnalysis.analyzedAt || null,
  };
}

async function purgeCandidateFiles(documents = []) {
  const { uploadsDir } = require('../config/app');

  for (const document of documents) {
    if (!document?.relPath) continue;

    const absolutePath = path.resolve(uploadsDir, document.relPath);
    if (!absolutePath.startsWith(path.resolve(uploadsDir))) continue;

    try {
      await fs.promises.unlink(absolutePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('⚠️ Impossible de supprimer un fichier RGPD:', absolutePath, error.message);
      }
    }
  }
}

async function deleteCandidateData(candidatureId, email) {
  const Candidature = require('../../models/Candidature');

  const candidature = await Candidature.findById(candidatureId);
  if (!candidature) {
    return { success: false, error: 'Candidature introuvable' };
  }

  if (String(candidature.email || '').trim().toLowerCase() !== String(email || '').trim().toLowerCase()) {
    return { success: false, error: 'Email non correspondant' };
  }

  await purgeCandidateFiles(candidature.docs || []);

  candidature.firstName = '';
  candidature.lastName = '';
  candidature.email = '';
  candidature.phone = '';
  candidature.message = '';
  candidature.docs = [];
  candidature.monthlyNetIncome = 0;
  candidature.contractType = '';
  candidature.hasGuarantor = false;
  candidature.guarantorType = '';
  candidature.trustAnalysis = {
    score: 0,
    status: 'PENDING',
    summary: 'Données supprimées dans le cadre du droit à l’effacement.',
    checks: [],
    phase1: null,
    analyzedAt: new Date(),
  };
  candidature.rgpdPurged = true;
  candidature.rgpdPurgedAt = new Date();

  await candidature.save();

  return {
    success: true,
    message: 'Les données du candidat ont été supprimées.',
  };
}

async function autoPurgeRGPD() {
  const Candidature = require('../../models/Candidature');

  const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const candidates = await Candidature.find({
    rgpdPurged: { $ne: true },
    status: { $in: ['REJECTED', 'ARCHIVED_REFUSED'] },
    updatedAt: { $lt: cutoffDate },
  });

  let purgedCount = 0;

  for (const candidature of candidates) {
    await purgeCandidateFiles(candidature.docs || []);

    candidature.firstName = '';
    candidature.lastName = '';
    candidature.email = '';
    candidature.phone = '';
    candidature.message = '';
    candidature.docs = [];
    candidature.monthlyNetIncome = 0;
    candidature.contractType = '';
    candidature.hasGuarantor = false;
    candidature.guarantorType = '';
    candidature.rgpdPurged = true;
    candidature.rgpdPurgedAt = new Date();

    await candidature.save();
    purgedCount += 1;
  }

  return {
    success: true,
    purgedCount,
  };
}

async function buildPhase1AuditBundle(input, options = {}) {
  if (typeof input === 'string' || (input && typeof input === 'object' && input.candidatureId)) {
    const candidatureId = typeof input === 'string' ? input : input.candidatureId;
    const Candidature = require('../../models/Candidature');
    const Property = require('../../models/Property');

    const candidature = await Candidature.findById(candidatureId).lean();
    if (!candidature) throw new Error('Candidature introuvable');

    const property = await Property.findById(candidature.property).lean();
    return buildPhase1Audit(
      {
        candidature,
        property: property || {},
        documents: candidature.docs || [],
      },
      options
    );
  }

  return buildPhase1Audit(input, options);
}

module.exports = {
  analyzeCandidatureTrust,
  autoPurgeRGPD,
  buildPhase1Audit: buildPhase1AuditBundle,
  calculatePatrimoTrustScore,
  deleteCandidateData,
  generateReliabilityReport,
  runPhase1Audit,
};
