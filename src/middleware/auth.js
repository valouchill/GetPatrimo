// Middleware d'authentification JWT
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/app');

/**
 * Middleware d'authentification par token JWT
 * Ajoute req.user avec l'ID de l'utilisateur si le token est valide
 */
async function auth(req, res, next) {
  try {
    const token = req.header('x-auth-token');
    if (!token) {
      return res.status(401).json({ msg: 'Pas de token, autorisation refusée' });
    }

    // Sécurité (audit passe-4) : algorithme contraint (anti-confusion alg).
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    // Sécurité (audit passe-4 jwt-session-1) : un token typé (ex. password_reset) NE DOIT PAS
    // être accepté comme session — il est signé avec le même JWT_SECRET mais a un autre usage.
    if (decoded.type) {
      return res.status(401).json({ msg: 'Token non valide' });
    }
    req.user = decoded.user;
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'Token non valide' });
    }
    // Sécurité (audit passe-4 express-surface-2) : un compte suspendu garde un JWT valide.
    // Relecture en base (routes modulaires legacy, faible trafic).
    const User = require('../../models/User');
    const u = await User.findById(req.user.id).select('suspended').lean();
    if (!u || u.suspended) {
      return res.status(403).json({ msg: 'Compte suspendu ou introuvable' });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ msg: 'Token non valide' });
  }
}

module.exports = auth;
