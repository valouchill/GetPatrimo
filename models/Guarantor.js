const mongoose = require('mongoose');

const GuarantorSchema = new mongoose.Schema({
  // Lien vers la candidature (optionnel, pour compatibilité)
  candidature: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidature' },
  
  // Lien vers la Property (via applyToken)
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  applyToken: { type: String, default: '' }, // Token de la page apply
  slot: { type: Number, enum: [1, 2], default: 1 },
  
  // Informations du garant
  email: { type: String, required: true, trim: true, lowercase: true },
  // Sécurité (audit passe-5) : email du CANDIDAT qui a invité ce garant. L'applyToken est PARTAGÉ
  // entre tous les candidats d'une annonce → sans ce scope, un candidat héritait du garant certifié
  // d'un autre et voyait son identité KYC. Renseigné à l'invitation, filtré au scoring.
  tenantEmail: { type: String, default: '', trim: true, lowercase: true, index: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  
  // Statut de certification
  status: { 
    type: String, 
    enum: ['PENDING', 'CERTIFIED'], 
    default: 'PENDING' 
  },
  
  // Session Didit pour la certification
  diditSessionId: { type: String, default: '' },
  
  // Identité certifiée par Didit
  identityVerification: {
    status: { type: String, enum: ['PENDING', 'CERTIFIEE'], default: 'PENDING' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    birthDate: { type: String, default: '' },
    humanVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date }
  },
  
  // Token unique pour l'invitation
  invitationToken: { 
    type: String, 
    unique: true, 
    index: true,
    required: true 
  },
  
  // Date d'envoi de l'invitation
  invitationSentAt: { type: Date },
  
  // Date de certification
  certifiedAt: { type: Date },
  
  // Option "En Direct" - si le garant est présent physiquement
  isDirectCertification: { type: Boolean, default: false },
  
  // RGPD
  rgpdPurged: { type: Boolean, default: false },
  rgpdPurgedAt: { type: Date }
}, { timestamps: true });

// Index pour recherche rapide
GuarantorSchema.index({ candidature: 1, status: 1 });
GuarantorSchema.index({ property: 1, status: 1 });
GuarantorSchema.index({ applyToken: 1, status: 1 });
GuarantorSchema.index({ applyToken: 1, slot: 1, email: 1 });
GuarantorSchema.index({ invitationToken: 1 });

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Guarantor || mongoose.model('Guarantor', GuarantorSchema);
