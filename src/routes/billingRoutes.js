// Routes de facturation
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getBillingStatus } = require('../controllers/billingController');

router.get('/status', auth, getBillingStatus);

module.exports = router;
