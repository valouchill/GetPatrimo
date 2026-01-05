const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    source: { type: String, default: 'landing', index: true },
    utm: { type: Object, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', LeadSchema);
