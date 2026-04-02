const mongoose = require('mongoose');

// Labels conformes au décret n°2016-382 du 30 mars 2016
const ConditionEnum = ['TRES_BON', 'BON', 'USAGE_NORMAL', 'MAUVAIS_ETAT', 'HORS_SERVICE',
  // Legacy values (backward compatibility)
  'GOOD', 'NORMAL_WEAR', 'DEGRADED', 'NEEDS_RENOVATION'];

const InspectionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  lease: { type: mongoose.Schema.Types.ObjectId, ref: 'Lease', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Type and status
  type: { type: String, enum: ['ENTRY', 'EXIT'], required: true },
  status: { type: String, enum: ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'SIGNED'], default: 'DRAFT' },
  date: { type: Date, default: Date.now },

  // Meter readings
  meterReadings: {
    water: { type: Number, default: null },
    gas: { type: Number, default: null },
    electricity: { type: Number, default: null },
    heating: { type: Number, default: null },
  },

  // Rooms (pièce par pièce)
  rooms: [{
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    wallCondition: { type: String, enum: ConditionEnum, default: 'GOOD' },
    floorCondition: { type: String, enum: ConditionEnum, default: 'GOOD' },
    ceilingCondition: { type: String, enum: ConditionEnum, default: 'GOOD' },
    equipment: [{
      name: { type: String, required: true },
      condition: { type: String, enum: ConditionEnum, default: 'GOOD' },
      comment: { type: String, default: '' },
    }],
    photos: [{
      url: { type: String, required: true },
      caption: { type: String, default: '' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    comment: { type: String, default: '' },
  }],

  // Clés et moyens d'accès remis (décret n°2016-382)
  keysDelivered: [{
    type: { type: String, default: 'Clé' },  // Clé, Badge, Télécommande, Bip, Digicode...
    quantity: { type: Number, default: 1 },
    description: { type: String, default: '' },
  }],

  // Signatures
  signatures: {
    owner: {
      data: { type: String },  // base64 signature image
      date: { type: Date },
      name: { type: String },
    },
    tenant: {
      data: { type: String },
      date: { type: Date },
      name: { type: String },
    },
  },

  // Comparison (for exit inspections)
  comparison: {
    entryInspectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inspection', default: null },
    retentions: [{
      room: { type: String },
      item: { type: String },
      description: { type: String },
      amount: { type: Number, default: 0 },
    }],
    totalRetention: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
  },

  // Generated PDF
  pdfUrl: { type: String, default: null },

}, { timestamps: true });

InspectionSchema.index({ user: 1, property: 1 });
InspectionSchema.index({ lease: 1, type: 1 });
InspectionSchema.index({ property: 1, type: 1 });

module.exports = mongoose.models.Inspection || mongoose.model('Inspection', InspectionSchema);
