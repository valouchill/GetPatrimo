/**
 * Controller pour la gestion fiscale
 */

const path = require('path');
const fs = require('fs');
const { uploadsDir } = require('../config/app');
const { extractTaxDocument, DOCUMENT_TYPES } = require('../services/taxOcrService');
const { calculateFiscalResult } = require('../services/taxAccountingService');
const { createDeclaration } = require('../services/taxDeclarationService');
const { generateOptimizationReport } = require('../services/taxRecommendationService');
const Property = require('../../models/Property');
const Document = require('../../models/Document');

/**
 * Upload d'un document fiscal avec extraction OCR
 * POST /api/tax/documents/upload
 */
async function uploadTaxDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'Fichier manquant' });
    }

    const documentType = String(req.body.type || 'autre');
    const propertyId = String(req.body.propertyId || '');

    // Récupère le bien
    const property = await Property.findOne({ 
      _id: propertyId, 
      user: req.user.id 
    });

    if (!property) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    // Récupère les données du propriétaire (depuis req.user)
    const ownerData = {
      name: req.user.name || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      firstName: req.user.firstName,
      lastName: req.user.lastName
    };

    const propertyData = {
      name: property.name,
      address: property.address || `${property.addressLine || ''} ${property.zipCode || ''} ${property.city || ''}`.trim()
    };

    // Sauvegarde du document
    const doc = await Document.create({
      user: req.user.id,
      property: propertyId,
      type: `tax_${documentType}`,
      originalName: req.file.originalname || '',
      filename: req.file.filename,
      mimeType: req.file.mimetype || '',
      size: req.file.size || 0,
      relPath: 'tax-documents/' + req.file.filename
    });

    // Extraction OCR
    const filePath = path.join(uploadsDir, doc.relPath);
    const extraction = await extractTaxDocument(
      filePath,
      documentType,
      propertyData,
      ownerData
    );

    // Sauvegarde des données extraites dans le document
    doc.extractedData = extraction.extracted || {};
    doc.processedData = extraction.processed || {};
    doc.validation = extraction.validation || {};
    doc.documentType = documentType;
    await doc.save();

    return res.json({
      success: true,
      document: doc,
      extraction: extraction
    });
  } catch (error) {
    console.error('Erreur uploadTaxDocument:', error);
    return res.status(500).json({ msg: 'Erreur upload document fiscal' });
  }
}

/**
 * Liste des documents fiscaux
 * GET /api/tax/documents
 */
async function getTaxDocuments(req, res) {
  try {
    const propertyId = req.query.propertyId;
    
    const query = {
      user: req.user.id,
      type: { $regex: /^tax_/ }
    };
    
    if (propertyId) {
      query.property = propertyId;
    }

    const documents = await Document.find(query).sort({ createdAt: -1 });

    const formatted = documents.map(doc => ({
      _id: doc._id,
      type: doc.type.replace('tax_', ''),
      documentType: doc.documentType,
      filename: doc.originalName || doc.filename,
      createdAt: doc.createdAt,
      processed: doc.processedData || null,
      extracted: doc.extractedData || null,
      validation: doc.validation || null
    }));

    return res.json(formatted);
  } catch (error) {
    console.error('Erreur getTaxDocuments:', error);
    return res.status(500).json({ msg: 'Erreur récupération documents' });
  }
}

/**
 * Suppression d'un document fiscal
 * DELETE /api/tax/documents/:docId
 */
async function deleteTaxDocument(req, res) {
  try {
    const docId = req.params.docId;

    const doc = await Document.findOne({
      _id: docId,
      user: req.user.id,
      type: { $regex: /^tax_/ }
    });

    if (!doc) {
      return res.status(404).json({ msg: 'Document introuvable' });
    }

    // Supprime le fichier
    const filePath = path.join(uploadsDir, doc.relPath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Document.deleteOne({ _id: docId });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur deleteTaxDocument:', error);
    return res.status(500).json({ msg: 'Erreur suppression document' });
  }
}

/**
 * Résumé fiscal
 * GET /api/tax/summary
 */
async function getTaxSummary(req, res) {
  try {
    const propertyId = req.query.propertyId;
    const anneeFiscale = Number(req.query.annee || new Date().getFullYear());

    const query = { user: req.user.id };
    if (propertyId) {
      query._id = propertyId;
    }

    const properties = await Property.find(query);
    
    if (properties.length === 0) {
      return res.json({
        revenusBruts: 0,
        revenusNets: 0,
        regimeRecommandé: '—',
        documentsCount: 0,
        compteResultatGenerated: false,
        declarationGenerated: false,
        optimizationAnalyzed: false
      });
    }

    // Récupère les documents fiscaux
    const documents = await Document.find({
      user: req.user.id,
      type: { $regex: /^tax_/ }
    });

    // Calcule le compte de résultat (pour le premier bien pour simplifier)
    const property = properties[0];
    const propertyDocs = documents.filter(d => String(d.property) === String(property._id));
    
    let compteResultat = null;
    let declaration = null;
    let optimization = null;

    if (propertyDocs.length > 0) {
      try {
        compteResultat = calculateFiscalResult(property, propertyDocs.map(d => ({
          documentType: d.documentType,
          processed: d.processedData
        })), anneeFiscale);

        declaration = createDeclaration(compteResultat, 'reel', anneeFiscale);
        
        optimization = generateOptimizationReport(
          property,
          compteResultat,
          propertyDocs.map(d => ({
            documentType: d.documentType,
            processed: d.processedData
          })),
          anneeFiscale
        );
      } catch (e) {
        console.error('Erreur calcul fiscal:', e);
      }
    }

    return res.json({
      revenusBruts: compteResultat?.recettes?.total || 0,
      revenusNets: compteResultat?.resultat || 0,
      regimeRecommandé: optimization?.comparaisonRegimes?.recommandation === 'reel' ? 'Régime Réel' : 'Micro-BIC',
      documentsCount: documents.length,
      compteResultatGenerated: compteResultat !== null,
      declarationGenerated: declaration !== null,
      optimizationAnalyzed: optimization !== null
    });
  } catch (error) {
    console.error('Erreur getTaxSummary:', error);
    return res.status(500).json({ msg: 'Erreur récupération résumé fiscal' });
  }
}

/**
 * Génère la déclaration 2042C PRO
 * POST /api/tax/declaration
 */
async function generateTaxDeclaration(req, res) {
  try {
    const { propertyId, regime, annee } = req.body || {};
    const anneeFiscale = Number(annee || new Date().getFullYear());
    const regimeFiscal = String(regime || 'reel');

    const property = await Property.findOne({
      _id: propertyId,
      user: req.user.id
    });

    if (!property) {
      return res.status(404).json({ msg: 'Bien introuvable' });
    }

    const documents = await Document.find({
      user: req.user.id,
      property: propertyId,
      type: { $regex: /^tax_/ }
    });

    const compteResultat = calculateFiscalResult(
      property,
      documents.map(d => ({
        documentType: d.documentType,
        processed: d.processedData
      })),
      anneeFiscale
    );

    const declaration = createDeclaration(compteResultat, regimeFiscal, anneeFiscale);

    return res.json(declaration);
  } catch (error) {
    console.error('Erreur generateTaxDeclaration:', error);
    return res.status(500).json({ msg: 'Erreur génération déclaration' });
  }
}

module.exports = {
  uploadTaxDocument,
  getTaxDocuments,
  deleteTaxDocument,
  getTaxSummary,
  generateTaxDeclaration
};
