const mongoose = require('mongoose');

const OtpTokenSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  attempts: { type: Number, default: 0 },
});

module.exports = mongoose.models.OtpToken || mongoose.model('OtpToken', OtpTokenSchema);
