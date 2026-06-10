const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Email invalide'] },
  password: { type: String, default: '' }, // Optionnel pour OAuth
  
  // OAuth (optionnel, seulement pour les utilisateurs OAuth)
  oauthProvider: { 
    type: String, 
    required: false,
    validate: {
      validator: function(v) {
        // Permet null, undefined ou les valeurs enum valides
        return v === null || v === undefined || ['google', 'apple'].includes(v);
      },
      message: 'oauthProvider doit être null, undefined, "google" ou "apple"'
    }
  },
  oauthId: { 
    type: String, 
    default: '', 
    required: false 
  },

  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  address: { type: String, default: '' },
  zipCode: { type: String, default: '' },
  city: { type: String, default: '' },
  phone: { type: String, default: '', validate: { validator: function(v) { return !v || /^\+?[0-9]{10,15}$/.test(v); }, message: 'Numéro de téléphone invalide' } },

  plan: { type: String, enum: ['FREE', 'PRO'], default: 'FREE' },
  role: { type: String, enum: ['owner', 'tenant', 'admin', 'superadmin'], default: 'owner' },
  credits: { type: Number, default: 0 },

  // Suspension (bloque le login)
  suspended: { type: Boolean, default: false },
  suspendedAt: { type: Date },
  suspendedReason: { type: String, default: '' },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Traçabilité promotion admin
  adminPromotedAt: { type: Date },
  adminPromotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Suppression RGPD (soft-delete / anonymisation — art. 17)
  deletedAt: { type: Date },

  usage: {
    receipts: {
      month: { type: String, default: '' }, // YYYY-MM
      sent: { type: Number, default: 0 }
    }
  },

  // Stripe
  stripeCustomerId: { type: String, default: '' },

  // Essai gratuit : nb d'analyses IA consommées au niveau du COMPTE (plafond FREE_TRIAL_LIMIT).
  freeAnalysesUsed: { type: Number, default: 0 },

  // Magic Auth — token à usage unique pour connexion sans mot de passe (Fast-Track)
  magicSignInToken: { type: String, default: '' },
  magicSignInExpiresAt: { type: Date },

  // Email preferences (RGPD art. 21 — droit d'opposition)
  emailPreferences: {
    reminders: { type: Boolean, default: true },
    marketing: { type: Boolean, default: true },
  },

  // 2FA TOTP (optional)
  totpSecret: { type: String, default: '' },   // encrypted base32 secret
  totpEnabled: { type: Boolean, default: false },
  totpBackupCodes: [{ type: String }],          // hashed backup codes

  // Signature proprietaire (PNG) pour quittances de loyer
  signatureUrl: { type: String, default: '' },
  signatureUploadedAt: { type: Date },

  // V7.10 — Centre de notifications IA :
  // IDs des notifications marquees "lues" cote serveur (cross-device sync).
  // Plafond logique : 500 entrees max, FIFO eviction cote serveur si depasse.
  readNotificationIds: [{ type: String }],
  notificationsReadAt: { type: Date },

}, { timestamps: true });

UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ suspended: 1 });

// Politique de mot de passe : min 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;

UserSchema.pre('save', function(next) {
  // Valider uniquement si le mot de passe est modifié et non vide (les comptes OTP/OAuth ont un mot de passe vide)
  if (this.isModified('password') && this.password && this.password.length > 0) {
    // Ne pas valider les mots de passe déjà hashés (bcrypt hashes commencent par $2)
    if (!this.password.startsWith('$2') && !PASSWORD_REGEX.test(this.password)) {
      return next(new Error('Le mot de passe doit contenir au moins 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.'));
    }
  }
  next();
});

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
