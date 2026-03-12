const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
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
  phone: { type: String, default: '' },

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

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
