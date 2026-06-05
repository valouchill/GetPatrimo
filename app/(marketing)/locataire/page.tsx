import type { Metadata } from 'next';
import LocataireGatewayClient from './LocataireGatewayClient';

/**
 * Page passerelle Espace Locataire (/locataire).
 *
 * Composant serveur : métadonnées SEO puis délègue l'UI interactive
 * (saisie du code d'accès) au composant client.
 */
export const metadata: Metadata = {
  title: 'Espace Locataire — Maison Patrimo',
  description:
    'Rejoignez une annonce avec votre code d’accès, ou créez votre Passeport Locatif certifié (identité eIDAS + revenus vérifiés par l’IA) pour un dossier inattaquable.',
  alternates: { canonical: '/locataire' },
  openGraph: {
    title: 'Espace Locataire Maison Patrimo',
    description:
      'Déposez vos pièces sur invitation, ou créez un Passeport Locatif certifié pour passer en haut de la pile.',
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Maison Patrimo',
  },
};

export default function LocatairePage() {
  return <LocataireGatewayClient />;
}
