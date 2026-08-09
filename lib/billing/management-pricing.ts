/**
 * Tarification de l'abonnement « Sérénité » — SOURCE UNIQUE.
 *
 * Un seul abonnement récurrent, par logement, couvrant TOUT l'après-signature :
 * bail, signature électronique, quittances, relances, états des lieux, stockage.
 *
 * Pourquoi pas des add-ons par module (contrat / signature / EDL vendus
 * séparément) : chaque option supplémentaire est une décision d'achat de plus,
 * donc une occasion de renoncer. Sur un produit à quelques euros par mois, le
 * coût mental du choix dépasse largement l'écart de prix — et aucun acteur du
 * marché français ne procède ainsi (Rentila, BailFacile, Smartloc, Qalimo
 * vendent tous du tout-inclus).
 *
 * Positionnement (relevé août 2026) :
 *   Rentila     49 €/an (2-5 biens)   ·  BailFacile 9,99 €/mois/bien (annuel)
 *   Smartloc    6,50 €/mois (annuel)  ·  Qalimo     49 €/an + signature 2,90 €
 * Nous sommes donc moins chers que BailFacile et alignés sur Smartloc, avec un
 * différenciateur qu'aucun d'eux n'a : l'audit anti-fraude des dossiers.
 */

export type BillingCycle = 'monthly' | 'yearly';

/** À partir de ce rang de logement, le tarif dégressif s'applique. */
export const VOLUME_THRESHOLD = 3;

/** Prix TTC en euros, par logement et par période. */
export const MANAGEMENT_PRICES = {
  monthly: { standard: 4.99, volume: 3.49 },
  yearly: { standard: 49.9, volume: 34.9 },
} as const;

/**
 * Clés d'environnement des prix Stripe correspondants.
 * ⚠️ Les quatre prix doivent exister dans Stripe pour que l'offre soit vendable ;
 * sans le prix standard mensuel, la souscription est désactivée partout.
 */
export const MANAGEMENT_PRICE_ENV_KEYS = {
  monthly: { standard: 'PRICE_ID_MANAGEMENT_MONTHLY', volume: 'PRICE_ID_MANAGEMENT_MONTHLY_VOLUME' },
  yearly: { standard: 'PRICE_ID_MANAGEMENT_YEARLY', volume: 'PRICE_ID_MANAGEMENT_YEARLY_VOLUME' },
} as const;

/** Ce que l'abonnement inclut — affiché à l'identique partout (landing, upsell, CGV). */
export const MANAGEMENT_INCLUDES = [
  'Bail pré-rempli depuis le dossier vérifié, signé en ligne (eIDAS)',
  'Quittances envoyées automatiquement et relances d’impayés',
  'États des lieux photo, avec calcul des retenues sur dépôt',
  'Stockage et archivage de tous vos documents de location',
] as const;

/** Le logement à souscrire bénéficie-t-il du tarif dégressif ? */
export function isVolumeRate(activeSubscriptions: number): boolean {
  // `activeSubscriptions` = abonnements DÉJÀ actifs ; le suivant porte le rang N+1.
  return activeSubscriptions + 1 >= VOLUME_THRESHOLD;
}

/** Prix applicable (en euros) pour le prochain logement souscrit. */
export function priceFor(cycle: BillingCycle, activeSubscriptions: number): number {
  return isVolumeRate(activeSubscriptions)
    ? MANAGEMENT_PRICES[cycle].volume
    : MANAGEMENT_PRICES[cycle].standard;
}

/**
 * Identifiant de prix Stripe applicable.
 * Repli sur le tarif standard si le prix dégressif n'est pas configuré : mieux
 * vaut facturer le prix normal que refuser une vente.
 */
export function resolvePriceId(
  cycle: BillingCycle,
  activeSubscriptions: number,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const keys = MANAGEMENT_PRICE_ENV_KEYS[cycle];
  const standard = env[keys.standard] || null;
  if (!isVolumeRate(activeSubscriptions)) return standard;
  return env[keys.volume] || standard;
}

/** Économie annuelle de la formule annuelle (2 mois offerts). */
export function yearlySavings(activeSubscriptions: number): number {
  const monthly = priceFor('monthly', activeSubscriptions) * 12;
  const yearly = priceFor('yearly', activeSubscriptions);
  return Math.round((monthly - yearly) * 100) / 100;
}

/** Format français d'un montant (2 décimales, virgule). */
export function formatEuro(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}
