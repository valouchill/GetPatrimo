const mongoose = require('mongoose');

const CandidatureSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },

  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, default: '' },
  message: { type: String, default: '' },

  monthlyNetIncome: { type: Number, default: 0 },
  contractType: { type: String, default: '' },
  hasGuarantor: { type: Boolean, default: false },
  guarantorType: { type: String, default: '' },

  docs: [{
    originalName: String,
    filename: String,
    mimeType: String,
    size: Number,
    relPath: String,
    createdAt: { type: Date, default: Date.now }
  }],

  status: { type: String, enum: ['NEW','REVIEWED','ACCEPTED','REJECTED','SELECTED_FOR_LEASE','ARCHIVED_REFUSED'], default: 'NEW' },

  shortlisted: { type: Boolean, default: false },
  internalNote: { type: String, default: '' },


  scoring: {
    version: { type: String, default: 'v1' },
    total: { type: Number, default: 0 },
    grade: { type: String, default: '' },
    ratio: { type: Number, default: 0 },
    breakdown: [{
      key: String,
      label: String,
      points: Number,
      detail: String,
      category: String
    }],
    flags: [{ type: String }],
    alerts: [{
      code: String,
      type: String,
      severity: String,
      message: String
    }]
  },

  // Moteur PatrimoTrust™
  trustAnalysis: {
    score: { type: Number, default: 0 }, // 0-100
    status: { type: String, enum: ['PENDING', 'VALIDATED', 'WARNING', 'REJECTED'], default: 'PENDING' },
    summary: { type: String, default: '' }, // AI Insight
    rating: { type: String, default: '' },
    breakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    checks: [{
      id: String, // ex: 'effort_rate', 'id_mrz', 'photoshop_detect'
      label: String,
      status: { type: String, enum: ['PASS', 'WARNING', 'FAIL'] },
      details: String,
      metadata: mongoose.Schema.Types.Mixed
    }],
    phase1: { type: mongoose.Schema.Types.Mixed, default: null },
    analyzedAt: Date
  },
  identityVerification: {
    status: { type: String, enum: ['PENDING', 'CERTIFIEE'], default: 'PENDING' },
    provider: { type: String, default: 'didit' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    birthDate: { type: String, default: '' },
    humanVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date }
  },
  scoredAt: { type: Date },
  
  // RGPD
  rgpdPurged: { type: Boolean, default: false },
  rgpdPurgedAt: { type: Date }
}, { timestamps: true });

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Candidature || mongoose.model('Candidature', CandidatureSchema);
