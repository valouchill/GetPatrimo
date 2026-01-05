const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ msg: 'Pas de token, autorisation refusée' });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ msg: 'JWT_SECRET manquant côté serveur' });

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token non valide' });
  }
};
