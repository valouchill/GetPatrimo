const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },

    type: {
      type: String,
      default: 'autre',
      index: true,
      validate: {
        validator: function(v) {
          // Accepte tous les types de documents (plus flexible)
          const validTypes = [
            // Types généraux
            'bail', 'etat_des_lieux', 'diagnostic', 'quittance', 'quittance_loyer', 'dossier_locataire', 'autre',
            // Types de diagnostics spécifiques
            'dpe', 'plomb', 'amiante', 'electricite', 'gaz', 'erp', 'boutin', 'annexes_techniques',
            // Types documents locataire
            'dossier_locataire_id', 'dossier_locataire_income', 'dossier_locataire_tax', 'dossier_locataire_address',
            // Types pour le scoring PatrimoScore™
            'piece_identite', 'cni', 'passeport', 'bulletin_salaire', 'avis_imposition', 'attestation_employeur', 'contrat_travail'
          ];
          // Si le type commence par 'dossier_locataire_', on l'accepte aussi
          return validTypes.includes(v) || v.startsWith('dossier_locataire_');
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
      type: {
        documentType: String, // 'identity', 'income', 'employment', 'rent_receipt'
        extractedData: mongoose.Schema.Types.Mixed // Données extraites par l'IA
      },
      default: {}
    }
  },
  { timestamps: true }
);

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Document || mongoose.model('Document', DocumentSchema);
