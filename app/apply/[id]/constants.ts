import type { CertificationItem } from './types';

// --- Configuration de la Checklist de Certification ---

export const CERTIFICATION_ITEMS: Record<string, CertificationItem[]> = {
  identite: [
    { id: 'cni', category: 'Identité', label: 'CNI / Passeport', description: 'Document officiel en cours de validité.', keywords: ['cni', 'carte', 'identite', 'passeport', 'id'], required: true },
    { id: 'photo_profil', category: 'Identité', label: 'Photo de profil professionnelle', description: 'Renforce la confiance du propriétaire.', keywords: ['photo', 'profil', 'portrait', 'selfie'], required: false }
  ],
  domicile: [
    { id: 'domicile', category: 'Domicile', label: 'Justificatif de domicile', description: 'Facture ou quittance de moins de 3 mois.', keywords: ['domicile', 'facture', 'edf', 'engie', 'totalenergies', 'gdf', 'gaz', 'electricite', 'energie', 'eau', 'internet', 'telephone', 'orange', 'sfr', 'free', 'bouygues', 'quittance', 'assurance habitation', 'habitation', 'echeance'], required: true },
    { id: 'quittance', category: 'Domicile', label: 'Quittance de loyer', description: 'Prouve que vous êtes un locataire exemplaire.', keywords: ['quittance', 'loyer'], required: false }
  ],
  activite: [
    { id: 'scolarite', category: 'Activité', label: 'Certificat de scolarité', description: 'Année en cours.', keywords: ['scolarite', 'certificat', 'etudiant', 'inscription', 'universite'], required: false },
    { id: 'attestation_employeur', category: 'Activité', label: 'Attestation employeur (< 1 mois)', description: 'Garantit votre situation réelle au-delà du contrat.', keywords: ['attestation employeur', 'employeur', 'attestation', 'certificat employeur'], required: false },
    { id: 'contrat', category: 'Activité', label: 'Contrat de travail', description: 'CDI/CDD ou promesse d\'embauche.', keywords: ['contrat', 'travail', 'cdi', 'cdd', 'emploi', 'promesse'], required: false },
    { id: 'attestation_urssaf', category: 'Activité', label: 'Attestation URSSAF', description: 'Situation à jour.', keywords: ['urssaf', 'attestation urssaf'], required: false },
    { id: 'bilan_n1', category: 'Activité', label: 'Bilan N-1', description: 'Dernier exercice.', keywords: ['bilan', 'liasse', 'bilan n-1', 'bilan n1'], required: false },
    { id: 'bilan_n2', category: 'Activité', label: 'Bilan N-2', description: 'Avant-dernier exercice.', keywords: ['bilan', 'liasse', 'bilan n-2', 'bilan n2'], required: false },
    { id: 'kbis', category: 'Activité', label: 'Extrait Kbis / INSEE', description: 'Identification de l\'entreprise.', keywords: ['kbis', 'insee', 'siren', 'siret'], required: false }
  ],
  ressources: [
    { id: 'salaire', category: 'Ressources', label: 'Bulletins de salaire', description: '3 derniers mois.', keywords: ['salaire', 'bulletin', 'fiche', 'paie'], required: false },
    { id: 'avis_imposition', category: 'Ressources', label: 'Avis d\'imposition', description: 'Confirme la cohérence de vos revenus annuels.', keywords: ['avis d\'imposition', 'imposition', 'impot', 'rfr', 'revenu fiscal'], required: false },
    { id: 'bourse', category: 'Ressources', label: 'Avis de bourse', description: 'Notification CROUS.', keywords: ['bourse', 'crous', 'attribution'], required: false },
    { id: 'caf', category: 'Ressources', label: 'Simulation CAF/APL', description: 'Attestation.', keywords: ['caf', 'apl', 'als', 'aide', 'logement'], required: false },
    { id: 'pension', category: 'Ressources', label: 'Justificatif de pension', description: 'Alimentaire.', keywords: ['pension', 'alimentaire'], required: false },
    { id: 'visale', category: 'Ressources', label: 'Certificat Visale', description: 'Garantie gratuite de l\'État.', keywords: ['visale'], required: false }
  ],
  garantie: [
    { id: 'garant_id', category: 'Garantie', label: 'ID du garant', description: 'CNI ou Passeport', keywords: ['garant', 'identite', 'parent'], required: false },
    { id: 'garant_domicile', category: 'Garantie', label: 'Justificatif domicile', description: 'Moins de 3 mois', keywords: ['domicile', 'facture', 'edf', 'engie', 'gaz', 'eau', 'internet', 'telephone', 'orange', 'sfr', 'free', 'bouygues', 'quittance', 'assurance habitation', 'habitation', 'echeance'], required: false },
    { id: 'garant_salaires', category: 'Garantie', label: 'Salaires du garant', description: '3 derniers bulletins', keywords: ['garant', 'salaire', 'bulletin'], required: false }
  ],
  engagement: [
    { id: 'motivation', category: 'Engagement', label: 'Lettre de motivation', description: 'Personnalisée', keywords: ['motivation', 'lettre'], required: false }
  ]
};

// Aplatir tous les items pour la détection
export const ALL_CERTIFICATION_ITEMS: CertificationItem[] = Object.values(CERTIFICATION_ITEMS).flat();

// Messages de recommandation IA
export const AI_MESSAGES: Record<string, string> = {
  bourse: "L'IA PatrimoTrust™ suggère d'ajouter votre avis d'attribution de bourse pour maximiser la confiance du propriétaire.",
  caf: "Une simulation CAF/APL renforce significativement la crédibilité de votre dossier auprès des bailleurs.",
  avis_imposition: "L'avis d'imposition confirme la cohérence de vos revenus annuels.",
  attestation_employeur: "L'attestation employeur (< 1 mois) est un critère clé pour sécuriser votre dossier.",
  domicile: "Un justificatif de domicile récent renforce la conformité administrative de votre dossier.",
  attestation_urssaf: "L'attestation URSSAF prouve la régularité de votre activité.",
  bilan_n1: "Deux bilans récents ou une attestation URSSAF renforcent la transparence financière.",
  garant_salaires: "Les justificatifs de revenus du garant sont essentiels pour une certification complète.",
  motivation: "Une lettre de motivation personnalisée fait la différence et démontre votre sérieux.",
  default: "Chaque document ajouté renforce votre Score de Confiance PatrimoTrust™."
};

// --- Documents requis selon profil ---

interface ProfileBoostItem {
  id: string;
  label: string;
  points: number;
  icon: string;
}

interface ProfileDocs {
  required: string[];
  optional: string[];
  boost: ProfileBoostItem[];
}

export const REQUIRED_DOCS_BY_PROFILE: Record<string, ProfileDocs> = {
  Etudiant: {
    required: ['cni', 'scolarite', 'domicile'],
    optional: ['bourse', 'caf', 'avis_imposition', 'pension'],
    boost: [
      { id: 'quittance', label: 'Dernière quittance de loyer', points: 10, icon: '🏠' },
      { id: 'photo_profil', label: 'Photo de profil professionnelle', points: 5, icon: '📸' },
    ]
  },
  Salarie: {
    required: ['cni', 'attestation_employeur', 'salaire', 'avis_imposition', 'domicile'],
    optional: ['contrat'],
    boost: [
      { id: 'quittance', label: 'Dernière quittance de loyer', points: 10, icon: '🏠' },
      { id: 'photo_profil', label: 'Photo de profil professionnelle', points: 5, icon: '📸' },
    ]
  },
  Independant: {
    required: ['cni', 'avis_imposition', 'bilan_n1', 'bilan_n2', 'attestation_urssaf', 'domicile'],
    optional: ['kbis'],
    boost: [
      { id: 'quittance', label: 'Dernière quittance de loyer', points: 10, icon: '🏠' },
      { id: 'photo_profil', label: 'Photo de profil professionnelle', points: 5, icon: '📸' },
    ]
  },
  Retraite: {
    required: ['cni', 'pension', 'avis_imposition', 'domicile'],
    optional: [],
    boost: [
      { id: 'quittance', label: 'Dernière quittance de loyer', points: 10, icon: '🏠' },
      { id: 'photo_profil', label: 'Photo de profil professionnelle', points: 5, icon: '📸' },
    ]
  },
};
