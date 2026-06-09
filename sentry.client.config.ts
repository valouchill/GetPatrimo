import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sample 100% of errors, 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Sécurité (revue V1 — S21) : pas de PII par défaut + scrub cookies/auth.
  sendDefaultPii: false,
  beforeSend: scrubSentryEvent,

  // Disable in development unless DSN explicitly set
  debug: false,
});
