const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },

    type: {
      type: String,
      enum: ['bail', 'etat_des_lieux', 'diagnostic', 'quittance', 'dossier_locataire', 'autre'],
      default: 'autre',
      index: true
    },

    originalName: { type: String, default: '' },
    filename: { type: String, required: true },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },

    relPath: { type: String, required: true } // relatif à /app/uploads
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', DocumentSchema);
