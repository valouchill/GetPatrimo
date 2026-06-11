/**
 * Init Sentry côté navigateur (convention Next 15.3+ / @sentry/nextjs v9+).
 * Réutilise la config existante — l'import est idempotent (cache ESM), donc
 * sans conflit si le bundler charge aussi sentry.client.config par lui-même.
 */
import * as Sentry from '@sentry/nextjs';
import './sentry.client.config';

// Requis par le SDK v10 pour instrumenter les navigations App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
