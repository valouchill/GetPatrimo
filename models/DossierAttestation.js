const mongoose = require('mongoose');

/**
 * Attestation de contrôle du dossier locataire.
 *
 * C'est le livrable VENDU : une pièce datée que le bailleur ou l'administrateur
 * de biens conserve pour établir qu'il a procédé aux vérifications au moment de
 * la décision. Ce n'est pas un rapport d'audit — c'est une décision documentée.
 *
 * Le `verificationId` permet à un tiers (assureur, garant, juge, locataire) de
 * vérifier en ligne qu'une attestation présentée existe bien et n'a pas été
 * altérée, sans divulguer la moindre pièce ni donnée personnelle.
 */
const CheckSchema = new mongoose.Schema({
  code: { type: String, required: true },
  label: { type: String, required: true },
  status: { type: String, enum: ['PASSED', 'FAILED', 'UNAVAILABLE'], required: true },
  detail: { type: String, default: '' },
}, { _id: false });

const DossierAttestationSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', index: true },
  /** Bailleur ou professionnel destinataire de l'attestation. */
  issuedFor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  /** Identifiant public, court et non devinable — imprimé sur la pièce. */
  verificationId: { type: String, required: true, unique: true, index: true },

  verdict: { type: String, enum: ['CONFORME', 'NON_CONFORME', 'INCOMPLET'], required: true },
  protocolVersion: { type: String, required: true },
  checks: { type: [CheckSchema], default: [] },

  /** Empreinte des pièces au moment du contrôle : détecte toute substitution. */
  documentsHash: { type: String, default: '' },
  documentsCount: { type: Number, default: 0 },

  /** Nom du candidat, figé — le dossier peut être purgé, l'attestation reste. */
  candidateName: { type: String, default: '' },
  propertyLabel: { type: String, default: '' },

  pdfPath: { type: String, default: '' },
  issuedAt: { type: Date, default: Date.now },
  /** Révocation possible (erreur, contestation) sans supprimer la trace. */
  revokedAt: { type: Date, default: null },
  revokedReason: { type: String, default: '' },
}, { timestamps: true });

DossierAttestationSchema.index({ issuedFor: 1, issuedAt: -1 });

module.exports = mongoose.models.DossierAttestation
  || mongoose.model('DossierAttestation', DossierAttestationSchema);
