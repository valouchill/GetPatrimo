// Routes pour le scraping d'annonces
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { scrapeProperty } = require('../controllers/scrapingController');

// Route protégée pour le scraping
router.post('/', auth, scrapeProperty);

module.exports = router;
