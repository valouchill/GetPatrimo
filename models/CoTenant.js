const mongoose = require('mongoose');

/**
 * Modèle CoTenant — un colocataire (slot 2-4) d'une candidature de colocation.
 *
 * Clone du modèle Guarantor : même flux « remplir / inviter » avec eIDAS Didit
 * par personne (invitationToken, diditSessionId, identityVerification).
 *
 * Différence clé vs Guarantor : porte `applicationId` (ref Application) pour que
 * le webhook Didit puisse RE-SYNCHRONISER le statut certifié + recalculer le
 * score vers l'Application — le flux garant ne fermait jamais cette boucle.
 */
const CoTenantSchema = new mongoose.Schema({
  // Lien direct vers l'Application (NOUVEAU vs Guarantor) — clé du re-sync serveur.
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },

  // Lien vers la Property (via applyToken)
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  applyToken: { type: String, default: '' },
  slot: { type: Number, enum: [2, 3, 4], default: 2 }, // slot 1 = locataire principal (Application)

  // Informations du colocataire
  email: { type: String, required: true, trim: true, lowercase: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  phone: { type: String, default: '' },
  profile: { type: String, default: 'Etudiant' }, // statut (Etudiant/Salarie/...) pour le sous-score

  // Statut de certification
  status: {
    type: String,
    enum: ['INVITED', 'PENDING', 'CERTIFIED'],
    default: 'PENDING',
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
    verifiedAt: { type: Date },
  },

  // Token unique pour l'invitation
  invitationToken: {
    type: String,
    unique: true,
    index: true,
    required: true,
  },
  invitationSentAt: { type: Date },
  certifiedAt: { type: Date },

  // Option "En Direct" — colocataire présent physiquement (certifié in-tunnel)
  isDirectCertification: { type: Boolean, default: false },

  // RGPD
  rgpdPurged: { type: Boolean, default: false },
  rgpdPurgedAt: { type: Date },
}, { timestamps: true });

// Index (calqués sur Guarantor + applicationId pour le re-sync)
CoTenantSchema.index({ applyToken: 1, slot: 1, email: 1 });
CoTenantSchema.index({ applyToken: 1, status: 1 });
CoTenantSchema.index({ applicationId: 1, slot: 1 });
CoTenantSchema.index({ invitationToken: 1 });

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.CoTenant || mongoose.model('CoTenant', CoTenantSchema);
