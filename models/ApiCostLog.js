const mongoose = require('mongoose');

/**
 * ApiCostLog — journal du coût RÉEL de chaque appel API payant.
 *
 * Une ligne = un appel (LLM OpenAI, vérification Didit, email Brevo, frais Stripe…).
 * Alimente le Cockpit SuperAdmin (coûts réels + coût réel par dossier analysé) en
 * remplacement des estimations. Écriture « fire-and-forget » : un échec de log ne
 * doit JAMAIS interrompre l'analyse ou le parcours utilisateur (cf. api-cost-logger).
 */
const ApiCostLogSchema = new mongoose.Schema(
  {
    /** Fournisseur : 'OpenAI', 'Didit', 'Brevo', 'Stripe'. */
    provider: { type: String, required: true, index: true },
    /** Catégorie de coût : 'LLM', 'OCR', 'KYC', 'Mail', 'Payment'. */
    category: { type: String, required: true },
    /** Modèle (LLM) le cas échéant : 'gpt-4o', 'gpt-4o-mini'. */
    model: { type: String, default: '' },

    /** Coût réel de l'appel, en euros. */
    costEur: { type: Number, required: true, default: 0, min: 0 },

    /** Tokens (LLM). */
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    /** Nombre d'unités facturées (appels / vérifications / emails). */
    units: { type: Number, default: 1 },

    /** Rattachement (best-effort) pour le coût PAR dossier. */
    applicationId: { type: String, default: '', index: true },
    userId: { type: String, default: '' },

    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

// Agrégations du cockpit : par période, par catégorie.
ApiCostLogSchema.index({ createdAt: -1 });
ApiCostLogSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.models.ApiCostLog || mongoose.model('ApiCostLog', ApiCostLogSchema);
