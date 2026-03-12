// Routes pour la gestion des événements
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getPropertyEvents,
  getTenantEvents,
  getEventsSummary
} = require('../controllers/eventController');

router.get('/property/:propertyId', auth, getPropertyEvents);
router.get('/tenant/:tenantId', auth, getTenantEvents);
router.get('/summary', auth, getEventsSummary);

module.exports = router;
