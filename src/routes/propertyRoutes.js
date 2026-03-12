// Routes pour la gestion des biens immobiliers
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  generateApplyLink
} = require('../controllers/propertyController');

// Route pour le rapport de fraude (doit être avant /:id pour éviter les conflits)
// Route fraud report déplacée dans trustRoutes
// router.get('/candidatures/:id/fraud-report', auth, getFraudReport);

router.post('/', auth, createProperty);
router.get('/', auth, getProperties);
router.post('/:id/apply-link', auth, generateApplyLink); // Route pour générer le lien de candidature (doit être avant /:id)
router.get('/:id', auth, getPropertyById);
router.patch('/:id/required-documents', auth, updateProperty); // Route spécifique pour les documents obligatoires (doit être avant /:id)
router.put('/:id', auth, updateProperty);
router.patch('/:id', auth, updateProperty); // Route pour mettre à jour les diagnostics et autres champs
router.delete('/:id', auth, deleteProperty);

module.exports = router;
