// Routes pour la gestion des candidatures
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAllCandidatures, getCandidatureById, getCandidaturesByProperty, downloadCandidatureFile, acceptCandidature, rejectCandidature, getCandidatureInsight, cancelAcceptance, updateCandidatureStatus, toggleShortlist, runTrustAnalysis } = require('../controllers/candidatureController');

// Récupère toutes les candidatures de tous les biens du propriétaire
router.get('/', auth, getAllCandidatures);

// Récupère les candidatures d'un bien spécifique (doit être avant /:id)
router.get('/property/:propertyId', auth, (req, res, next) => {
  console.log('🔍 Route /property/:propertyId appelée avec propertyId:', req.params.propertyId);
  next();
}, getCandidaturesByProperty);

// Génère l'insight IA pour une candidature (doit être avant /:id)
router.get('/:id/insight', auth, getCandidatureInsight);

// Annule l'acceptation d'une candidature (doit être avant /:id)
router.post('/:id/cancel-acceptance', auth, cancelAcceptance);

// Télécharge un fichier de candidature (doit être avant /:id)
router.get('/:candId/file/:docId', auth, downloadCandidatureFile);

// Récupère une candidature par son ID
router.get('/:id', auth, getCandidatureById);

// Accepter une candidature (génère le bail)
router.post('/:id/accept', auth, acceptCandidature);

// Refuser une candidature (envoie email de refus)
router.post('/:id/reject', auth, rejectCandidature);

// Mettre à jour le statut d'une candidature
router.patch('/:id/status', auth, updateCandidatureStatus);

// Mettre à jour le statut shortlist (favori) d'une candidature
router.patch('/:id/shortlist', auth, toggleShortlist);

// Lance l'analyse PatrimoTrust™
router.post('/:id/analyze-trust', auth, runTrustAnalysis);

module.exports = router;
