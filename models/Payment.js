const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  type: { type: String, enum: ['EMAIL', 'SMS'], required: true },
}, { _id: false });

const PaymentSchema = new mongoose.Schema({
  lease: { type: mongoose.Schema.Types.ObjectId, ref: 'Lease', required: [true, 'Le bail est obligatoire'] },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Le locataire est obligatoire'] },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, 'Le propriétaire est obligatoire'] },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: [true, 'Le bien est obligatoire'] },

  period: {
    month: { type: Number, required: true, min: [1, 'Mois invalide'], max: [12, 'Mois invalide'] },
    year: { type: Number, required: true, min: [2020, 'Année invalide'] },
  },

  amounts: {
    rentHC: { type: Number, required: true, min: [0, 'Le loyer ne peut pas être négatif'] },
    charges: { type: Number, required: true, default: 0, min: [0, 'Les charges ne peuvent pas être négatives'] },
    totalTTC: { type: Number, required: true, min: [0, 'Le total ne peut pas être négatif'] },
    paidAmount: { type: Number, default: 0, min: [0, 'Le montant payé ne peut pas être négatif'] },
  },

  prorata: {
    isProrata: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    daysInMonth: { type: Number, min: [28, 'Jours invalides'], max: [31, 'Jours invalides'] },
    daysOccupied: { type: Number, min: [0, 'Jours invalides'] },
    ratio: { type: Number, min: [0, 'Ratio invalide'], max: [1, 'Ratio invalide'] },
  },

  revision: {
    applied: { type: Boolean, default: false },
    previousRent: { type: Number, min: 0 },
    newRent: { type: Number, min: 0 },
    irlIndex: { type: Number },
    irlDate: { type: Date },
  },

  regularization: {
    applied: { type: Boolean, default: false },
    realCharges: { type: Number, min: 0 },
    provisionCharges: { type: Number, min: 0 },
    adjustment: { type: Number }, // positif = trop-perçu, négatif = complément
  },

  discount: {
    applied: { type: Boolean, default: false },
    amount: { type: Number, min: 0 },
    reason: { type: String, maxlength: 500 },
  },

  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'PARTIAL', 'LATE', 'UNPAID'],
    default: 'PENDING',
  },

  confirmedAt: { type: Date },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  receiptUrl: { type: String, default: '' },
  receiptGeneratedAt: { type: Date },

  remindersSent: [ReminderSchema],

  notes: { type: String, maxlength: 2000, default: '' },
}, { timestamps: true });

// Index sur chaque FK + champs de filtre
PaymentSchema.index({ lease: 1 });
PaymentSchema.index({ tenant: 1 });
PaymentSchema.index({ owner: 1 });
PaymentSchema.index({ property: 1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ 'period.year': 1, 'period.month': 1 });
// Index unique : un seul paiement par bail/période
PaymentSchema.index({ lease: 1, 'period.year': 1, 'period.month': 1 }, { unique: true });

module.exports = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
