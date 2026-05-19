/**
 * Marketing copy centralisée pour le Passeport Locatif PDF.
 *
 * Ce fichier rassemble toutes les chaînes marketing utilisées dans le PDF
 * (`/opt/doc2loc/app/components/PassportPDF.tsx`) pour faciliter l'A/B testing
 * et garantir une cohérence éditoriale.
 *
 * Audience cible : propriétaires prospects (non-clients) qui reçoivent le PDF
 * d'un candidat. L'objectif est de leur donner envie de centraliser TOUS leurs
 * dossiers via la plateforme PatrimoTrust pour la tranquillité (anti-fraude)
 * et la qualité (ne pas passer à côté du meilleur dossier).
 */

export const MARKETING = {
  /** Eyebrow page 1 — petite mention au-dessus du nom */
  eyebrow: 'Passeport Locatif certifié',

  /** Tagline page 1 — phrase d'accroche en bas du hero sombre */
  heroTagline: 'Dossier audité, vérifié, scellé.',

  /** Sous-titre marque page 1 (en haut à gauche) */
  brandTagline: 'La banque privée de l\'immobilier',

  /** 3 piliers de différenciation (page 2) */
  pillars: [
    {
      id: 'forensic',
      title: 'Audit Forensic IA',
      body: 'Chaque pièce analysée par notre IA pour détecter falsifications, incohérences et doublons. Plus de faux bulletins de salaire ni d\'avis d\'imposition modifiés.',
    },
    {
      id: 'didit',
      title: 'Identité biométrique',
      body: 'Vérification gouvernementale via Didit : lecture MRZ + selfie liveness + reconnaissance faciale. Plus solide qu\'un simple RIB ou une copie de pièce.',
    },
    {
      id: 'resilience',
      title: 'Indice de Résilience',
      body: 'Score 0–100 qui agrège revenus, stabilité, garantie et historique documentaire. Comparable d\'un dossier à l\'autre, transparent dans son calcul.',
    },
  ],

  /** Section CTA owner (page 4) */
  ownerCta: {
    eyebrow: 'Vous êtes propriétaire ?',
    title: 'Recevez vos candidatures déjà auditées.',
    body: 'Plus de dossiers incomplets. Plus de pièces à vérifier manuellement. Vos candidats passent par PatrimoTrust avant d\'arriver sur votre bureau — vous ne consultez que les profils déjà notés, certifiés et scellés.',
    primary: 'Créer mon Coffre-Fort gratuit',
    secondary: 'Vérifier ce passeport en ligne',
    subline: 'Gratuit · sans carte bancaire · 2 minutes',
  },

  /** Section "Pourquoi ce passeport est différent" (page 2 — header) */
  reassuranceHeader: 'Pourquoi ce passeport est différent',

  /** Section "Les 4 piliers du dossier" (page 2 — header) */
  pillarsHeader: 'Les 4 piliers du dossier',

  /** Encadré verdict (page 2) */
  verdictHeader: 'Verdict pour le propriétaire',

  /** Section "Profil financier & garantie" (page 3) */
  financeHeader: 'Profil financier & garantie',

  /** Section "Certifications documentaires" (page 3) */
  documentsHeader: 'Certifications documentaires',

  /** Section "Journal d\'audit" (page 3) */
  timelineHeader: 'Journal d\'audit',

  /** Trust row footer page 4 */
  trust: [
    'Identité Didit certifiée',
    'Audit Forensic IA',
    'RGPD compliant',
  ],

  /** Mentions légales footer */
  legal: 'Document de synthèse — ne contient aucune pièce brute. Toute modification documentaire ou nouvelle analyse peut faire évoluer son état.',

  /** Domaine officiel */
  domain: 'doc2loc.com',
} as const;

/** Liens hardcodés (URLs construites côté serveur via viewModel.marketing) */
export const PASSPORT_LINKS = {
  /** Catch-all home si l'URL spécifique n'est pas disponible */
  homepage: 'https://doc2loc.com',
} as const;

export type PassportMarketingCopy = typeof MARKETING;
