/**
 * Feature flags V1 — source unique de vérité.
 *
 * V1 se concentre sur le cœur métier : sélection IA du locataire.
 * Les features ci-dessous sont désactivées et seront réactivées en V2+.
 *
 * Override possible via NEXT_PUBLIC_FEATURES_V1 (JSON) pour ré-activer en prod
 * sans rebuild. Exemple : NEXT_PUBLIC_FEATURES_V1='{"LEASES":true}'
 */

export const FEATURES_V1_DEFAULTS = {
  LEASES: false,         // baux, signatures électroniques
  EDL: false,            // états des lieux
  RECEIPTS: false,       // quittances / loyers
  MANAGEMENT: false,     // gestion locative
  TENANT_PAYMENT: false, // paiement 4,99€ locataire (Passeport)
  OWNER_PAYWALL: false,  // abonnement 4,99€/mois propriétaire
  PASSPORT_PDF: true,    // Passeport Locatif PDF partageable (nouveau V1)
  LANDING_V1: true,      // landing commerciale V1
  // V8.0 — Pay-per-Listing : enforcement STRICT du quota d'analyses IA.
  //  - false (défaut) : SOFT — /pricing, jauge et suivi d'usage actifs, mais
  //    une offre FREE n'est PAS bloquée (pas de 402). Idéal pendant la config
  //    Stripe.
  //  - true : HARD — FREE → 402 Payment Required. À activer une fois les
  //    Price IDs Stripe configurés.
  //    Override prod : NEXT_PUBLIC_FEATURES_V1='{"BILLING_ENFORCED":true}'
  BILLING_ENFORCED: true,
  // Mode "dossier exemple" : démo d'analyse (fixture) pour l'aha moment sans
  // locataire réel, sans quota, sans essai gratuit, sans Didit. Seul le scoring
  // LLM (~0,04 €) tourne, taggé isSample → exclu de la COGS/marge du cockpit.
  DEMO_MODE_ALLOWED: true,
  // Section "waitlist gestion locative" sur la landing : collecte d'intérêt
  // (modèle Lead via /api/public/lead) AVANT que la feature MANAGEMENT n'existe.
  WAITLIST_MANAGEMENT: true,
} as const;

export type FeatureKey = keyof typeof FEATURES_V1_DEFAULTS;

function readOverrides(): Partial<Record<FeatureKey, boolean>> {
  const raw =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FEATURES_V1) ||
    '';
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // ignore parse errors
  }
  return {};
}

const OVERRIDES = readOverrides();

export const FEATURES_V1: Record<FeatureKey, boolean> = Object.fromEntries(
  (Object.keys(FEATURES_V1_DEFAULTS) as FeatureKey[]).map((k) => [
    k,
    OVERRIDES[k] ?? FEATURES_V1_DEFAULTS[k],
  ])
) as Record<FeatureKey, boolean>;

export const isEnabled = (k: FeatureKey): boolean => FEATURES_V1[k] === true;
