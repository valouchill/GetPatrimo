// Middleware de gestion centralisée des erreurs

/**
 * Middleware de gestion des erreurs Multer (upload)
 */
function multerErrorHandler(err, req, res, next) {
  // Vérifie si c'est une erreur Multer
  if (err) {
    console.error('Erreur Multer:', err.message, err.code);
    
    if (err.message && err.message.includes('Type de fichier non autorisé')) {
      return res.status(400).json({ msg: 'Type de fichier non autorisé (PDF/PNG/JPEG)' });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'Fichier trop lourd : limite 10 Mo' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ msg: 'Nom de champ de fichier incorrect. Utilisez "documents"' });
    }
    // Erreur Multer générique
    if (err.name === 'MulterError') {
      return res.status(400).json({ msg: `Erreur upload: ${err.message || 'Erreur inconnue'}` });
    }
  }
  return next(err);
}

/**
 * Middleware de gestion générale des erreurs
 */
function errorHandler(err, req, res, next) {
  console.error('Erreur non gérée:', err);
  
  // Erreur Mongoose validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      msg: 'Erreur de validation', 
      errors: err.errors 
    });
  }

  // Erreur Mongoose cast (ObjectId invalide)
  if (err.name === 'CastError') {
    return res.status(400).json({ msg: 'ID invalide' });
  }

  // Erreur par défaut
  return res.status(500).json({ msg: 'Erreur serveur' });
}

module.exports = {
  multerErrorHandler,
  errorHandler
};
