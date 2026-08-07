const mongoose = require('mongoose');

/**
 * LeaseSignature — signature électronique INTERNE de niveau « simple » au sens
 * eIDAS (règlement UE 910/2014) / art. 1367 C. civ.
 *
 * Éléments de preuve constitués pour chaque signataire :
 *  - identification : email + (pour le locataire) identité biométrique déjà
 *    vérifiée par Didit lors de la candidature (`diditVerified`) ;
 *  - consentement : code OTP à usage unique envoyé par email, saisi par le
 *    signataire (`otpVerifiedAt`) ;
 *  - intégrité : empreinte SHA-256 du PDF au moment de la signature
 *    (`documentHash`) — toute modification ultérieure invalide la preuve ;
 *  - horodatage serveur + IP + user-agent ;
 *  - image manuscrite (canvas) apposée sur le document.
 *
 * Ces éléments sont restitués dans la page « Certificat de signature » annexée
 * au PDF final (piste d'audit).
 */
const LeaseSignatureSchema = new mongoose.Schema(
  {
    lease: { type: mongoose.Schema.Types.ObjectId, ref: 'Lease', required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },

    /** Ordre de signature : bailleur → locataire(s) → garant. */
    role: {
      type: String,
      enum: ['OWNER', 'TENANT', 'COTENANT', 'GUARANTOR'],
      required: true,
    },
    /** Slot pour les colocataires (2-4) ; 1 = locataire principal. */
    slot: { type: Number, default: 1 },
    order: { type: Number, default: 0 },

    fullName: { type: String, default: '' },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },

    status: {
      type: String,
      enum: ['PENDING', 'VIEWED', 'SIGNED', 'DECLINED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },

    /** Hash SHA-256 du token d'accès (le token brut n'est JAMAIS stocké). */
    tokenHash: { type: String, required: true, index: true },
    tokenExpiresAt: { type: Date, required: true },

    /** Preuve de consentement OTP. */
    otpVerifiedAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 },

    /** Preuve d'intégrité : empreinte du PDF signé. */
    documentHash: { type: String, default: '' },
    /** Image manuscrite (data URL PNG du canvas), apposée sur le document. */
    signatureImage: { type: String, default: '' },

    signedAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    declinedAt: { type: Date, default: null },
    declineReason: { type: String, default: '' },

    /** Contexte technique (piste d'audit). */
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    /** Identité vérifiée eIDAS (Didit) au moment de la candidature. */
    diditVerified: { type: Boolean, default: false },

    /** Traçabilité de l'invitation (revue F7 : échec d'email = campagne gelée). */
    inviteSentAt: { type: Date, default: null },
    inviteError: { type: String, default: '' },

    remindersSentAt: [{ type: Date }],
  },
  { timestamps: true },
);

LeaseSignatureSchema.index({ lease: 1, role: 1, slot: 1 }, { unique: true });

module.exports =
  mongoose.models.LeaseSignature || mongoose.model('LeaseSignature', LeaseSignatureSchema);
