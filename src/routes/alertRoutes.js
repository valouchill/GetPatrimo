// Routes pour les alertes
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAlertsOverview } = require('../controllers/alertController');

router.get('/overview', auth, getAlertsOverview);

module.exports = router;
