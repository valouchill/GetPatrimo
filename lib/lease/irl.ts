/**
 * Indice de Référence des Loyers (IRL) — série INSEE n° 001515333.
 *
 * Personne ne connaît l'IRL par cœur : chaque bailleur devait le chercher sur
 * Google avant de remplir la clause de révision. On embarque les derniers
 * indices publiés (France métropolitaine) et le wizard pré-remplit le dernier.
 *
 * ⚠ MAINTENANCE : ajouter le nouvel indice à chaque publication trimestrielle
 * (~mi-janvier, mi-avril, mi-juillet, mi-octobre) — source unique :
 * https://www.insee.fr/fr/statistiques/serie/001515333
 * Le pré-remplissage se DÉSACTIVE tout seul si la table devient trop vieille
 * (> 240 jours) : mieux vaut un champ vide qu'un indice périmé sur un bail.
 */

export interface IrlIndex {
  /** Libellé du trimestre, tel qu'attendu dans la clause du bail. */
  quarter: string;
  /** Valeur de l'indice, format français (l'INSEE publie avec virgule). */
  value: string;
  /** Date de publication INSEE (JO), ISO. */
  publishedAt: string;
}

/** Du plus récent au plus ancien — valeurs vérifiées sur insee.fr. */
export const IRL_INDICES: IrlIndex[] = [
  { quarter: '2e trimestre 2026', value: '148,37', publishedAt: '2026-07-12' },
  { quarter: '1er trimestre 2026', value: '146,60', publishedAt: '2026-04-15' },
  { quarter: '1er trimestre 2025', value: '145,47', publishedAt: '2025-04-15' },
];

/** Fenêtre de fraîcheur : 2 trimestres + marge. Au-delà, on ne pré-remplit plus. */
const MAX_AGE_DAYS = 240;

/** Dernier IRL publié, ou null si la table n'a pas été maintenue à jour. */
export function getLatestIrl(now: Date = new Date()): IrlIndex | null {
  const latest = IRL_INDICES[0];
  if (!latest) return null;
  const ageDays = (now.getTime() - new Date(latest.publishedAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays <= MAX_AGE_DAYS ? latest : null;
}

/** Simulateur officiel « ma commune est-elle en zone tendue ? ». */
export const ZONE_TENDUE_SIMULATOR_URL =
  'https://www.service-public.fr/simulateur/calcul/zones-tendues';
