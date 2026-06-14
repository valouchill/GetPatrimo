import type { MetadataRoute } from 'next';

/**
 * Manifest PWA — rend l'app installable (« Ajouter à l'écran d'accueil »).
 * Servi par Next à /manifest.webmanifest (le lien <link rel="manifest"> est
 * injecté automatiquement par la convention de fichier metadata).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Maison Patrimo',
    short_name: 'Patrimo',
    description: 'Gestion locative sécurisée par IA — dossiers locataires certifiés.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'fr',
    dir: 'ltr',
    background_color: '#F8FAFC',
    theme_color: '#064E3B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
