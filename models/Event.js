const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null, index: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },
    type: { type: String, required: true, index: true }, // e.g. pdf_quittance_generated, email_quittance_sent, document_uploaded...
    meta: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

EventSchema.index({ property: 1, type: 1 });
EventSchema.index({ user: 1, createdAt: -1 });
// Stripe webhook idempotency (revue V1 — S11) : unicité ATOMIQUE du marqueur d'event.
// Index partiel → ne contraint que les events Stripe (meta.stripeEventId présent),
// pas les autres types d'Event. Permet l'« insert-first » comme verrou anti-doublon.
EventSchema.index(
  { 'meta.stripeEventId': 1 },
  { unique: true, partialFilterExpression: { 'meta.stripeEventId': { $exists: true } } },
);

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Event || mongoose.model('Event', EventSchema);
