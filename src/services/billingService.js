// Service de gestion du paywall et des limites de facturation
const { LIMITS } = require('../config/app');

/**
 * Génère une clé de mois au format YYYY-MM
 * @returns {string}
 */
function monthKey() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0');
}

/**
 * Vérifie et applique la limite d'envoi d'emails de quittance pour un utilisateur
 * @param {Object} userDoc - Document utilisateur Mongoose
 * @returns {Promise<Object>} - { ok: boolean, status?: number, msg?: string, plan?: string, sent?: number, limit?: number }
 */
async function enforceReceiptEmailLimit(userDoc) {
  try {
    const plan = String(userDoc.plan || 'FREE').toUpperCase();
    const limit = LIMITS[plan] ?? LIMITS.FREE;

    const key = monthKey();
    const cur = userDoc.usage?.receipts?.month === key 
      ? Number(userDoc.usage.receipts.sent || 0) 
      : 0;

    if (cur >= limit) {
      return { 
        ok: false, 
        status: 402, 
        msg: `Limite atteinte : ${limit} emails quittance/mois sur le plan ${plan}.` 
      };
    }

    // Incrément du compteur
    userDoc.usage = userDoc.usage || {};
    userDoc.usage.receipts = userDoc.usage.receipts || {};
    userDoc.usage.receipts.month = key;
    userDoc.usage.receipts.sent = cur + 1;
    await userDoc.save();

    return { ok: true, plan, sent: cur + 1, limit };
  } catch (error) {
    console.error("Erreur enforceReceiptEmailLimit:", error);
    return { ok: false, status: 500, msg: 'Erreur serveur' };
  }
}

module.exports = {
  monthKey,
  enforceReceiptEmailLimit
};
