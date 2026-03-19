'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function getDefaultCallback(persona: string) {
  if (persona === 'owner') return '/dashboard/owner';
  if (persona === 'guarantor') return '/verify-guarantor/demo';
  return '/dashboard/tenant';
}

export default function E2ESignInClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Connexion de test en cours…");
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function authenticate() {
      const persona = String(searchParams.get('persona') || 'tenant').trim().toLowerCase();
      const email = String(searchParams.get('email') || '').trim().toLowerCase();
      const callbackUrl = String(searchParams.get('callbackUrl') || getDefaultCallback(persona)).trim();

      setStatus(`Connexion E2E ${persona}…`);

      const csrfResponse = await fetch('/api/auth/csrf');
      const csrfPayload = await csrfResponse.json();
      const csrfToken = String(csrfPayload?.csrfToken || '');

      const body = new URLSearchParams({
        csrfToken,
        email,
        persona,
        callbackUrl,
        json: 'true',
      });
      const result = await fetch('/api/auth/callback/e2e-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const payload = await result.json().catch(() => ({}));

      if (!mounted) return;

      if (!result.ok || payload?.error) {
        setError("La connexion E2E a échoué. Vérifiez le seed local et le mode E2E.");
        setStatus('Connexion indisponible');
        return;
      }

      window.location.assign(payload.url || callbackUrl);
    }

    authenticate().catch(() => {
      if (!mounted) return;
      setError("Impossible d'initialiser la connexion E2E.");
      setStatus('Connexion indisponible');
    });

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-slate-50">
      <div className="mx-auto flex max-w-xl flex-col gap-5 rounded-[32px] border border-white/10 bg-white/5 p-10 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
            Doc2Loc E2E
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Authentification locale de test</h1>
          <p className="text-sm text-slate-300">
            Cette page n&apos;est disponible qu&apos;en mode d&apos;audit local.
          </p>
        </div>
        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
          {status}
        </div>
        {error ? (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}
