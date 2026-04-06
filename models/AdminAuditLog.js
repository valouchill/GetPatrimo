const mongoose = require('mongoose');

const AdminAuditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorEmail: { type: String, required: true, lowercase: true, trim: true },
  actorRole: { type: String, enum: ['admin', 'superadmin'], required: true },

  action: { type: String, required: true }, // e.g. 'user.suspend', 'payment.force_status'
  targetType: { type: String, required: true }, // e.g. 'User', 'Property', 'Lease', 'Payment'
  targetId: { type: mongoose.Schema.Types.ObjectId },

  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },

  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  note: { type: String, default: '' },
}, { timestamps: true });

AdminAuditLogSchema.index({ actorId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetType: 1, targetId: 1 });
AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', AdminAuditLogSchema);
