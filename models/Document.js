const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },

    type: {
      type: String,
      default: 'AUTRE',
      index: true,
      set: v => v ? v.toUpperCase() : v,
      validate: {
        validator: function(v) {
          const validTypes = [
            // Types généraux
            'BAIL', 'ETAT_DES_LIEUX', 'DIAGNOSTIC', 'QUITTANCE', 'QUITTANCE_LOYER', 'DOSSIER_LOCATAIRE', 'AUTRE',
            // Types de diagnostics spécifiques
            'DPE', 'PLOMB', 'AMIANTE', 'ELECTRICITE', 'GAZ', 'ERP', 'BOUTIN', 'ANNEXES_TECHNIQUES',
            // Types documents locataire
            'DOSSIER_LOCATAIRE_ID', 'DOSSIER_LOCATAIRE_INCOME', 'DOSSIER_LOCATAIRE_TAX', 'DOSSIER_LOCATAIRE_ADDRESS',
            // Types pour le scoring PatrimoScore™
            'PIECE_IDENTITE', 'CNI', 'PASSEPORT', 'BULLETIN_SALAIRE', 'AVIS_IMPOSITION', 'ATTESTATION_EMPLOYEUR', 'CONTRAT_TRAVAIL'
          ];
          const upper = (v || '').toUpperCase();
          return validTypes.includes(upper) || upper.startsWith('DOSSIER_LOCATAIRE_');
        },
        message: 'Type de document non valide'
      }
    },

    originalName: { type: String, default: '' },
    filename: { type: String, required: true },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },

    relPath: { type: String, required: true }, // relatif à /app/uploads
    diagnosticDate: { type: Date, default: null },
    analysisStatus: { type: String, default: '' }, // valid, expired, warning, missing
    analysisNotes: { type: String, default: '' },
    isExpired: { type: Boolean, default: false },

    // Champs pour le scoring PatrimoScore™ avec règles de péremption
    documentDate: { type: Date }, // Date du document (ex: date du bulletin de salaire)
    expirationDate: { type: Date }, // Date d'expiration (pour pièce d'identité)
    metadata: {
      documentType: { type: String, default: '' },
      extractedData: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
      expirationDate: { type: Date },
      issuer: { type: String, default: '' },
    }
  },
  { timestamps: true }
);

// Index composé pour requêtes fréquentes
DocumentSchema.index({ property: 1, type: 1 });

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Document || mongoose.model('Document', DocumentSchema);
