'use client';

/**
 * <PricingClient> — Tableau tarifaire "Pay-per-Listing" Maison Patrimo.
 *
 * Charte banque privée : émeraude + or, cartes aérées, offre PREMIUM
 * mise en avant. CTAs spécifiques par offre (cf. TIERS[*].cta).
 *
 * - FREE / paid CTA : si un propertyId est passé en query (?property=...),
 *   le clic souscrit cette offre pour ce bien (POST /api/billing/subscribe).
 *   Sinon, redirige vers l'inscription owner.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import {
  TIER_ORDER,
  TIERS,
  formatTierPrice,
  type PropertyTier,
} from '@/lib/billing/tiers';

export function PricingClient(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('property');
  const [busyTier, setBusyTier] = React.useState<PropertyTier | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleCta = React.useCallback(
    async (tier: PropertyTier): Promise<void> => {
      setError(null);
      // FREE → création de lien gratuite (inscription / dashboard)
      if (tier === 'FREE') {
        router.push(propertyId ? '/dashboard/owner' : '/auth/register?role=owner');
        return;
      }
      // Offre payante sans bien ciblé → inscription d'abord
      if (!propertyId) {
        router.push(
          `/auth/register?role=owner&intent=subscribe&tier=${tier}`,
        );
        return;
      }
      // Souscription Stripe pour le bien ciblé
      setBusyTier(tier);
      try {
        const res = await fetch('/api/billing/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, tier }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.url) {
          throw new Error(data?.error || 'Souscription impossible.');
        }
        window.location.href = data.url as string;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue.');
        setBusyTier(null);
      }
    },
    [propertyId, router],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Tarifs · Paiement par logement
          </div>
          <h1 className="font-serif text-3xl leading-tight text-emerald-900 sm:text-5xl">
            Une offre pour chaque bien
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Payez une seule fois par bien mis en location, sans abonnement.
            L&rsquo;analyse IA anti-fraude est incluse selon l&rsquo;offre choisie —
            au-delà du quota, il suffit de{' '}
            <strong className="text-emerald-900">racheter une offre</strong>.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mx-auto mb-8 max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {/* Grille des offres */}
        <div className="grid gap-5 lg:grid-cols-4">
          {TIER_ORDER.map((tierId) => {
            const t = TIERS[tierId];
            const highlighted = t.highlighted;
            const busy = busyTier === tierId;
            return (
              <div
                key={tierId}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
                  highlighted
                    ? 'border-amber-300 ring-2 ring-amber-200'
                    : 'border-slate-200'
                }`}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    Recommandé
                  </div>
                )}

                <div className="mb-1 font-serif text-xl font-semibold text-emerald-900">
                  {t.label}
                </div>
                <p className="mb-4 text-xs text-slate-500">{t.tagline}</p>

                <div className="mb-1 flex items-baseline gap-1">
                  <span className="font-serif text-3xl font-bold text-emerald-900">
                    {formatTierPrice(t.priceEur)}
                  </span>
                  {t.priceEur > 0 && (
                    <span className="text-xs text-slate-500">paiement unique</span>
                  )}
                </div>
                <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {t.quota > 0
                    ? `${t.quota} analyses IA incluses`
                    : 'Aucune analyse IA'}
                </p>

                <ul className="mb-6 flex-1 space-y-2.5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => handleCta(tierId)}
                  disabled={busy}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    highlighted
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : tierId === 'FREE'
                      ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      : 'bg-emerald-900 text-white hover:bg-emerald-800'
                  }`}
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  {busy ? 'Redirection…' : t.cta}
                </button>
              </div>
            );
          })}
        </div>

        {/* Tableau comparatif détaillé */}
        <section className="mt-16">
          <h2 className="mb-6 text-center font-serif text-2xl text-emerald-900">
            Comparatif détaillé
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  <th className="px-5 py-4 text-left font-semibold text-slate-500">
                    Caractéristique
                  </th>
                  {TIER_ORDER.map((tierId) => (
                    <th
                      key={tierId}
                      className="px-5 py-4 text-center font-serif text-base font-semibold text-emerald-900"
                    >
                      {TIERS[tierId].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-5 py-3 text-slate-600">Prix (paiement unique)</td>
                  {TIER_ORDER.map((tierId) => (
                    <td key={tierId} className="px-5 py-3 text-center font-semibold text-slate-900">
                      {formatTierPrice(TIERS[tierId].priceEur)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-5 py-3 text-slate-600">Analyses IA incluses</td>
                  {TIER_ORDER.map((tierId) => (
                    <td key={tierId} className="px-5 py-3 text-center font-semibold text-slate-900">
                      {TIERS[tierId].quota || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-5 py-3 text-slate-600">Au-delà du quota</td>
                  {TIER_ORDER.map((tierId) => (
                    <td key={tierId} className="px-5 py-3 text-center text-slate-700">
                      {TIERS[tierId].quota > 0 ? 'Rachat d’offre' : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-5 py-3 text-slate-600">Trust-List anti-fraude</td>
                  {TIER_ORDER.map((tierId) => (
                    <td key={tierId} className="px-5 py-3 text-center">
                      {tierId === 'FREE' ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <Check className="mx-auto h-4 w-4 text-emerald-600" aria-hidden="true" />
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-5 py-3 text-slate-600">Coffre-fort documentaire</td>
                  {TIER_ORDER.map((tierId) => (
                    <td key={tierId} className="px-5 py-3 text-center">
                      <Check className="mx-auto h-4 w-4 text-emerald-600" aria-hidden="true" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Réassurance */}
        <footer className="mt-12 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Paiement sécurisé Stripe · Résiliable à tout moment ·{' '}
          <Link href="/" className="font-semibold text-emerald-900 hover:underline">
            Retour à l&rsquo;accueil
          </Link>
        </footer>
      </div>
    </div>
  );
}
