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
  credits: { type: Number, default: 0 },

  usage: {
    receipts: {
      month: { type: String, default: '' }, // YYYY-MM
      sent: { type: Number, default: 0 }
    }
  },

  // Stripe
  stripeCustomerId: { type: String, default: '' },

  // Magic Auth — token à usage unique pour connexion sans mot de passe (Fast-Track)
  magicSignInToken: { type: String, default: '' },
  magicSignInExpiresAt: { type: Date },

  createdAt: { type: Date, default: Date.now }
});

// Politique de mot de passe : min 8 caractères, 1 majuscule, 1 chiffre
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

UserSchema.pre('save', function(next) {
  // Valider uniquement si le mot de passe est modifié et non vide (les comptes OTP/OAuth ont un mot de passe vide)
  if (this.isModified('password') && this.password && this.password.length > 0) {
    // Ne pas valider les mots de passe déjà hashés (bcrypt hashes commencent par $2)
    if (!this.password.startsWith('$2') && !PASSWORD_REGEX.test(this.password)) {
      return next(new Error('Le mot de passe doit contenir au moins 8 caractères, 1 majuscule et 1 chiffre.'));
    }
  }
  next();
});

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
