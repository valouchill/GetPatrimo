/**
 * Routes pour TrustEngine
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getReliabilityReport,
  requestDataDeletion,
  triggerAutoPurge
} = require('../controllers/trustController');

// Routes
router.get('/reliability/:candidatureId', auth, getReliabilityReport);
router.post('/rgpd/delete', requestDataDeletion); // Pas d'auth : accessible aux candidats
router.post('/rgpd/purge', auth, triggerAutoPurge);

module.exports = router;
