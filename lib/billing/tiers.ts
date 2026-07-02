/**
 * tiers.ts — Grille tarifaire "Pay-per-Listing" Maison Patrimo.
 *
 * Source unique de vérité (client + serveur, AUCUNE dépendance serveur)
 * pour les offres par bien immobilier. Le suivi de quota se fait au niveau
 * de la Property (cf. models/Property.js : tier, dossiersQuota,
 * dossiersAnalyzedCount).
 *
 * Modèle économique : forfait de base (quota d'analyses IA inclus) +
 * facturation au dépassement (0,49€/dossier) via Stripe Metered Billing.
 *
 * Les Price IDs Stripe sont pilotés par variables d'environnement (les
 * vrais IDs sont créés dans le Dashboard Stripe). Voir docs/BILLING.md.
 */

export type PropertyTier = 'FREE' | 'ESSENTIAL' | 'PREMIUM' | 'MAX';

export interface TierConfig {
  id: PropertyTier;
  /** Nom commercial affiché */
  label: string;
  /** Sous-titre marketing court */
  tagline: string;
  /** Prix mensuel de base en euros (0 pour FREE) */
  priceEur: number;
  /** Nombre d'analyses IA incluses dans le forfait */
  quota: number;
  /** Prix au dépassement par dossier supplémentaire (€) */
  overagePriceEur: number;
  /** Clé d'env du Price ID Stripe (forfait récurrent de base) */
  basePriceEnvKey: string;
  /** Clé d'env du Price ID Stripe (tarif metered au dépassement) */
  meteredPriceEnvKey: string;
  /** Libellé du bouton d'action (CTA) */
  cta: string;
  /** Arguments commerciaux (bullet points) */
  features: string[];
  /** Mise en avant visuelle (offre recommandée) */
  highlighted?: boolean;
}

/** Prix unitaire du dépassement — identique pour toutes les offres payantes. */
export const OVERAGE_PRICE_EUR = 0.49;

export const TIERS: Record<PropertyTier, TierConfig> = {
  FREE: {
    id: 'FREE',
    label: 'Gratuit',
    tagline: 'Recevez et pré-triez tous vos candidats, gratuitement',
    priceEur: 0,
    quota: 0,
    overagePriceEur: 0,
    basePriceEnvKey: '', // pas de prix Stripe
    meteredPriceEnvKey: '',
    cta: 'Créer mon lien gratuit',
    features: [
      'Lien de candidature illimité',
      'Pré-tri automatique : score & grade de chaque candidat',
      'Boîte de réception centralisée',
      '3 analyses forensic offertes (au total)',
    ],
  },
  ESSENTIAL: {
    id: 'ESSENTIAL',
    label: 'Essentiel',
    tagline: 'Débloquez la comparaison de tous vos candidats + 25 audits',
    priceEur: 19.9,
    quota: 25,
    overagePriceEur: OVERAGE_PRICE_EUR,
    basePriceEnvKey: 'PRICE_ID_ESSENTIAL_BASE',
    meteredPriceEnvKey: 'PRICE_ID_ESSENTIAL_METERED',
    cta: 'Comparer mes candidats',
    features: [
      'Comparaison détaillée de tous vos candidats',
      '25 audits forensic anti-fraude',
      'Coordonnées + pièces débloquées',
      'Paiement unique, sans abonnement',
    ],
  },
  PREMIUM: {
    id: 'PREMIUM',
    label: 'Pro',
    tagline: 'Comparez vos candidats + 100 audits forensic',
    priceEur: 39.9,
    quota: 100,
    overagePriceEur: OVERAGE_PRICE_EUR,
    basePriceEnvKey: 'PRICE_ID_PREMIUM_BASE',
    meteredPriceEnvKey: 'PRICE_ID_PREMIUM_METERED',
    cta: 'Comparer mes candidats',
    features: [
      'Comparaison détaillée de tous vos candidats',
      '100 audits forensic anti-fraude',
      'Passeport Locatif PDF premium',
      'Paiement unique, sans abonnement',
    ],
    highlighted: true,
  },
  MAX: {
    id: 'MAX',
    label: 'Pro max',
    tagline: 'Volume & agences — comparaison + 250 audits',
    priceEur: 59.9,
    quota: 250,
    overagePriceEur: OVERAGE_PRICE_EUR,
    basePriceEnvKey: 'PRICE_ID_MAX_BASE',
    meteredPriceEnvKey: 'PRICE_ID_MAX_METERED',
    cta: 'Comparer mes candidats',
    features: [
      'Comparaison détaillée de tous vos candidats',
      '250 audits forensic anti-fraude',
      'Priorité de traitement',
      'Paiement unique, sans abonnement',
    ],
  },
};

/** Ordre d'affichage canonique (gauche → droite sur la page pricing). */
export const TIER_ORDER: PropertyTier[] = ['FREE', 'ESSENTIAL', 'PREMIUM', 'MAX'];

/** Essai gratuit : nb d'analyses IA offertes au niveau du COMPTE (total, pas par bien). */
export const FREE_TRIAL_LIMIT = 3;

/** Type-guard : convertit une valeur inconnue en PropertyTier (défaut FREE). */
export function normalizeTier(value: unknown): PropertyTier {
  const v = String(value || '').toUpperCase();
  if (v === 'ESSENTIAL' || v === 'PREMIUM' || v === 'MAX') return v;
  return 'FREE';
}

/** Quota d'analyses inclus pour un tier donné. */
export function quotaForTier(tier: PropertyTier): number {
  return TIERS[tier].quota;
}

/** True si l'offre est payante (≠ FREE). */
export function isPaidTier(tier: PropertyTier): boolean {
  return tier !== 'FREE';
}

/** Retourne le tier le plus élevé des deux (selon TIER_ORDER) — utilisé au rachat
 *  pour ne jamais faire régresser le niveau d'offre du bien. */
export function higherTier(a: unknown, b: unknown): PropertyTier {
  const ta = normalizeTier(a);
  const tb = normalizeTier(b);
  return TIER_ORDER.indexOf(ta) >= TIER_ORDER.indexOf(tb) ? ta : tb;
}

/** Formate un prix euro à la française (19,90 €). */
export function formatTierPrice(priceEur: number): string {
  if (priceEur === 0) return 'Gratuit';
  return `${priceEur.toFixed(2).replace('.', ',')} €`;
}

/** Objet porteur d'une offre (Property allégée). */
export interface TierBearing {
  tier?: string;
  /** Legacy : bien déjà "premium" via l'ancien flux Stripe (managed). */
  managed?: boolean;
  dossiersQuota?: number;
}

/**
 * Offre EFFECTIVE d'un bien (grandfathering).
 * Les biens déjà `managed` (clients payants de l'ancien système, sans champ
 * `tier`) sont considérés PREMIUM pour ne pas casser leur accès le temps de
 * migrer vers les vraies offres Stripe.
 */
export function effectiveTier(p: TierBearing): PropertyTier {
  const t = normalizeTier(p.tier);
  if (t !== 'FREE') return t;
  if (p.managed === true) return 'PREMIUM'; // grandfather legacy payant
  return 'FREE';
}

/** Quota effectif : valeur DB si > 0, sinon dérivé de l'offre effective. */
export function effectiveQuota(p: TierBearing): number {
  const q = Number(p.dossiersQuota || 0);
  if (q > 0) return q;
  return quotaForTier(effectiveTier(p));
}
