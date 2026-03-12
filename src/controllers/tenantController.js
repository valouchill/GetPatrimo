// Controller pour la gestion des locataires
const Tenant = require('../../models/Tenant');
const Property = require('../../models/Property');
const Event = require('../../models/Event');
const { logEvent } = require('../services/eventService');

/**
 * Création d'un nouveau locataire
 */
async function createTenant(req, res) {
  try {
    const { firstName, lastName, email, property } = req.body || {};
    
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ msg: 'Champs manquants' });
    }

    let prop = null;
    if (property) {
      prop = await Property.findOne({ _id: property, user: req.user.id });
      if (!prop) {
        return res.status(404).json({ msg: 'Bien introuvable' });
      }
    }

    const t = await Tenant.create({
      user: req.user.id,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).toLowerCase().trim(),
      property: prop ? prop._id : undefined
    });

    await logEvent(req.user.id, { 
      property: (prop ? prop._id : null), 
      tenant: t._id, 
      type: 'tenant_created' 
    });
    
    return res.json(t);
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return res.status(400).json({ msg: 'Un locataire est déjà lié à ce bien' });
    }
    console.error('Erreur createTenant:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Liste tous les locataires de l'utilisateur
 */
async function getTenants(req, res) {
  try {
    const items = await Tenant.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.json(items);
  } catch (error) {
    console.error('Erreur getTenants:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupère le locataire d'un bien spécifique
 */
async function getTenantByProperty(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }
    
    const t = await Tenant.findOne({ user: req.user.id, property: p._id });
    return res.json(t || null);
  } catch (error) {
    console.error('Erreur getTenantByProperty:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupère un locataire par son ID
 */
async function getTenantById(req, res) {
  try {
    const t = await Tenant.findOne({ _id: req.params.id, user: req.user.id });
    if (!t) {
      return res.status(404).json({ msg: 'Locataire introuvable' });
    }
    return res.json(t);
  } catch (error) {
    console.error('Erreur getTenantById:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Met à jour un locataire
 */
async function updateTenant(req, res) {
  try {
    const t = await Tenant.findOne({ _id: req.params.id, user: req.user.id });
    if (!t) {
      return res.status(404).json({ msg: 'Locataire introuvable' });
    }

    const body = req.body || {};
    
    if ('firstName' in body) {
      t.firstName = String(body.firstName || '').trim() || t.firstName;
    }
    
    if ('lastName' in body) {
      t.lastName = String(body.lastName || '').trim() || t.lastName;
    }
    
    if ('email' in body) {
      t.email = String(body.email || '').toLowerCase().trim() || t.email;
    }

    if ('property' in body) {
      if (!body.property) {
        t.property = undefined;
      } else {
        const p = await Property.findOne({ _id: body.property, user: req.user.id });
        if (!p) {
          return res.status(404).json({ msg: 'Bien introuvable' });
        }
        t.property = p._id;
      }
    }

    await t.save();
    await logEvent(req.user.id, { 
      property: t.property || null, 
      tenant: t._id, 
      type: 'tenant_updated' 
    });
    
    return res.json(t);
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return res.status(400).json({ msg: 'Un locataire est déjà lié à ce bien' });
    }
    console.error('Erreur updateTenant:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Supprime un locataire
 */
async function deleteTenant(req, res) {
  try {
    const t = await Tenant.findOne({ _id: req.params.id, user: req.user.id });
    if (!t) {
      return res.status(404).json({ msg: 'Locataire introuvable' });
    }
    
    await Event.deleteMany({ user: req.user.id, tenant: t._id });
    await t.deleteOne();
    
    await logEvent(req.user.id, { 
      type: 'tenant_deleted', 
      meta: { tenantId: String(req.params.id) } 
    });
    
    return res.json({ msg: 'OK' });
  } catch (error) {
    console.error('Erreur deleteTenant:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = {
  createTenant,
  getTenants,
  getTenantByProperty,
  getTenantById,
  updateTenant,
  deleteTenant
};
