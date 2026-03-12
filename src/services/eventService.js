// Service de logging des événements
const Event = require('../../models/Event');

/**
 * Enregistre un événement dans le système
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} data - Données de l'événement
 * @param {string} data.type - Type d'événement
 * @param {string} [data.property] - ID du bien (optionnel)
 * @param {string} [data.tenant] - ID du locataire (optionnel)
 * @param {Object} [data.meta] - Métadonnées supplémentaires (optionnel)
 */
async function logEvent(userId, { property = null, tenant = null, type, meta = {} }) {
  try {
    await Event.create({ 
      user: userId, 
      property, 
      tenant, 
      type, 
      meta 
    });
  } catch (error) {
    console.error("logEvent error:", error?.message);
  }
}

module.exports = { logEvent };
