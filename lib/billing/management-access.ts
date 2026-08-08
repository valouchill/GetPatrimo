/**
 * Accès aux modules « Gestion locative » (bail, loyers, quittances, EDL).
 *
 * Règle unique, utilisée par les routes et l'UI :
 *  - tant que l'offre n'est PAS ouverte à la vente (prix Stripe non configuré),
 *    les modules restent accessibles à tous — on ne bloque pas un produit qu'on
 *    ne sait pas encore vendre ;
 *  - dès que `PRICE_ID_MANAGEMENT_MONTHLY` existe, l'accès exige un abonnement
 *    actif sur le logement concerné.
 *
 * Ce basculement automatique évite d'oublier d'activer la facturation le jour
 * où le prix est créé côté Stripe.
 */

export interface ManagementFlags {
  active?: boolean;
  subscriptionId?: string;
  since?: Date | null;
  canceledAt?: Date | null;
}

/** L'offre est-elle commercialisée (prix Stripe configuré) ? */
export function isManagementOfferLive(): boolean {
  return Boolean(process.env.PRICE_ID_MANAGEMENT_MONTHLY);
}

/** Le logement donne-t-il accès aux modules de gestion ? */
export function hasManagementAccess(property?: { management?: ManagementFlags } | null): boolean {
  if (!isManagementOfferLive()) return true; // offre pas encore ouverte
  return Boolean(property?.management?.active);
}

/** Message d'upsell homogène (routes API + UI). */
export const MANAGEMENT_UPSELL_MESSAGE =
  "Ce module fait partie de l'offre Gestion locative (4,99 €/mois par logement) : bail signé en ligne, quittances et relances automatiques, états des lieux.";
