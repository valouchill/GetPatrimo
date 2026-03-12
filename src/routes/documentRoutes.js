// Routes pour la gestion des documents
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { docUpload } = require('../utils/upload');
const {
  downloadQuittance,
  emailQuittance,
  downloadDocument,
  uploadDocument,
  getDocuments,
  deleteDocument,
  mergeDiagnostics
} = require('../controllers/documentController');
const { analyzeDocument, analyzeDiagnostic } = require('../controllers/documentAnalysisController');

// Routes pour les quittances
router.get('/quittance/:id', auth, downloadQuittance);
router.post('/email/:id', auth, emailQuittance);

// Routes pour les documents de bien
router.get('/file/:docId', auth, downloadDocument);
router.post('/upload/:propertyId', auth, docUpload.single('file'), uploadDocument);
router.post('/analyze', auth, analyzeDocument);
router.post('/diagnostics/analyze', auth, analyzeDiagnostic);
router.post('/diagnostics/merge/:propertyId', auth, mergeDiagnostics);
router.get('/:propertyId', auth, getDocuments);
router.delete('/:docId', auth, deleteDocument);

module.exports = router;
