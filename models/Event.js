const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    type: { type: String, required: true, index: true }, // e.g. pdf_quittance_generated, email_quittance_sent, document_uploaded...
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

EventSchema.index({ property: 1, type: 1 });
EventSchema.index({ user: 1, createdAt: -1 });

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Event || mongoose.model('Event', EventSchema);
