const mongoose = require('mongoose');

const IdentitySessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true, index: true, required: true },
  applyToken: { type: String, default: '' },
  status: { type: String, default: 'PENDING' },
  identityStatus: { type: String, enum: ['PENDING', 'CERTIFIEE'], default: 'PENDING' },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  birthDate: { type: String, default: '' },
  humanVerified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  /** Horodatage de purge RGPD de l'identité en clair (nom/date de naissance). */
  biometricPurgedAt: { type: Date, default: null }
}, { timestamps: true });

IdentitySessionSchema.index({ applyToken: 1 });

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.IdentitySession || mongoose.model('IdentitySession', IdentitySessionSchema);
