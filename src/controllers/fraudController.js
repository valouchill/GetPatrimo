// Controller pour les rapports de fraude
const Candidature = require('../../models/Candidature');
const Property = require('../../models/Property');
const { generateFraudReport } = require('../services/alertService');

/**
 * Récupère le rapport de fraude détaillé pour une candidature
 */
async function getFraudReport(req, res) {
  try {
    const candId = req.params.id;
    const userId = req.user.id;

    // Récupère la candidature et vérifie qu'elle appartient au propriétaire
    const cand = await Candidature.findById(candId);
    if (!cand) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    const prop = await Property.findById(cand.property);
    if (!prop) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    // Vérifie que le bien appartient à l'utilisateur
    if (String(prop.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Génère le rapport de fraude
    const report = generateFraudReport(
      {
        scoring: cand.scoring || null,
        consistencyCheck: cand.consistencyCheck || null,
        payslipAudits: cand.payslipAudits || [],
        extractedData: cand.extractedData || null
      },
      cand,
      prop
    );

    return res.json(report);
  } catch (error) {
    console.error('Erreur getFraudReport:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = {
  getFraudReport
};
