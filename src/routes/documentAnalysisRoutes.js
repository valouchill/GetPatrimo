// Routes pour l'analyse de documents avec IA
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { analyzeDocument } = require('../controllers/documentAnalysisController');

router.post('/analyze', auth, analyzeDocument);

module.exports = router;
