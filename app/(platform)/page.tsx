import type { Metadata } from 'next';
import LandingClient from './LandingClient';

/**
 * Page d'accueil PatrimoTrust (/) — Landing Page officielle V1.
 *
 * Composant serveur : porte les métadonnées SEO/OpenGraph puis délègue le
 * rendu animé (Framer Motion) au composant client <LandingClient>.
 */
export const metadata: Metadata = {
  title: 'PatrimoTrust — Audit anti-fraude des dossiers locataires par IA',
  description:
    'L’IA de niveau institutionnel qui audite vos dossiers locataires, détecte les falsifications et génère votre bail ALUR en 3 clics. Créez votre lien de candidature gratuit — sans carte bancaire.',
  keywords: [
    'sélection locataire',
    'anti-fraude location',
    'audit dossier locataire',
    'bail ALUR',
    'gestion locative IA',
    'dossier de location',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Ne laissez plus la fraude dicter vos choix locatifs.',
    description:
      'Audit forensic, Indice de Résilience et bail ALUR généré en 3 clics. La nouvelle norme de sélection locative.',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'PatrimoTrust',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PatrimoTrust — La nouvelle norme de sélection locative',
    description:
      'L’IA qui audite vos dossiers locataires et détecte les falsifications. Lien de candidature gratuit.',
  },
};

export default function HomePage() {
  return <LandingClient />;
}
