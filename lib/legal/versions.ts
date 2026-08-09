/**
 * Versions des documents légaux — SOURCE UNIQUE.
 *
 * Chaque page affichait sa propre date, en ordre dispersé (CGV « 3 juillet »,
 * les trois autres « avril »), et ces dates ne bougeaient pas quand le contenu
 * changeait. Or l'utilisateur doit pouvoir savoir QUAND les conditions qu'il a
 * acceptées ont été modifiées — c'est la condition d'opposabilité d'une mise à
 * jour, et le point de départ du délai de contestation.
 *
 * ⚠️ RÈGLE : toute modification de fond d'un de ces documents doit
 * s'accompagner d'une mise à jour de sa date ici.
 */

export interface LegalVersion {
  /** Date d'entrée en vigueur, format ISO (pour le tri et les comparaisons). */
  date: string;
  /** Résumé de ce qui a changé — utile en cas de contestation. */
  summary: string;
}

export const LEGAL_VERSIONS: Record<'cgv' | 'privacy' | 'terms' | 'mentions', LegalVersion> = {
  cgv: {
    date: '2026-08-09',
    summary:
      'Ajout de l’abonnement Gestion locative (art. 2 bis) ; mention de TVA rendue exacte quel que soit le régime ; désignation du médiateur de la consommation.',
  },
  privacy: {
    date: '2026-08-09',
    summary:
      'Base légale de la vérification d’identité corrigée (consentement explicite, art. 9.2.a) ; durée de conservation de l’identité vérifiée précisée (90 jours) ; sous-traitants et hébergeur identifiés.',
  },
  terms: { date: '2026-04-01', summary: 'Version initiale.' },
  mentions: {
    date: '2026-08-09',
    summary: 'Identification de l’hébergeur ; coordonnées de l’éditeur centralisées.',
  },
};

/** Rend une date ISO en français long : « 9 août 2026 ». */
export function formatLegalDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
