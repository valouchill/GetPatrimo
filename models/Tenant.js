const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  createdAt: { type: Date, default: Date.now }
});

TenantSchema.index(
  { user: 1, property: 1 },
  { unique: true, partialFilterExpression: { property: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Tenant', TenantSchema);
