const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    source: { type: String, default: 'landing', index: true },
    utm: {
      source: { type: String, default: '' },
      medium: { type: String, default: '' },
      campaign: { type: String, default: '' },
      term: { type: String, default: '' },
      content: { type: String, default: '' },
    },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
