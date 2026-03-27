const mongoose = require('mongoose');
const crypto = require('crypto');

const PropertySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  name: { type: String, required: true },

  // legacy + affichage
  address: { type: String, required: true },

  // v2
  addressLine: { type: String, default: '' },
  zipCode: { type: String, default: '' },
  city: { type: String, default: '' },

  rentAmount: { type: Number, required: [true, 'Le loyer est obligatoire'], min: [0, 'Le loyer ne peut pas être négatif'] },
  chargesAmount: { type: Number, default: 0, min: [0, 'Les charges ne peuvent pas être négatives'] },

  surfaceM2: { type: Number, default: null, min: [0, 'La surface ne peut pas être négative'] },

  applyToken: { type: String, default: '', unique: true, sparse: true },

  // Documents obligatoires à transmettre au locataire
  requiredDocuments: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isMandatory: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  }],

  // Diagnostics techniques obligatoires (DDT)
  diagnostics: [{
    type: {
      type: String,
      enum: ['DPE', 'CREP', 'AMIANTE', 'ELECTRICITE', 'GAZ', 'ERP', 'BRUIT', 'NOTICE_INFO', 'REGLEMENT_COPRO', 'ELEC_GAZ', 'PLOMB', 'BOUTIN'],
      set: v => v ? v.toUpperCase() : v,
      required: true
    },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    uploadedAt: { type: Date, default: Date.now },
    expiryDate: { type: Date }, // Date d'expiration du diagnostic
    isValid: { type: Boolean, default: true }
  }],

  // Statut du bien dans le cycle de location
  status: { 
    type: String, 
    enum: ['AVAILABLE', 'CANDIDATE_SELECTION', 'LEASE_IN_PROGRESS', 'OCCUPIED', 'VACANT'], 
    default: 'AVAILABLE' 
  },

  archived: { type: Boolean, default: false },

  // Stripe & gestion premium
  managed: { type: Boolean, default: false },
  stripeCustomerId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },
  acceptedTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },

}, { timestamps: true });

function generatePrivilegeCode(address) {
  const zipMatch = (address || '').match(/\b(\d{5})\b/);
  const zip = zipMatch ? zipMatch[1] : '00000';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `PT-${zip}-${suffix}`;
}

PropertySchema.pre('save', async function(next) {
  if (!this.applyToken || this.applyToken === '') {
    const model = this.constructor;
    let token = generatePrivilegeCode(this.address);
    let attempts = 0;
    while (attempts < 10) {
      const exists = await model.findOne({ applyToken: token });
      if (!exists) break;
      token = generatePrivilegeCode(this.address);
      attempts++;
    }
    this.applyToken = token;
  }
  next();
});

// Index sur clés étrangères et champs de filtre
PropertySchema.index({ user: 1 });
PropertySchema.index({ status: 1 });
PropertySchema.index({ user: 1, status: 1 });
PropertySchema.index({ applyToken: 1 });

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Property || mongoose.model('Property', PropertySchema);
