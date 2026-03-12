// Routes administrateur
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');
const {
  getLeads,
  exportLeadsCSV
} = require('../controllers/adminController');

router.get('/leads', auth, adminOnly, getLeads);
router.get('/leads.csv', auth, adminOnly, exportLeadsCSV);

module.exports = router;
