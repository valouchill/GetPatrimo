const Lease = require('../../models/Lease');
const Property = require('../../models/Property');
const Candidature = require('../../models/Candidature');
const path = require('path');
const fs = require('fs');
const {
  COMPILED_DIR,
  compileLeaseBundle,
  prepareLeaseCompilation,
} = require('../services/leaseCompileService');
const { deriveLeaseType } = require('../utils/leaseWizardShared');

function sanitizeFileSegment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'document';
}

function mapLegacyPropertyType(leaseType) {
  // Accepte aussi bien les anciennes valeurs lowercase que les nouvelles UPPER_SNAKE_CASE
  if (leaseType === 'MEUBLE' || leaseType === 'meuble') return 'MEUBLE';
  if (leaseType === 'MOBILITE' || leaseType === 'mobilite') return 'MOBILITE';
  if (leaseType === 'GARAGE_PARKING' || leaseType === 'garage_parking') return 'GARAGE_PARKING';
  return 'NU';
}

function buildCompileFormDataFromLease(lease) {
  const durationMonths = lease.durationMonths
    || (lease.startDate && lease.endDate
      ? Math.max(1, Math.round((new Date(lease.endDate) - new Date(lease.startDate)) / (30 * 24 * 60 * 60 * 1000)))
      : 12);

  return {
    leaseType: lease.leaseType || deriveLeaseType(lease.property, lease.propertyType),
    startDate: lease.startDate,
    endDate: lease.endDate,
    rentHC: lease.rentAmount,
    charges: lease.chargesAmount,
    deposit: lease.depositAmount,
    paymentDay: lease.paymentDay || 5,
    durationMonths,
    additionalClauses: lease.additionalClauses || '',
    guarantorOverrides: lease.guarantor || {},
  };
}

function mapGeneratedDocuments(documents) {
  return documents.map((document) => ({
    kind: document.kind,
    template: document.template,
    fileName: document.fileName,
    mimeType: document.mimeType,
    docxPath: document.docxPath,
    pdfPath: document.pdfPath,
    createdAt: new Date(),
  }));
}

function getPrimaryLeaseDocument(documents) {
  return documents.find((document) => document.kind === 'LEASE') || documents[0] || null;
}

function getSignatureSummary(statuses) {
  const values = statuses.map((item) => item.status);
  if (values.length === 0) return null;
  if (values.includes('DECLINED')) return 'DECLINED';
  if (values.includes('EXPIRED')) return 'EXPIRED';
  if (values.every((status) => status === 'COMPLETED')) return 'COMPLETED';
  if (values.includes('SIGNED') || values.includes('COMPLETED')) return 'SIGNED';
  return 'PENDING';
}

/**
 * Compile un bundle Smart Lease sans créer de bail
 */
async function compileLease(req, res) {
  try {
    const userId = req.user.id;
    const { propertyId, applicationId, candidatureId, formData } = req.body || {};

    const compiled = await compileLeaseBundle({
      propertyId,
      applicationId,
      candidatureId,
      formData: formData || {},
      userId,
    });

    return res.json({
      documents: compiled.documents.map((document) => ({
        kind: document.kind,
        fileName: document.fileName,
        mimeType: document.mimeType,
        secureUrl: document.secureUrl,
        pdfUrl: document.pdfUrl,
      })),
      warnings: compiled.warnings || [],
      compileMeta: compiled.compileMeta,
    });
  } catch (error) {
    console.error('Erreur compileLease:', error);
    return res.status(500).json({ msg: 'Erreur serveur', error: error.message });
  }
}

async function checkLeaseReadiness(req, res) {
  try {
    const userId = req.user.id;
    const { propertyId, applicationId, candidatureId, formData } = req.body || {};

    const prepared = await prepareLeaseCompilation({
      propertyId,
      applicationId,
      candidatureId,
      formData: formData || {},
      userId,
    });

    return res.json({
      warnings: prepared.warnings || [],
      compileMeta: prepared.compileMeta,
    });
  } catch (error) {
    console.error('Erreur checkLeaseReadiness:', error);
    return res.status(500).json({ msg: 'Erreur serveur', error: error.message, warnings: [] });
  }
}

/**
 * Sert un artefact compilé Smart Lease
 */
async function getCompiledLeaseAsset(req, res) {
  try {
    const userPrefix = `${sanitizeFileSegment(req.user.id)}-`;
    const fileName = path.basename(String(req.params.fileName || ''));

    if (!fileName.startsWith(userPrefix)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    const absolutePath = path.join(COMPILED_DIR, fileName);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ msg: 'Fichier introuvable' });
    }

    return res.sendFile(absolutePath);
  } catch (error) {
    console.error('Erreur getCompiledLeaseAsset:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

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
      applicationId,
      candidatureId,
      startDate,
      endDate,
      rentAmount,
      chargesAmount,
      depositAmount,
      leaseType,
      paymentDay,
      durationMonths,
      propertyType,
      additionalClauses,
      guarantorType,
      guarantor,
      formData,
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
    const resolvedLeaseType = deriveLeaseType(property, leaseType || propertyType);
    const compileFormData = {
      ...(formData || {}),
      leaseType: resolvedLeaseType,
      startDate,
      endDate,
      rentHC: rentAmount,
      charges: chargesAmount,
      deposit: depositAmount,
      paymentDay,
      durationMonths,
      additionalClauses,
      guarantorType,
      guarantorOverrides: guarantor,
    };

    const leaseData = {
      user: userId,
      property: propertyId,
      candidature: candidatureId,
      applicationId: applicationId || undefined,
      tenantFirstName: candidature.firstName || '',
      tenantLastName: candidature.lastName || '',
      tenantEmail: candidature.email,
      tenantPhone: candidature.phone || '',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      rentAmount: Number(rentAmount) || property.rentAmount,
      chargesAmount: Number(chargesAmount) || property.chargesAmount,
      depositAmount: Number(depositAmount) || 0,
      propertyType: propertyType || mapLegacyPropertyType(resolvedLeaseType),
      leaseType: resolvedLeaseType,
      paymentDay: Number(paymentDay) || 5,
      durationMonths: Number(durationMonths) || 12,
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

    const compiled = await compileLeaseBundle({
      propertyId,
      applicationId,
      candidatureId,
      formData: compileFormData,
      userId,
    });
    const primaryDocument = getPrimaryLeaseDocument(compiled.documents);

    lease.generatedDocuments = mapGeneratedDocuments(compiled.documents);
    lease.contractPdfPath = primaryDocument?.pdfPath || '';
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

    const compiled = await compileLeaseBundle({
      propertyId: String(lease.property._id || lease.property),
      applicationId: lease.applicationId ? String(lease.applicationId) : undefined,
      candidatureId: lease.candidature ? String(lease.candidature) : undefined,
      formData: buildCompileFormDataFromLease(lease),
      userId,
    });
    const { sendDocumentsForSignature } = require('../services/opensignService');
    const opensignResult = await sendDocumentsForSignature({
      lease,
      property: lease.property,
      parties,
      documents: compiled.documents,
    });
    const primaryDocument = opensignResult.documents.find((document) => document.kind === 'LEASE') || opensignResult.documents[0];

    // Met à jour le bail avec les informations OpenSign
    lease.generatedDocuments = mapGeneratedDocuments(compiled.documents);
    lease.contractPdfPath = getPrimaryLeaseDocument(compiled.documents)?.pdfPath || lease.contractPdfPath;
    lease.opensignDocuments = opensignResult.documents.map((document) => ({
      kind: document.kind,
      documentId: document.documentId,
      status: document.status,
      signingLinks: document.signingLinks,
      completedAt: document.completedAt,
    }));
    lease.opensignDocumentId = primaryDocument?.documentId;
    lease.opensignStatus = primaryDocument?.status || 'PENDING';
    lease.opensignSigningLinks = primaryDocument?.signingLinks || {};
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
        documentsCount: opensignResult.documents.length,
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

    if (!lease.opensignDocumentId && !(lease.opensignDocuments || []).length) {
      return res.status(400).json({ msg: 'Document OpenSign non trouvé' });
    }

    const { resendSigningLink: resendLink } = require('../services/opensignService');
    const documents = (lease.opensignDocuments || []).length
      ? lease.opensignDocuments
      : [{ documentId: lease.opensignDocumentId }];
    const results = [];

    for (const document of documents) {
      if (!document.documentId) continue;
      results.push(await resendLink(document.documentId, signerEmail));
    }

    const result = results[0] || { signingLink: null };

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

    const trackedDocuments = (lease.opensignDocuments || []).length
      ? lease.opensignDocuments
      : lease.opensignDocumentId
        ? [{ kind: 'LEASE', documentId: lease.opensignDocumentId, status: lease.opensignStatus }]
        : [];

    if (!trackedDocuments.length) {
      return res.json({
        opensignStatus: null,
        signatureStatus: lease.signatureStatus,
        message: 'Signature électronique non lancée'
      });
    }

    // Récupère le statut depuis OpenSign
    const { getDocumentStatus } = require('../services/opensignService');
    const statuses = [];
    for (const document of trackedDocuments) {
      const status = await getDocumentStatus(document.documentId);
      statuses.push({
        kind: document.kind || 'LEASE',
        documentId: document.documentId,
        status: status.status,
        signers: status.signers,
        completedAt: status.completedAt,
      });
    }

    lease.opensignDocuments = statuses.map((status) => ({
      kind: status.kind,
      documentId: status.documentId,
      status: status.status,
      signingLinks: (lease.opensignDocuments || []).find((item) => item.documentId === status.documentId)?.signingLinks || {},
      completedAt: status.completedAt ? new Date(status.completedAt) : undefined,
      signedPdfPath: (lease.opensignDocuments || []).find((item) => item.documentId === status.documentId)?.signedPdfPath || '',
    }));
    lease.opensignStatus = getSignatureSummary(statuses) || lease.opensignStatus;
    if (statuses.every((status) => status.completedAt)) {
      lease.opensignCompletedAt = new Date(statuses[statuses.length - 1].completedAt);
    }
    await lease.save();

    return res.json({
      opensignStatus: lease.opensignStatus,
      signatureStatus: lease.signatureStatus,
      signers: statuses.flatMap((status) => status.signers || []),
      completedAt: lease.opensignCompletedAt,
      documents: statuses,
    });
  } catch (error) {
    console.error('Erreur getSignatureStatus:', error);
    return res.status(500).json({ msg: 'Erreur serveur', error: error.message });
  }
}

module.exports = {
  checkLeaseReadiness,
  compileLease,
  getCompiledLeaseAsset,
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
