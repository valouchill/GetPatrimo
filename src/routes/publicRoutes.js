// Routes publiques
const express = require('express');
const router = express.Router();
const { candidatureUpload } = require('../utils/upload');
const {
  getApplyProperty,
  getPropertyById,
  submitCandidature,
  submitCandidatureByPropertyId,
  createLead
} = require('../controllers/publicController');

// Middleware de debug pour toutes les routes publiques
router.use((req, res, next) => {
  console.log('🔍 Route publique appelée:', req.method, req.path);
  console.log('   Params:', req.params);
  console.log('   Query:', req.query);
  next();
});

// Route de test pour vérifier que le router fonctionne
router.get('/test', (req, res) => {
  res.json({ msg: 'Route publique OK', path: req.path });
});

router.get('/apply/:token', getApplyProperty);
router.post('/apply/:token', candidatureUpload.array('documents', 10), submitCandidature);
router.get('/property/:propertyId', getPropertyById);
router.post('/property/:propertyId/apply', candidatureUpload.array('documents', 10), submitCandidatureByPropertyId);
router.post('/candidature', candidatureUpload.array('documents', 5), submitCandidature);
router.post('/lead', createLead);

module.exports = router;
