const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },

  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  address: { type: String, default: '' },
  zipCode: { type: String, default: '' },
  city: { type: String, default: '' },
  phone: { type: String, default: '' },

  plan: { type: String, enum: ['FREE', 'PRO'], default: 'FREE' },
  credits: { type: Number, default: 0 },

  usage: {
    receipts: {
      month: { type: String, default: '' }, // YYYY-MM
      sent: { type: Number, default: 0 }
    }
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
