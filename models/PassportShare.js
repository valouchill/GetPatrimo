const mongoose = require('mongoose');

const PassportShareSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    shareToken: { type: String, required: true, unique: true, index: true },
    recipientEmail: { type: String, required: true },
    recipientName: { type: String, default: '' },
    personalMessage: { type: String, default: '' },
    sharedAt: { type: Date, default: Date.now },
    openedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PassportShareSchema.index({ application: 1, recipientEmail: 1 });

module.exports = mongoose.models.PassportShare || mongoose.model('PassportShare', PassportShareSchema);
