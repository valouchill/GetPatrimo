// Middleware de vérification des droits administrateur
const User = require('../../models/User');
const { ADMIN_EMAILS } = require('../config/app');

/**
 * Middleware qui vérifie que l'utilisateur authentifié est un administrateur
 * Doit être utilisé après le middleware auth
 */
async function adminOnly(req, res, next) {
  try {
    const raw = ADMIN_EMAILS;
    const admins = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    
    if (admins.length === 0) {
      return res.status(403).json({ msg: 'Admin non configuré' });
    }

    const u = await User.findById(req.user.id);
    if (!u) {
      return res.status(401).json({ msg: 'Utilisateur introuvable' });
    }

    const userEmail = String(u.email || '').toLowerCase();
    if (!admins.includes(userEmail)) {
      return res.status(403).json({ msg: 'Accès refusé' });
    }

    return next();
  } catch (error) {
    console.error('Erreur middleware admin:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

module.exports = adminOnly;
