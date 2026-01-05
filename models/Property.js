const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  name: { type: String, required: true },

  // legacy + affichage
  address: { type: String, required: true },

  // v2
  addressLine: { type: String, default: '' },
  zipCode: { type: String, default: '' },
  city: { type: String, default: '' },

  rentAmount: { type: Number, required: true },
  chargesAmount: { type: Number, default: 0 },

  surfaceM2: { type: Number, default: null },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Property', PropertySchema);
