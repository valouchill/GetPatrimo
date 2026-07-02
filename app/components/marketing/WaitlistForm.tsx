'use client';

import * as React from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/app/components/ui';

/**
 * WaitlistForm — collecte d'email pour la liste d'attente « gestion locative ».
 * POST vers l'endpoint Express existant `/api/public/lead` ({ email, source, utm })
 * → réutilise le modèle Lead (aucune nouvelle route Next, pas de piège 504).
 * Honeypot anti-bot + consentement explicite (RGPD).
 */
export function WaitlistForm({
  source = 'waitlist_gestion_locative',
  className = '',
}: {
  source?: string;
  className?: string;
}): React.ReactElement {
  const [email, setEmail] = React.useState('');
  const [company, setCompany] = React.useState(''); // honeypot (doit rester vide)
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (company) return; // bot : honeypot rempli → on ignore silencieusement
    if (!email.includes('@')) {
      setError('Adresse email invalide.');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const utm: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        const sp = new URLSearchParams(window.location.search);
        for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
          const v = sp.get('utm_' + k);
          if (v) utm[k] = v;
        }
      }
      const res = await fetch('/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source, utm }),
      });
      if (!res.ok) throw new Error('http ' + res.status);
      setStatus('done');
    } catch {
      setStatus('error');
      setError('Une erreur est survenue. Réessayez dans un instant.');
    }
  }

  if (status === 'done') {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ${className}`}
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        C&rsquo;est noté ! On vous prévient dès l&rsquo;ouverture de la gestion locative.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={className} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            aria-label="Votre email"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-400"
          />
        </div>
        {/* Honeypot anti-bot — caché aux humains */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />
        <Button type="submit" variant="primary" size="md" loading={status === 'loading'}>
          Rejoindre la waitlist
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <p className="mt-2 text-[11px] text-slate-400">
        En m&rsquo;inscrivant, j&rsquo;accepte d&rsquo;être recontacté à ce sujet.{' '}
        <a href="/privacy" className="underline">
          Confidentialité
        </a>
        .
      </p>
    </form>
  );
}
