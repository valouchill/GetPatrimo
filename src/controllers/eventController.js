// Controller pour la gestion des événements (historique)
const Property = require('../../models/Property');
const Tenant = require('../../models/Tenant');
const Event = require('../../models/Event');

/**
 * Récupère les événements d'un bien
 */
async function getPropertyEvents(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const limit = Math.min(Number(req.query.limit || 50), 200);
    const items = await Event.find({ user: req.user.id, property: p._id })
      .sort({ createdAt: -1 })
      .limit(limit);
    
    return res.json(items);
  } catch (error) {
    console.error('Erreur getPropertyEvents:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupère les événements d'un locataire
 */
async function getTenantEvents(req, res) {
  try {
    const t = await Tenant.findOne({ _id: req.params.tenantId, user: req.user.id });
    if (!t) {
      return res.status(404).json({ msg: 'Locataire introuvable' });
    }

    const limit = Math.min(Number(req.query.limit || 50), 200);
    const items = await Event.find({ user: req.user.id, tenant: t._id })
      .sort({ createdAt: -1 })
      .limit(limit);
    
    return res.json(items);
  } catch (error) {
    console.error('Erreur getTenantEvents:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupère un résumé des événements récents
 */
async function getEventsSummary(req, res) {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last = await Event.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(15);
    
    const count30 = await Event.countDocuments({ 
      user: req.user.id, 
      createdAt: { $gte: since } 
    });
    
    return res.json({ last, count30 });
  } catch (error) {
    console.error('Erreur getEventsSummary:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = {
  getPropertyEvents,
  getTenantEvents,
  getEventsSummary
};
