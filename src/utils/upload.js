// Configuration Multer pour les uploads de fichiers
const multer = require('multer');
const path = require('path');
const { propertyDocUploadDir, candidatsUploadDir } = require('../config/app');

// Configuration upload documents bien
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, propertyDocUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = (ext && ext.length <= 8) ? ext : '';
    cb(null, 'doc-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + safeExt);
  }
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimetype);
    if (!ok) {
      return cb(new Error('Type de fichier non autorisé'));
    }
    cb(null, true);
  }
});

// Configuration upload candidatures publiques
const candidatureStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, candidatsUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, 'candidat-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});

const candidatureUpload = multer({ 
  storage: candidatureStorage, 
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Accepte PDF, PNG, JPEG
    const ok = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype) ||
               /\.(pdf|png|jpg|jpeg)$/i.test(file.originalname || '');
    if (!ok) {
      return cb(new Error('Type de fichier non autorisé (PDF/PNG/JPEG uniquement)'));
    }
    cb(null, true);
  }
});

module.exports = {
  docUpload,
  candidatureUpload
};
