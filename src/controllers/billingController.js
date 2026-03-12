// Controller pour la facturation et les limites
const User = require('../../models/User');
const { LIMITS } = require('../config/app');

/**
 * Récupère le statut de facturation de l'utilisateur
 */
async function getBillingStatus(req, res) {
  try {
    const u = await User.findById(req.user.id).select('plan usage credits');
    const plan = (u?.plan || 'FREE');
    const sent = (u?.usage?.receipts?.sent ?? 0);
    
    return res.json({
      plan,
      usage: { receiptsSent: sent },
      limits: { 
        receiptEmailPerMonth: { 
          FREE: LIMITS.FREE, 
          PRO: LIMITS.PRO 
        } 
      }
    });
  } catch (error) {
    console.error('Erreur getBillingStatus:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = {
  getBillingStatus
};
