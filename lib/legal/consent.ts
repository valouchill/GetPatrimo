/**
 * Consentements légaux — source unique (version + valeurs + liens).
 * Réutilisée côté client (<ConsentCheckboxes>) ET serveur (register, tunnel locataire).
 * Incrémenter CONSENT_VERSION si les CGU/CGV/confidentialité changent matériellement.
 */
export const CONSENT_VERSION = '2026-06-15';

export interface ConsentValues {
  /** CGU + CGV + politique de confidentialité — OBLIGATOIRE. */
  terms: boolean;
  /** Communications commerciales de Maison Patrimo — optionnel. */
  marketing: boolean;
  /** Partage des données à des partenaires à des fins commerciales — optionnel. */
  partner: boolean;
}

export const EMPTY_CONSENT: ConsentValues = {
  terms: false,
  marketing: false,
  partner: false,
};

export const CONSENT_LINKS = {
  cgu: '/terms',
  cgv: '/cgv',
  privacy: '/privacy',
} as const;
