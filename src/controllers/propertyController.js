// Controller pour la gestion des biens immobiliers
const Property = require('../../models/Property');
const Tenant = require('../../models/Tenant');
const Document = require('../../models/Document');
const Event = require('../../models/Event');
const { validateFrenchCommune } = require('../services/geoService');
const { logEvent } = require('../services/eventService');

/**
 * Création d'un nouveau bien
 */
async function createProperty(req, res) {
  try {
    const { name, rentAmount, chargesAmount, address, addressLine, zipCode, city, surfaceM2 } = req.body || {};
    
    if (!name || !String(name).trim()) {
      return res.status(400).json({ msg: 'Dénomination obligatoire' });
    }

    const rent = Number(rentAmount);
    if (!Number.isFinite(rent) || rent <= 0) {
      return res.status(400).json({ msg: 'Loyer invalide' });
    }

    const line = String(addressLine || '').trim();
    const zip = String(zipCode || '').trim();
    const cty = String(city || '').trim();

    let fullAddress = String(address || '').trim();
    
    if (line && zip && cty) {
      if (!/^\d{5}$/.test(zip)) {
        return res.status(400).json({ msg: 'Code postal invalide (5 chiffres)' });
      }
      
      const okCity = await validateFrenchCommune(zip, cty);
      if (!okCity) {
        return res.status(400).json({ msg: "Code postal / commune invalide (geo.api.gouv.fr)" });
      }
      
      fullAddress = `${line}, ${zip} ${cty}`;
    } else {
      if (!fullAddress) {
        return res.status(400).json({ msg: 'Adresse incomplète' });
      }
    }

    const ch = Number(chargesAmount);
    const charges = Number.isFinite(ch) && ch >= 0 ? ch : 0;

    const s = Number(surfaceM2);
    const surface = Number.isFinite(s) && s > 0 ? s : undefined;

    const prop = await Property.create({
      user: req.user.id,
      name: String(name).trim(),
      address: fullAddress,
      addressLine: line,
      zipCode: zip,
      city: cty,
      rentAmount: rent,
      chargesAmount: charges,
      surfaceM2: surface
    });

    await logEvent(req.user.id, { 
      property: prop._id, 
      type: 'property_created', 
      meta: { name: prop.name } 
    });
    
    return res.json(prop);
  } catch (error) {
    console.error('Erreur createProperty:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Liste tous les biens de l'utilisateur
 */
async function getProperties(req, res) {
  try {
    const props = await Property.find({ user: req.user.id }).sort({ createdAt: -1 });
    return res.json(props);
  } catch (error) {
    console.error('Erreur getProperties:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupère un bien par son ID
 */
async function getPropertyById(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }
    return res.json(p);
  } catch (error) {
    console.error('Erreur getPropertyById:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Met à jour un bien
 */
async function updateProperty(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const body = req.body || {};
    
    // Si c'est une mise à jour des documents obligatoires uniquement (route PATCH /:id/required-documents)
    if (req.route && req.route.path && req.route.path.includes('required-documents')) {
      if ('requiredDocuments' in body && Array.isArray(body.requiredDocuments)) {
        p.requiredDocuments = body.requiredDocuments.map((doc, index) => ({
          name: String(doc.name || '').trim(),
          description: String(doc.description || '').trim(),
          isMandatory: Boolean(doc.isMandatory !== false),
          order: Number(doc.order) || index,
          createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date()
        }));
        await p.save();
        await logEvent(req.user.id, { property: p._id, type: 'property_required_documents_updated' });
        return res.json({
          success: true,
          msg: 'Documents obligatoires mis à jour',
          property: p
        });
      }
      return res.status(400).json({ msg: 'requiredDocuments requis' });
    }
    
    // Gestion des diagnostics techniques (DDT)
    if ('diagnostics' in body && Array.isArray(body.diagnostics)) {
      p.diagnostics = body.diagnostics.map(diag => ({
        type: String(diag.type || ''),
        documentId: diag.documentId || null,
        uploadedAt: diag.uploadedAt ? new Date(diag.uploadedAt) : new Date(),
        expiryDate: diag.expiryDate ? new Date(diag.expiryDate) : null,
        isValid: Boolean(diag.isValid !== false)
      }));
      await logEvent(req.user.id, { property: p._id, type: 'property_diagnostics_updated' });
    }
    
    if ('name' in body) {
      p.name = String(body.name || '').trim() || p.name;
    }
    
    if ('rentAmount' in body) {
      const rent = Number(body.rentAmount);
      if (!Number.isFinite(rent) || rent <= 0) {
        return res.status(400).json({ msg: 'Loyer invalide' });
      }
      p.rentAmount = rent;
    }
    
    if ('chargesAmount' in body) {
      const ch = Number(body.chargesAmount);
      p.chargesAmount = Number.isFinite(ch) && ch >= 0 ? ch : 0;
    }

    const line = ('addressLine' in body) ? String(body.addressLine || '').trim() : p.addressLine;
    const zip = ('zipCode' in body) ? String(body.zipCode || '').trim() : p.zipCode;
    const cty = ('city' in body) ? String(body.city || '').trim() : p.city;

    p.addressLine = line;
    p.zipCode = zip;
    p.city = cty;
    
    // Génération de token pour lien public de candidature
    if (body.generateToken === true && !p.applyToken) {
      const crypto = require('crypto');
      p.applyToken = crypto.randomBytes(32).toString('hex');
    }

    if (line && zip && cty) {
      if (!/^\d{5}$/.test(zip)) {
        return res.status(400).json({ msg: 'Code postal invalide (5 chiffres)' });
      }
      
      const okCity = await validateFrenchCommune(zip, cty);
      if (!okCity) {
        return res.status(400).json({ msg: "Code postal / commune invalide (geo.api.gouv.fr)" });
      }
      
      p.address = `${line}, ${zip} ${cty}`;
    } else if ('address' in body) {
      p.address = String(body.address || '').trim() || p.address;
    }

    // Met à jour les documents obligatoires si fournis
    if ('requiredDocuments' in body && Array.isArray(body.requiredDocuments)) {
      p.requiredDocuments = body.requiredDocuments.map((doc, index) => ({
        name: String(doc.name || '').trim(),
        description: String(doc.description || '').trim(),
        isMandatory: Boolean(doc.isMandatory !== false),
        order: Number(doc.order) || index,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date()
      }));
    }

    // Met à jour le statut du bien (VACANT, OCCUPIED, etc.)
    if ('status' in body) {
      const validStatuses = ['AVAILABLE', 'CANDIDATE_SELECTION', 'LEASE_IN_PROGRESS', 'OCCUPIED', 'VACANT'];
      if (validStatuses.includes(body.status)) {
        p.status = body.status;
        await logEvent(req.user.id, { property: p._id, type: 'property_status_changed', meta: { newStatus: body.status } });
      }
    }

    await p.save();
    await logEvent(req.user.id, { property: p._id, type: 'property_updated' });
    return res.json(p);
  } catch (error) {
    console.error('Erreur updateProperty:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Supprime un bien et toutes ses données associées
 */
async function deleteProperty(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    await Tenant.deleteMany({ user: req.user.id, property: p._id });
    await Document.deleteMany({ user: req.user.id, property: p._id });
    await Event.deleteMany({ user: req.user.id, property: p._id });
    await p.deleteOne();

    await logEvent(req.user.id, { 
      type: 'property_deleted', 
      meta: { propertyId: String(req.params.id) } 
    });
    
    return res.json({ msg: 'OK' });
  } catch (error) {
    console.error('Erreur deleteProperty:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Génère ou récupère le lien de candidature pour un bien
 */
async function generateApplyLink(req, res) {
  try {
    const prop = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if (!prop) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    // Génère le token s'il n'existe pas
    if (!prop.applyToken) {
      const crypto = require('crypto');
      prop.applyToken = crypto.randomBytes(32).toString('hex');
      await prop.save();
      
      await logEvent(req.user.id, { 
        type: 'apply_link_created', 
        property: prop._id, 
        meta: { propertyName: prop.name } 
      });
    }

    // Construit l'URL complète
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const url = `${protocol}://${host}/apply/${prop.applyToken}`;

    return res.json({ token: prop.applyToken, url });
  } catch (error) {
    console.error('Erreur generateApplyLink:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  generateApplyLink
};
