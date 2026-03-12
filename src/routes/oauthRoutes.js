// Routes pour l'authentification OAuth
const express = require('express');
const router = express.Router();
const { googleAuth, appleAuth } = require('../controllers/oauthController');

// Routes publiques OAuth
router.post('/google', googleAuth);
router.post('/apple', appleAuth);

module.exports = router;
