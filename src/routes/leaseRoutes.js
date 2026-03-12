// Routes pour la gestion des baux
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({
  dest: path.join(__dirname, '../../uploads/edl'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non autorisé. Utilisez JPEG, PNG ou WebP.'));
    }
  }
});

const { 
  getLeaseById, 
  getLeasesByProperty, 
  updateLeaseSignature, 
  updateLeaseEDL, 
  uploadEDLPhoto, 
  updateLease, 
  createLease,
  launchElectronicSignature,
  resendSigningLink,
  getSignatureStatus
} = require('../controllers/leaseController');

// Crée un nouveau bail (doit être avant /:id)
router.post('/', auth, createLease);

// Récupère tous les baux d'un bien spécifique (doit être avant /:id)
router.get('/property/:propertyId', auth, getLeasesByProperty);

// Récupère un bail par son ID
router.get('/:id', auth, getLeaseById);

// Met à jour un bail
router.patch('/:id', auth, updateLease);

// Met à jour le statut de signature (ancien système)
router.post('/:id/signature', auth, updateLeaseSignature);

// OpenSign - Lance la signature électronique
router.post('/:id/opensign/launch', auth, launchElectronicSignature);

// OpenSign - Renvoie le lien de signature
router.post('/:id/opensign/resend', auth, resendSigningLink);

// OpenSign - Récupère le statut de signature
router.get('/:id/opensign/status', auth, getSignatureStatus);

// Met à jour l'état des lieux
router.post('/:id/edl', auth, updateLeaseEDL);

// Upload une photo pour l'EDL
router.post('/:id/edl/photo', auth, upload.array('photos', 10), uploadEDLPhoto);

// Serve EDL photo
router.get('/:id/edl/photo/*', auth, (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const relPath = req.params[0]; // Everything after /photo/
    const absPath = path.join(__dirname, '../../uploads', relPath);
    
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ msg: 'Photo introuvable' });
    }
    
    return res.sendFile(absPath);
  } catch (error) {
    console.error('Erreur serve photo:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
});

module.exports = router;
