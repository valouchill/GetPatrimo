const mongoose = require('mongoose');

/**
 * Contestation d'un résultat d'analyse automatisée (art. 22 RGPD — AIPD M11).
 * Trace le réexamen humain : qui a contesté, quoi, et la réponse apportée.
 */
const ContestationSchema = new mongoose.Schema({
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
  userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  message: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['NEW', 'REVIEWED'], default: 'NEW', index: true },
  reviewNote: { type: String, default: '', maxlength: 2000 },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.models.Contestation || mongoose.model('Contestation', ContestationSchema);
