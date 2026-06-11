/**
 * Hook d'instrumentation Next.js (chargé au démarrage du serveur).
 *
 * Requis par @sentry/nextjs v8+ : sans ce fichier, sentry.server.config.ts /
 * sentry.edge.config.ts ne sont JAMAIS chargés (l'ancien chargement implicite
 * via withSentryConfig a disparu) — le DSN seul ne suffit donc pas.
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Capture les erreurs non interceptées des routes/server components (App Router).
export const onRequestError = Sentry.captureRequestError;
