const mongoose = require('mongoose');

/**
 * PilotGrant — trace d'un octroi d'audits « pilote B2B » (Sprint B2B, vendre
 * d'abord). L'octroi lui-même modifie les Property (tier/quota/managed) ; ce
 * document conserve QUI a reçu QUOI et QUAND, pour le suivi commercial dans
 * l'admin (/dashboard/admin/pilots) : date d'octroi, volume, octroyé par.
 * `createdAt` (timestamps) = date de début de l'octroi.
 */
const PilotGrantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    /** Nombre d'audits offerts par ce grant (ajoutés au quota de chaque bien). */
    audits: { type: Number, required: true, min: 1 },
    /** Nombre de biens équipés au moment du grant. */
    propertiesCount: { type: Number, default: 0 },
    /** Email de l'admin qui a octroyé. */
    grantedBy: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.models.PilotGrant || mongoose.model('PilotGrant', PilotGrantSchema);
