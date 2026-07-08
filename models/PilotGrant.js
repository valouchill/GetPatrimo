const mongoose = require('mongoose');

/**
 * PilotGrant — trace d'un octroi d'audits « pilote B2B » (Sprint B2B, vendre
 * d'abord). Deux cas :
 *  - APPLIED : le compte existait avec ≥1 bien → Property modifiées immédiatement.
 *  - PENDING : pas de compte (ou pas encore de bien) → email d'invitation envoyé ;
 *    le grant s'applique automatiquement à la création du premier bien
 *    (hook POST /api/owner/properties).
 * `createdAt` (timestamps) = date de début de l'octroi.
 */
const PilotGrantSchema = new mongoose.Schema(
  {
    /** Null tant que le compte n'existe pas (grant PENDING pré-inscription). */
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    /** Nombre d'audits offerts par ce grant (ajoutés au quota de chaque bien équipé). */
    audits: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['PENDING', 'APPLIED'], default: 'APPLIED', index: true },
    /** Date d'application effective (immédiate, ou à la création du 1er bien). */
    appliedAt: { type: Date, default: null },
    /** Nombre de biens équipés au moment de l'application. */
    propertiesCount: { type: Number, default: 0 },
    /** Email de l'admin qui a octroyé. */
    grantedBy: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.models.PilotGrant || mongoose.model('PilotGrant', PilotGrantSchema);
