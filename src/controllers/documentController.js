// Controller pour la gestion des documents
const path = require('path');
const fs = require('fs');
const Property = require('../../models/Property');
const Tenant = require('../../models/Tenant');
const Document = require('../../models/Document');
const User = require('../../models/User');
const { uploadsDir } = require('../config/app');
const { createPdfBuffer } = require('../services/pdfService');
const { PDFDocument } = require('pdf-lib');
const { sendEmail, isEmailConfigured } = require('../services/emailService');
const { enforceReceiptEmailLimit } = require('../services/billingService');
const { logEvent } = require('../services/eventService');

/**
 * Génère et télécharge un PDF de quittance
 */
async function downloadQuittance(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const t = await Tenant.findOne({ user: req.user.id, property: p._id });
    const u = await User.findById(req.user.id);

    const buffer = await createPdfBuffer(p, t, u);
    res.setHeader('Content-Type', 'application/pdf');
    
    await logEvent(req.user.id, { 
      property: p._id, 
      tenant: t ? t._id : null, 
      type: 'pdf_quittance_generated' 
    });
    
    return res.send(buffer);
  } catch (error) {
    console.error('Erreur downloadQuittance:', error);
    return res.status(500).json({ msg: 'Erreur PDF' });
  }
}

/**
 * Envoie une quittance par email
 */
async function emailQuittance(req, res) {
  try {
    if (!isEmailConfigured()) {
      return res.status(400).json({ msg: "Email non configuré (BREVO_USER/BREVO_PASS)" });
    }

    const p = await Property.findOne({ _id: req.params.id, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const t = await Tenant.findOne({ user: req.user.id, property: p._id });
    if (!t) {
      return res.status(400).json({ msg: 'Aucun locataire lié à ce bien' });
    }
    
    if (!t.email) {
      return res.status(400).json({ msg: "Le locataire n'a pas d'email" });
    }

    const u = await User.findById(req.user.id);

    // Vérification du paywall
    const check = await enforceReceiptEmailLimit(u);
    if (!check.ok) {
      return res.status(check.status).json({ msg: check.msg });
    }

    const pdfBuffer = await createPdfBuffer(p, t, u);

    await sendEmail({
      to: t.email,
      subject: 'Quittance de loyer - ' + (p.name || ''),
      text: `Bonjour ${t.firstName || ''},\n\nVeuillez trouver ci-joint votre quittance de loyer.\n\nCordialement,\n${u?.firstName || 'Votre Bailleur'}`,
      attachments: [{ filename: 'Quittance.pdf', content: pdfBuffer }]
    });

    await logEvent(req.user.id, { 
      property: p._id, 
      tenant: t._id, 
      type: 'email_quittance_sent', 
      meta: { to: t.email, plan: check.plan, sent: check.sent } 
    });
    
    return res.json({ msg: 'Email envoyé avec succès !' });
  } catch (error) {
    console.error('Erreur emailQuittance:', error);
    return res.status(500).json({ msg: "Erreur envoi email" });
  }
}

/**
 * Télécharge un fichier de document
 */
async function downloadDocument(req, res) {
  try {
    const d = await Document.findOne({ _id: req.params.docId, user: req.user.id });
    if (!d) {
      return res.status(404).json({ msg: 'Document introuvable' });
    }

    const absPath = path.join(uploadsDir, d.relPath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ msg: 'Fichier introuvable' });
    }

    return res.download(absPath, d.originalName || d.filename || 'document');
  } catch (error) {
    console.error('Erreur downloadDocument:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Upload d'un document pour un bien
 */
async function uploadDocument(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }
    
    if (!req.file) {
      return res.status(400).json({ msg: 'Fichier manquant' });
    }

    const type = String((req.body && req.body.type) || 'autre');
    const doc = await Document.create({
      user: req.user.id,
      property: p._id,
      type,
      originalName: req.file.originalname || '',
      filename: req.file.filename,
      mimeType: req.file.mimetype || '',
      size: req.file.size || 0,
      relPath: 'property-documents/' + req.file.filename
    });

    const tt = await Tenant.findOne({ user: req.user.id, property: p._id });
    await logEvent(req.user.id, { 
      property: p._id, 
      tenant: tt ? tt._id : null, 
      type: 'document_uploaded', 
      meta: { docType: type, name: doc.originalName } 
    });
    
    return res.json(doc);
  } catch (error) {
    console.error('Erreur uploadDocument:', error);
    return res.status(500).json({ msg: 'Erreur upload' });
  }
}

/**
 * Liste les documents d'un bien
 */
async function getDocuments(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const docs = await Document.find({ user: req.user.id, property: p._id }).sort({ createdAt: -1 });
    return res.json(docs);
  } catch (error) {
    console.error('Erreur getDocuments:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Supprime un document
 */
async function deleteDocument(req, res) {
  try {
    const d = await Document.findOne({ _id: req.params.docId, user: req.user.id });
    if (!d) {
      return res.status(404).json({ msg: 'Document introuvable' });
    }

    const absPath = path.join(uploadsDir, d.relPath);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }

    await d.deleteOne();
    await logEvent(req.user.id, { 
      property: d.property, 
      type: 'document_deleted', 
      meta: { name: d.originalName || d.filename } 
    });
    
    return res.json({ msg: 'OK' });
  } catch (error) {
    console.error('Erreur deleteDocument:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Fusionne les diagnostics PDF pour un bien
 */
async function mergeDiagnostics(req, res) {
  try {
    const p = await Property.findOne({ _id: req.params.propertyId, user: req.user.id });
    if (!p) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const diagnosticTypes = ['dpe', 'erp', 'plomb', 'electricite', 'gaz', 'boutin'];
    const docs = await Document.find({
      user: req.user.id,
      property: p._id,
      type: { $in: diagnosticTypes }
    }).sort({ createdAt: 1 });

    if (!docs.length) {
      return res.status(400).json({ msg: 'Aucun diagnostic disponible' });
    }

    const merged = await PDFDocument.create();
    for (const doc of docs) {
      const absPath = path.join(uploadsDir, doc.relPath);
      if (!fs.existsSync(absPath)) {
        continue;
      }
      const fileBytes = fs.readFileSync(absPath);
      const pdf = await PDFDocument.load(fileBytes);
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }

    const buffer = await merged.save();
    const safeAddress = String(p.address || p.addressLine || p.name || 'BIEN')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .toUpperCase();
    const filename = `ANNEXES_TECHNIQUES_${safeAddress}_${Date.now()}.pdf`;
    const relPath = 'property-documents/' + filename;
    const absOut = path.join(uploadsDir, relPath);

    fs.writeFileSync(absOut, buffer);

    const mergedDoc = await Document.create({
      user: req.user.id,
      property: p._id,
      type: 'annexes_techniques',
      originalName: filename,
      filename,
      mimeType: 'application/pdf',
      size: buffer.length,
      relPath
    });

    await logEvent(req.user.id, {
      property: p._id,
      type: 'diagnostics_merged',
      meta: { documentId: String(mergedDoc._id) }
    });

    return res.json({
      msg: 'Fusion réalisée',
      documentId: mergedDoc._id,
      filename
    });
  } catch (error) {
    console.error('Erreur mergeDiagnostics:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = {
  downloadQuittance,
  emailQuittance,
  downloadDocument,
  uploadDocument,
  getDocuments,
  deleteDocument,
  mergeDiagnostics
};
