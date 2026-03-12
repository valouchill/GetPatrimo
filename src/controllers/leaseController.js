const Lease = require('../../models/Lease');
const Property = require('../../models/Property');
const Candidature = require('../../models/Candidature');
const path = require('path');
const fs = require('fs');

/**
 * Récupère un bail par son ID
 */
async function getLeaseById(req, res) {
  try {
    const userId = req.user.id;
    const leaseId = req.params.id;

    const lease = await Lease.findById(leaseId)
      .populate('property', 'name address rentAmount chargesAmount')
      .populate('candidature', 'firstName lastName email phone scoring');

    if (!lease) {
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    // Vérifie que le bail appartient au propriétaire
    if (String(lease.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    return res.json(lease);
  } catch (error) {
    console.error('Erreur getLeaseById:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Met à jour le statut de signature
 */
async function updateLeaseSignature(req, res) {
  try {
    const userId = req.user.id;
    const leaseId = req.params.id;
    const { signatureData, signerType } = req.body; // 'owner' ou 'tenant'

    const lease = await Lease.findById(leaseId);
    if (!lease) {
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    if (String(lease.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Met à jour selon le signataire
    if (signerType === 'owner') {
      lease.ownerSignatureData = signatureData;
      lease.ownerSignedAt = new Date();
      if (lease.signatureStatus === 'PENDING') {
        lease.signatureStatus = 'SIGNED_BY_OWNER';
      } else if (lease.signatureStatus === 'SIGNED_BY_TENANT') {
        lease.signatureStatus = 'SIGNED_BOTH';
      }
    } else if (signerType === 'tenant') {
      lease.tenantSignatureData = signatureData;
      lease.tenantSignedAt = new Date();
      if (lease.signatureStatus === 'PENDING') {
        lease.signatureStatus = 'SIGNED_BY_TENANT';
      } else if (lease.signatureStatus === 'SIGNED_BY_OWNER') {
        lease.signatureStatus = 'SIGNED_BOTH';
      }
    }

    await lease.save();

    return res.json({
      success: true,
      msg: 'Signature enregistrée',
      lease: {
        id: lease._id,
        signatureStatus: lease.signatureStatus
      }
    });
  } catch (error) {
    console.error('Erreur updateLeaseSignature:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Met à jour l'état des lieux
 */
async function updateLeaseEDL(req, res) {
  try {
    const userId = req.user.id;
    const leaseId = req.params.id;
    const { rooms, completed } = req.body;

    const lease = await Lease.findById(leaseId);
    if (!lease) {
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    if (String(lease.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    if (rooms && Array.isArray(rooms)) {
      lease.edlData = lease.edlData || {};
      lease.edlData.rooms = rooms;
    }

    if (completed === true) {
      lease.edlStatus = 'COMPLETED';
      lease.edlData.completedAt = new Date();
    } else if (lease.edlStatus === 'PENDING' && rooms && rooms.length > 0) {
      lease.edlStatus = 'IN_PROGRESS';
    }

    await lease.save();

    return res.json({
      success: true,
      msg: 'État des lieux mis à jour',
      lease: {
        id: lease._id,
        edlStatus: lease.edlStatus,
        edlData: lease.edlData
      }
    });
  } catch (error) {
    console.error('Erreur updateLeaseEDL:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Upload une photo pour l'EDL
 */
async function uploadEDLPhoto(req, res) {
  try {
    const userId = req.user.id;
    const leaseId = req.params.id;
    const { roomName } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ msg: 'Aucun fichier fourni' });
    }

    const lease = await Lease.findById(leaseId);
    if (!lease) {
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    if (String(lease.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Initialise edlData si nécessaire
    if (!lease.edlData) {
      lease.edlData = { rooms: [] };
    }
    if (!lease.edlData.rooms) {
      lease.edlData.rooms = [];
    }

    // Trouve ou crée la pièce
    let room = lease.edlData.rooms.find(r => r.name === roomName);
    if (!room) {
      room = {
        name: roomName,
        condition: 'USAGE',
        photos: [],
        notes: ''
      };
      lease.edlData.rooms.push(room);
    }

    // Ajoute les photos
    const uploadedPhotos = req.files.map(file => ({
      filename: file.filename,
      relPath: path.join('edl', file.filename),
      uploadedAt: new Date()
    }));

    room.photos = room.photos || [];
    room.photos.push(...uploadedPhotos);

    // Met à jour le statut
    if (lease.edlStatus === 'PENDING') {
      lease.edlStatus = 'IN_PROGRESS';
    }

    await lease.save();

    return res.json({
      success: true,
      msg: `${uploadedPhotos.length} photo(s) ajoutée(s)`,
      photos: uploadedPhotos
    });
  } catch (error) {
    console.error('Erreur uploadEDLPhoto:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupère tous les baux d'un bien spécifique
 */
async function getLeasesByProperty(req, res) {
  try {
    const userId = req.user.id;
    const propertyId = req.params.propertyId;

    // Vérifie que le bien appartient au propriétaire
    const prop = await Property.findOne({ _id: propertyId, user: userId });
    if (!prop) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const leases = await Lease.find({ property: propertyId, user: userId })
      .populate('candidature', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(leases);
  } catch (error) {
    console.error('Erreur getLeasesByProperty:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Met à jour un bail
 */
async function updateLease(req, res) {
  try {
    const userId = req.user.id;
    const leaseId = req.params.id;
    const { rentAmount, chargesAmount, depositAmount, startDate, endDate, propertyType, additionalClauses, guarantor } = req.body;

    const lease = await Lease.findById(leaseId);
    if (!lease) {
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    if (String(lease.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Met à jour les champs fournis
    if (rentAmount !== undefined) lease.rentAmount = Number(rentAmount);
    if (chargesAmount !== undefined) lease.chargesAmount = Number(chargesAmount);
    if (depositAmount !== undefined) lease.depositAmount = Number(depositAmount);
    if (startDate) lease.startDate = new Date(startDate);
    if (endDate) lease.endDate = endDate ? new Date(endDate) : null;
    if (propertyType) lease.propertyType = propertyType;
    if (additionalClauses !== undefined) lease.additionalClauses = additionalClauses;
    
    // Met à jour les informations du garant si fournies
    if (guarantor && typeof guarantor === 'object') {
      lease.guarantor = lease.guarantor || {};
      if (guarantor.firstName !== undefined) lease.guarantor.firstName = String(guarantor.firstName || '').trim();
      if (guarantor.lastName !== undefined) lease.guarantor.lastName = String(guarantor.lastName || '').trim();
      if (guarantor.email !== undefined) lease.guarantor.email = String(guarantor.email || '').trim();
      if (guarantor.phone !== undefined) lease.guarantor.phone = String(guarantor.phone || '').trim();
      if (guarantor.address !== undefined) lease.guarantor.address = String(guarantor.address || '').trim();
      if (guarantor.income !== undefined) lease.guarantor.income = Number(guarantor.income) || 0;
      if (guarantor.profession !== undefined) lease.guarantor.profession = String(guarantor.profession || '').trim();
    }

    lease.updatedAt = new Date();
    await lease.save();

    return res.json({
      success: true,
      msg: 'Bail mis à jour',
      lease
    });
  } catch (error) {
    console.error('Erreur updateLease:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Crée un nouveau bail depuis le module BailInstant
 */
async function createLease(req, res) {
  try {
    const userId = req.user.id;
    const {
      propertyId,
      candidatureId,
      startDate,
      endDate,
      rentAmount,
      chargesAmount,
      depositAmount,
      propertyType,
      additionalClauses,
      guarantorType,
      guarantor
    } = req.body;

    // Validation des champs requis
    if (!propertyId || !candidatureId || !startDate) {
      return res.status(400).json({ msg: 'Champs manquants (propertyId, candidatureId, startDate requis)' });
    }

    // Vérifie que le bien appartient au propriétaire
    const property = await Property.findOne({ _id: propertyId, user: userId });
    if (!property) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    // Vérifie que la candidature existe et appartient au bien
    const candidature = await Candidature.findOne({
      _id: candidatureId,
      property: propertyId,
      user: userId
    });
    if (!candidature) {
      return res.status(404).json({ msg: 'Candidature introuvable' });
    }

    // Prépare les données du bail
    const leaseData = {
      user: userId,
      property: propertyId,
      candidature: candidatureId,
      tenantFirstName: candidature.firstName || '',
      tenantLastName: candidature.lastName || '',
      tenantEmail: candidature.email,
      tenantPhone: candidature.phone || '',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      rentAmount: Number(rentAmount) || property.rentAmount,
      chargesAmount: Number(chargesAmount) || property.chargesAmount,
      depositAmount: Number(depositAmount) || 0,
      propertyType: propertyType || 'NU',
      additionalClauses: additionalClauses || '',
      signatureStatus: 'PENDING'
    };

    // Ajoute les informations du garant si applicable
    if (guarantorType && guarantorType !== 'NONE' && guarantor) {
      leaseData.guarantor = {
        firstName: guarantor.firstName || '',
        lastName: guarantor.lastName || '',
        email: guarantor.email || '',
        phone: guarantor.phone || '',
        address: guarantor.address || '',
        income: Number(guarantor.income) || 0,
        profession: guarantor.profession || ''
      };
      
      // Si Visale, stocke le numéro dans un champ personnalisé
      if (guarantorType === 'VISALE' && guarantor.visaleNumber) {
        leaseData.guarantor.visaleNumber = guarantor.visaleNumber;
      }
    }

    // Crée le bail
    const lease = await Lease.create(leaseData);

    // Met à jour le statut de la candidature
    candidature.status = 'SELECTED_FOR_LEASE';
    await candidature.save();

    // Met à jour le statut du bien
    property.status = 'LEASE_IN_PROGRESS';
    await property.save();

    // Génère le PDF du bail (synchrone pour pouvoir l'envoyer à OpenSign)
    const { generateLeasePdf } = require('../services/pdfService');
    const pdfPath = await generateLeasePdf(lease, property, candidature);
    lease.contractPdfPath = pdfPath;
    await lease.save();

    return res.json({
      success: true,
      msg: 'Bail créé avec succès',
      lease: {
        id: lease._id,
        startDate: lease.startDate,
        rentAmount: lease.rentAmount,
        chargesAmount: lease.chargesAmount,
        signatureStatus: lease.signatureStatus
      }
    });
  } catch (error) {
    console.error('Erreur createLease:', error);
    return res.status(500).json({ msg: 'Erreur serveur', error: error.message });
  }
}

/**
 * Lance la signature électronique via OpenSign pour un bail existant
 */
async function launchElectronicSignature(req, res) {
  try {
    const userId = req.user.id;
    const leaseId = req.params.id;

    // Récupère le bail
    const lease = await Lease.findById(leaseId)
      .populate('property')
      .populate('candidature')
      .populate('user');

    if (!lease) {
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    if (String(lease.user._id || lease.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    // Vérifie que le PDF existe
    if (!lease.contractPdfPath) {
      return res.status(400).json({ msg: 'PDF du bail non généré. Veuillez d\'abord générer le bail.' });
    }

    // Vérifie qu'OpenSign est configuré
    if (!process.env.OPENSIGN_API_KEY) {
      return res.status(503).json({ msg: 'Service de signature électronique non configuré' });
    }

    // Prépare les parties pour OpenSign
    const User = require('../../models/User');
    const owner = await User.findById(userId);
    if (!owner) {
      return res.status(404).json({ msg: 'Propriétaire introuvable' });
    }

    const parties = {
      tenant: {
        firstName: lease.tenantFirstName,
        lastName: lease.tenantLastName,
        email: lease.tenantEmail
      },
      owner: {
        firstName: owner.firstName || owner.email.split('@')[0],
        lastName: owner.lastName || '',
        email: owner.email,
        id: owner._id
      },
      guarantor: lease.guarantor && lease.guarantor.email ? {
        firstName: lease.guarantor.firstName,
        lastName: lease.guarantor.lastName,
        email: lease.guarantor.email,
        visaleNumber: lease.guarantor.visaleNumber
      } : null
    };

    // Génère le PDF d'annexes (diagnostics) - optionnel mais recommandé
    const { generateAnnexesPdf } = require('../services/pdfService');
    const Document = require('../../models/Document');
    const diagnosticDocuments = await Document.find({
      property: property._id || property.id,
      type: { $in: ['dpe', 'electricite', 'gaz', 'erp', 'plomb', 'amiante', 'surface'] }
    }).sort({ createdAt: -1 });

    let annexesPdfPath = null;
    if (diagnosticDocuments.length > 0) {
      try {
        annexesPdfPath = await generateAnnexesPdf(diagnosticDocuments, property);
        console.log('✅ PDF d\'annexes généré:', annexesPdfPath);
        // Sauvegarde le chemin des annexes dans le bail pour référence future
        lease.annexesPdfPath = annexesPdfPath;
        await lease.save();
      } catch (error) {
        console.error('❌ Erreur génération PDF annexes:', error);
        // Continue même si la génération des annexes échoue
      }
    }

    // Envoie à OpenSign
    const { sendLeaseForSignature } = require('../services/opensignService');
    const opensignResult = await sendLeaseForSignature(
      lease,
      lease.property,
      parties,
      lease.contractPdfPath,
      annexesPdfPath
    );

    // Met à jour le bail avec les informations OpenSign
    lease.opensignDocumentId = opensignResult.documentId;
    lease.opensignStatus = 'pending';
    lease.opensignSigningLinks = opensignResult.signingLinks;
    lease.signatureStatus = 'PENDING';
    await lease.save();

    // Sécurité : Ne pas exposer le documentId directement dans la réponse
    // Les liens de signature sont déjà sécurisés par OpenSign
    return res.json({
      success: true,
      msg: 'Signature électronique lancée avec succès',
      lease: {
        id: lease._id,
        opensignStatus: lease.opensignStatus,
        // Ne pas exposer opensignDocumentId dans la réponse API
        // Les liens de signature sont envoyés par email directement par OpenSign
        hasSigningLinks: !!(lease.opensignSigningLinks && (
          lease.opensignSigningLinks.tenant || 
          lease.opensignSigningLinks.guarantor || 
          lease.opensignSigningLinks.owner
        ))
      }
    });
  } catch (error) {
    console.error('Erreur launchElectronicSignature:', error);
    return res.status(500).json({ msg: 'Erreur serveur', error: error.message });
  }
}

/**
 * Renvoie le lien de signature pour un signataire
 */
async function resendSigningLink(req, res) {
  try {
    const userId = req.user.id;
    const leaseId = req.params.id;
    const { signerEmail } = req.body;

    if (!signerEmail) {
      return res.status(400).json({ msg: 'Email du signataire requis' });
    }

    const lease = await Lease.findById(leaseId);
    if (!lease) {
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    if (String(lease.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    if (!lease.opensignDocumentId) {
      return res.status(400).json({ msg: 'Document OpenSign non trouvé' });
    }

    const { resendSigningLink: resendLink } = require('../services/opensignService');
    const result = await resendLink(lease.opensignDocumentId, signerEmail);

    return res.json({
      success: true,
      msg: 'Lien de signature renvoyé',
      signingLink: result.signingLink
    });
  } catch (error) {
    console.error('Erreur resendSigningLink:', error);
    return res.status(500).json({ msg: 'Erreur serveur', error: error.message });
  }
}

/**
 * Récupère le statut de signature OpenSign
 */
async function getSignatureStatus(req, res) {
  try {
    const userId = req.user.id;
    const leaseId = req.params.id;

    const lease = await Lease.findById(leaseId);
    if (!lease) {
      return res.status(404).json({ msg: 'Bail introuvable' });
    }

    if (String(lease.user) !== String(userId)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    if (!lease.opensignDocumentId) {
      return res.json({
        opensignStatus: null,
        signatureStatus: lease.signatureStatus,
        message: 'Signature électronique non lancée'
      });
    }

    // Récupère le statut depuis OpenSign
    const { getDocumentStatus } = require('../services/opensignService');
    const status = await getDocumentStatus(lease.opensignDocumentId);

    // Met à jour le bail si le statut a changé
    if (status.status !== lease.opensignStatus) {
      lease.opensignStatus = status.status;
      if (status.completedAt) {
        lease.opensignCompletedAt = new Date(status.completedAt);
      }
      await lease.save();
    }

    return res.json({
      opensignStatus: lease.opensignStatus,
      signatureStatus: lease.signatureStatus,
      signers: status.signers,
      completedAt: lease.opensignCompletedAt
    });
  } catch (error) {
    console.error('Erreur getSignatureStatus:', error);
    return res.status(500).json({ msg: 'Erreur serveur', error: error.message });
  }
}

module.exports = {
  getLeaseById,
  getLeasesByProperty,
  updateLeaseSignature,
  updateLeaseEDL,
  uploadEDLPhoto,
  updateLease,
  createLease,
  launchElectronicSignature,
  resendSigningLink,
  getSignatureStatus
};
