/**
 * Routes pour les webhooks externes
 * Note: Ces routes ne nécessitent pas d'authentification car elles sont appelées par des services externes
 */

const express = require('express');
const router = express.Router();
const { handleOpenSignWebhook } = require('../controllers/webhookController');

// Webhook OpenSign - Pas d'auth nécessaire (vérification par signature si nécessaire)
router.post('/opensign', handleOpenSignWebhook);

module.exports = router;
