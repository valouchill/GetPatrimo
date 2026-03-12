/**
 * Controller pour TrustEngine
 */

const { generateReliabilityReport, deleteCandidateData, autoPurgeRGPD } = require('../services/trustEngineService');
const Candidature = require('../../models/Candidature');
const Property = require('../../models/Property');

/**
 * Génère un rapport de fiabilité pour une candidature
 * GET /api/trust/reliability/:candidatureId
 */
async function getReliabilityReport(req, res) {
  try {
    const candidatureId = req.params.candidatureId;
    
    const candidature = await Candidature.findOne({
      _id: candidatureId
    }).populate('property');
    
    if (!candidature) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }
    
    // Vérifie que le propriétaire a accès à ce bien
    const property = await Property.findOne({
      _id: candidature.property,
      user: req.user.id
    });
    
    if (!property) {
      return res.status(403).json({ msg: 'Accès non autorisé' });
    }
    
    const report = generateReliabilityReport(candidature);
    
    return res.json(report);
  } catch (error) {
    console.error('Erreur getReliabilityReport:', error);
    return res.status(500).json({ msg: 'Erreur génération rapport' });
  }
}

/**
 * Suppression des données par le candidat (RGPD)
 * POST /api/trust/rgpd/delete
 */
async function requestDataDeletion(req, res) {
  try {
    const { candidatureId, email } = req.body || {};
    
    if (!candidatureId || !email) {
      return res.status(400).json({ msg: 'Candidature ID et email requis' });
    }
    
    const result = await deleteCandidateData(candidatureId, email);
    
    if (!result.success) {
      return res.status(400).json({ msg: result.error });
    }
    
    return res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Erreur requestDataDeletion:', error);
    return res.status(500).json({ msg: 'Erreur suppression données' });
  }
}

/**
 * Purge automatique RGPD (cron job)
 * POST /api/trust/rgpd/purge
 */
async function triggerAutoPurge(req, res) {
  try {
    // Vérifie que l'utilisateur est admin (optionnel, peut être appelé par cron)
    const result = await autoPurgeRGPD();
    
    return res.json(result);
  } catch (error) {
    console.error('Erreur triggerAutoPurge:', error);
    return res.status(500).json({ msg: 'Erreur purge automatique' });
  }
}

module.exports = {
  getReliabilityReport,
  requestDataDeletion,
  triggerAutoPurge
};
