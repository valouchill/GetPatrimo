/**
 * Routes pour la gestion fiscale
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadsDir } = require('../config/app');
const auth = require('../middleware/auth');
const {
  uploadTaxDocument,
  getTaxDocuments,
  deleteTaxDocument,
  getTaxSummary,
  generateTaxDeclaration
} = require('../controllers/taxController');

// Configuration Multer pour documents fiscaux
const taxUpload = multer({
  dest: path.join(uploadsDir, 'tax-documents'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé (PDF/PNG/JPEG uniquement)'));
    }
  }
});

// Routes
router.post('/documents/upload', auth, taxUpload.single('file'), uploadTaxDocument);
router.get('/documents', auth, getTaxDocuments);
router.delete('/documents/:docId', auth, deleteTaxDocument);
router.get('/summary', auth, getTaxSummary);
router.post('/declaration', auth, generateTaxDeclaration);

module.exports = router;
