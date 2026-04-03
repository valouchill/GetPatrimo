'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#1e293b' }}>500</h1>
            <p style={{ marginTop: '1rem', fontSize: '1.25rem', color: '#475569' }}>Une erreur critique est survenue</p>
            <button
              onClick={reset}
              style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', background: '#f97316', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
