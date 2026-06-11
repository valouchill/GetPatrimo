'use client';

/**
 * /contestation — Formulaire de contestation d'une analyse automatisée
 * (art. 22 RGPD — AIPD M11 : réexamen humain tracé).
 * Lié depuis la Politique de Confidentialité (§9) et les CGU (6.2).
 */
import React, { useState } from 'react';
import Link from 'next/link';

export default function ContestationPage() {
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  const [reference, setReference] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 10) {
      setFeedback('Décrivez le problème en quelques phrases (10 caractères minimum).');
      return;
    }
    setState('sending');
    setFeedback('');
    try {
      const res = await fetch('/api/tenant/contest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setReference(String(data.reference || ''));
        setState('done');
      } else {
        setState('error');
        setFeedback(
          res.status === 401
            ? 'Connectez-vous avec le compte utilisé pour votre dossier, puis réessayez.'
            : data.error || 'Une erreur est survenue. Réessayez plus tard.'
        );
      }
    } catch {
      setState('error');
      setFeedback('Une erreur réseau est survenue. Réessayez plus tard.');
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl font-bold text-emerald-900">
        Contester un résultat d&apos;analyse
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        Les analyses produites par Maison Patrimo (cohérence documentaire, Indice de Résilience)
        sont générées en partie par des traitements automatisés et constituent une{' '}
        <strong>aide à la décision</strong> — jamais une décision. Conformément à l&apos;article 22
        du RGPD, vous pouvez demander un <strong>réexamen humain</strong> d&apos;un résultat qui vous
        semble erroné : il sera tracé et traité sous un mois maximum.
      </p>

      {state === 'done' ? (
        <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="font-semibold text-emerald-900">Contestation enregistrée ✓</p>
          <p className="mt-2 text-sm text-emerald-800">
            Référence : <span className="font-mono">{reference}</span>. Un réexamen humain sera
            effectué sous un mois maximum ; vous serez contacté à l&apos;adresse de votre compte.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-emerald-700 underline hover:text-emerald-900">
            Retour à l&apos;accueil
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Décrivez le résultat contesté et pourquoi il vous semble erroné
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              required
              placeholder="Ex. : mon bulletin de salaire de mars a été signalé comme incohérent alors que…"
              className="mt-2 w-full rounded-xl border border-slate-300 p-4 text-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <span className="mt-1 block text-right text-xs text-slate-400">{message.length}/2000</span>
          </label>

          {feedback && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {feedback}
            </p>
          )}

          <button
            type="submit"
            disabled={state === 'sending'}
            className="rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
          >
            {state === 'sending' ? 'Envoi en cours…' : 'Demander un réexamen humain'}
          </button>
          <p className="text-xs text-slate-400">
            Connectez-vous avec le compte utilisé pour votre dossier. Vous pouvez aussi exercer vos
            droits auprès du DPO — voir la{' '}
            <Link href="/privacy" className="underline hover:text-slate-600">
              Politique de Confidentialité
            </Link>
            .
          </p>
        </form>
      )}
    </main>
  );
}
