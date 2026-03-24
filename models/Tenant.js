const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
}, { timestamps: true });

TenantSchema.index(
  { user: 1, property: 1 },
  { unique: true, partialFilterExpression: { property: { $type: 'objectId' } } }
);

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
