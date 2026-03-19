// Configuration générale de l'application
const path = require('path');
const fs = require('fs');

// Variables d'environnement
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || '';
const GEO_VALIDATION = process.env.GEO_VALIDATION !== '0';

// Configuration Brevo SMTP
const BREVO_USER = process.env.BREVO_USER;
const BREVO_PASS = process.env.BREVO_PASS;
const MAIL_FROM = process.env.MAIL_FROM || '"Doc2Loc" <no-reply@doc2loc.com>';

// Configuration Admin
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '');

// Validation des variables critiques
if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET manquant (dans .env)");
  process.exit(1);
}

// Configuration des limites de paywall
const LIMITS = { FREE: 3, PRO: 999999 };

// Configuration des dossiers d'upload
const uploadsDir = process.env.DOC2LOC_UPLOADS_DIR
  ? path.resolve(process.env.DOC2LOC_UPLOADS_DIR)
  : path.resolve(process.cwd(), 'uploads');
const propertyDocUploadDir = path.join(uploadsDir, 'property-documents');
const candidatsUploadDir = path.join(uploadsDir, 'candidats');

// Création des dossiers si nécessaire
try {
  fs.mkdirSync(propertyDocUploadDir, { recursive: true });
  fs.mkdirSync(candidatsUploadDir, { recursive: true });
} catch (error) {
  console.error("❌ Erreur création dossiers upload:", error?.message);
}

module.exports = {
  PORT,
  JWT_SECRET,
  GEO_VALIDATION,
  BREVO_USER,
  BREVO_PASS,
  MAIL_FROM,
  ADMIN_EMAILS,
  LIMITS,
  uploadsDir,
  propertyDocUploadDir,
  candidatsUploadDir
};
