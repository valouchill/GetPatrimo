// Routes pour la gestion des locataires
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createTenant,
  getTenants,
  getTenantByProperty,
  getTenantById,
  updateTenant,
  deleteTenant
} = require('../controllers/tenantController');

router.post('/', auth, createTenant);
router.get('/', auth, getTenants);
router.get('/by-property/:propertyId', auth, getTenantByProperty);
router.get('/:id', auth, getTenantById);
router.put('/:id', auth, updateTenant);
router.delete('/:id', auth, deleteTenant);

module.exports = router;
