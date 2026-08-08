'use client';

/**
 * <ManagementUpsell> — point de vente de l'abonnement « Gestion locative »
 * (4,99 €/mois par logement).
 *
 * Affiché tant que le logement n'est pas abonné. Ne s'affiche pas du tout si
 * l'offre n'est pas encore ouverte à la vente (prix Stripe non configuré) :
 * la route /api/billing/management répond alors 503 et on n'affiche pas un
 * bouton qui ne peut pas aboutir.
 */

import { useState } from 'react';
import { ClipboardCheck, FileSignature, Loader2, Receipt, Sparkles } from 'lucide-react';

const BENEFITS = [
  { Icon: FileSignature, text: 'Bail pré-rempli depuis le dossier vérifié, signé en ligne' },
  { Icon: Receipt, text: 'Quittances envoyées toutes seules, relances automatiques' },
  { Icon: ClipboardCheck, text: 'États des lieux photo, retenues sur dépôt calculées' },
];

export function ManagementUpsell({
  propertyId,
  propertyLabel,
}: {
  propertyId: string;
  propertyLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // L'annuel aligne le prix face à la concurrence (49 €/an) et améliore la
  // rétention. Si le prix Stripe annuel n'existe pas encore, le serveur
  // retombe automatiquement sur le mensuel.
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, billingCycle: cycle }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Souscription impossible.');
      window.location.href = data.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-emerald-50/40 p-5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-950">
        <Sparkles className="h-3 w-3" />
        Gestion locative
      </span>
      <h3 className="mt-3 font-serif text-lg font-bold text-emerald-950">
        Passez du choix du locataire à la gestion du bail
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        {propertyLabel ? <>Pour <strong>{propertyLabel}</strong> : t</> : 'T'}out ce qui suit la
        signature, automatisé — <strong>4,99 € par mois</strong>, sans engagement.
      </p>

      <ul className="mt-4 space-y-2">
        {BENEFITS.map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5 text-sm text-slate-700">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Périodicité de facturation">
        <button
          type="button"
          role="radio"
          aria-checked={cycle === 'monthly'}
          onClick={() => setCycle('monthly')}
          className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
            cycle === 'monthly' ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white'
          }`}
        >
          <span className="block text-sm font-bold text-emerald-950">4,99 €</span>
          <span className="block text-[11px] text-slate-500">par mois</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={cycle === 'yearly'}
          onClick={() => setCycle('yearly')}
          className={`relative rounded-xl border px-3 py-2.5 text-left transition-colors ${
            cycle === 'yearly' ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white'
          }`}
        >
          <span className="absolute -top-2 right-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-950">
            2 mois offerts
          </span>
          <span className="block text-sm font-bold text-emerald-950">49,90 €</span>
          <span className="block text-[11px] text-slate-500">par an</span>
        </button>
      </div>

      <button
        type="button"
        onClick={subscribe}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Activer la gestion — {cycle === 'yearly' ? '49,90 €/an' : '4,99 €/mois'}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        Résiliable en un clic à tout moment · vos crédits d&rsquo;audit ne sont jamais affectés
      </p>
    </div>
  );
}
