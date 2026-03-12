// Middleware d'authentification JWT
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/app');

/**
 * Middleware d'authentification par token JWT
 * Ajoute req.user avec l'ID de l'utilisateur si le token est valide
 */
function auth(req, res, next) {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      console.log('❌ Auth: Pas de token dans header x-auth-token');
      return res.status(401).json({ msg: 'Pas de token, autorisation refusée' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    console.log('✅ Auth: Token valide pour userId:', req.user?.id || req.user);
    return next();
  } catch (error) {
    console.error('❌ Auth: Token invalide:', error.message);
    return res.status(401).json({ msg: 'Token non valide: ' + error.message });
  }
}

module.exports = auth;
