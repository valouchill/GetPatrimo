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
  verifyMagicLink
} = require('../controllers/authController');

// Routes publiques
router.post('/register', register);
router.post('/login', login);
router.post('/magic-link', sendMagicLink);
router.post('/magic-link/verify', verifyMagicLink);
// /forgot-password & /reset-password : flux Express obsolète (remplacé par les routes
// App Router app/api/auth/{forgot,reset}-password) — retiré (audit V1).

// Routes protégées
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.post('/change-password', auth, changePassword);

module.exports = router;
