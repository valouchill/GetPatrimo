// Routes pour les relances
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { sendReminder } = require('../controllers/reminderController');

router.post('/tenant/:tenantId', auth, sendReminder);

module.exports = router;
