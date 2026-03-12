// Routes d'authentification
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  sendMagicLink,
  verifyMagicLink,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

// Routes publiques
router.post('/register', register);
router.post('/login', login);
router.post('/magic-link', sendMagicLink);
router.post('/magic-link/verify', verifyMagicLink);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Routes protégées
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.post('/change-password', auth, changePassword);

module.exports = router;
