'use client';

/**
 * <PricingTiers> — cœur réutilisable du tableau tarifaire "Pay-per-Listing" (one-time).
 *
 * Utilisé par :
 *  - la page publique /pricing (variant="page" : plein écran + footer marketing) ;
 *  - l'onglet « Tarifs & Offres » du dashboard owner (variant="embedded" : dans le shell,
 *    donc avec le menu latéral).
 *
 * Flux d'achat :
 *  - lien in-app `?property=ID` → achat direct ;
 *  - owner connecté : 1 bien = achat direct ; ≥2 = sélecteur ; 0 = invite à créer un bien ;
 *  - déconnecté → inscription owner, retour sur /pricing.
 *
 * Rachat : les crédits restants sont CONSERVÉS et cumulés ; le niveau passe au plus élevé.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Check, Loader2, Plus, ShieldCheck, Sparkles, X } from 'lucide-react';
import {
  TIER_ORDER,
  TIERS,
  formatTierPrice,
  type PropertyTier,
} from '@/lib/billing/tiers';

export type PricingProperty = {
  id: string;
  label: string;
  /** Offre + quota courants (pour afficher « offre actuelle » + le cumul). */
  tier?: 'FREE' | 'ESSENTIAL' | 'PREMIUM' | 'MAX';
  dossiersQuota?: number;
  dossiersAnalyzedCount?: number;
};

export interface PricingTiersProps {
  authenticated?: boolean;
  properties?: PricingProperty[];
  /** "page" = wrapper plein écran + footer ; "embedded" = dans le dashboard. */
  variant?: 'page' | 'embedded';
}

function remainingOf(p: PricingProperty): number {
  return Math.max(0, (p.dossiersQuota ?? 0) - (p.dossiersAnalyzedCount ?? 0));
}

export function PricingTiers({
  authenticated = false,
  properties = [],
  variant = 'page',
}: PricingTiersProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPropertyId = searchParams.get('property');
  const [busyTier, setBusyTier] = React.useState<PropertyTier | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Retour navigateur depuis Stripe via bfcache : la page revit avec l'ancien
  // state → bouton figé sur « Redirection… ». On le réarme.
  React.useEffect(() => {
    const onPageShow = (e: PageTransitionEvent): void => {
      if (e.persisted) {
        setBusyTier(null);
        setError(null);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);
  const [pickerTier, setPickerTier] = React.useState<PropertyTier | null>(null);
  const [needProperty, setNeedProperty] = React.useState(false);

  const paidProps = properties.filter((p) => p.tier && p.tier !== 'FREE');

  const startCheckout = React.useCallback(
    async (propertyId: string, tier: PropertyTier): Promise<void> => {
      setError(null);
      setPickerTier(null);
      setBusyTier(tier);
      try {
        const res = await fetch('/api/billing/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, tier }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.url) {
          throw new Error(data?.error || 'Paiement impossible. Réessayez.');
        }
        window.location.href = data.url as string;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue.');
        setBusyTier(null);
      }
    },
    [],
  );

  const handleCta = React.useCallback(
    (tier: PropertyTier): void => {
      setError(null);
      setNeedProperty(false);

      // Offre gratuite → espace owner (connecté) ou inscription.
      if (tier === 'FREE') {
        router.push(authenticated ? '/dashboard/owner' : '/auth/register?role=owner');
        return;
      }

      // Visiteur déconnecté (ou session expirée) → inscription, puis retour au
      // même contexte d'achat (?property= conservé) — évite un 401 brut au clic.
      if (!authenticated) {
        const back = urlPropertyId ? `/pricing?property=${urlPropertyId}` : '/pricing';
        router.push(`/auth/register?role=owner&callbackUrl=${encodeURIComponent(back)}`);
        return;
      }

      // Lien in-app ciblant déjà un bien → achat direct.
      if (urlPropertyId) {
        void startCheckout(urlPropertyId, tier);
        return;
      }

      // Connecté : choisir le bien à débloquer.
      if (properties.length === 0) {
        setNeedProperty(true);
        return;
      }
      if (properties.length === 1) {
        void startCheckout(properties[0].id, tier);
        return;
      }
      setPickerTier(tier);
    },
    [authenticated, properties, urlPropertyId, router, startCheckout],
  );

  const containerClass =
    variant === 'page'
      ? 'mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16'
      : 'mx-auto max-w-6xl';

  return (
    <div className={variant === 'page' ? 'min-h-screen bg-slate-50' : ''}>
      <div className={containerClass}>
        {/* Header */}
        <header className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Tarifs · Paiement unique par logement
          </div>
          <h1 className="font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-5xl">
            Comparez vos candidats en toute confiance
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Recevez tous vos dossiers gratuitement avec un{' '}
            <strong className="text-emerald-900">pré-tri automatique</strong>. Un{' '}
            <strong className="text-emerald-900">paiement unique par bien — tout compris, sans frais cachés</strong>{' '}
            débloque la comparaison détaillée de tous vos candidats et les audits anti-fraude de votre short-list.
          </p>
        </header>

        {/* Offres en cours (owner connecté ayant déjà souscrit) */}
        {authenticated && paidProps.length > 0 && (
          <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800">
              Vos offres en cours
            </p>
            <ul className="space-y-2.5">
              {paidProps.map((p) => {
                const quota = p.dossiersQuota ?? 0;
                const used = p.dossiersAnalyzedCount ?? 0;
                const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
                const remaining = remainingOf(p);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Building2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                      {p.label}
                    </span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">
                      {TIERS[p.tier as PropertyTier].label}
                    </span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white ring-1 ring-emerald-100">
                      <div
                        className={`h-full rounded-full ${
                          remaining === 0 ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-600">
                      {used}/{quota} · <span className="text-emerald-800">{remaining} restant{remaining > 1 ? 's' : ''}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2.5 text-[11px] text-slate-500">
              Racheter une offre <strong className="text-slate-700">cumule</strong> les crédits :
              vos crédits restants sont conservés et le niveau passe au plus élevé.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-auto mb-8 max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {needProperty && (
          <div className="mx-auto mb-8 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-amber-900">
              Ajoutez d’abord un bien à votre espace
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Les offres s’achètent pour un logement précis. Créez votre bien, puis revenez
              choisir une offre.
            </p>
            <Link
              href="/dashboard/owner"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Ajouter un bien
            </Link>
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
                    <span className="text-xs text-slate-500">paiement unique · tout compris</span>
                  )}
                </div>
                {t.priceEur > 0 && t.quota > 0 && (
                  <p className="text-[11px] text-slate-400">
                    soit {(t.priceEur / t.quota).toFixed(2).replace('.', ',')} € par audit
                  </p>
                )}
                <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {tierId === 'FREE'
                    ? 'Pré-tri gratuit + 1 audit forensic offert'
                    : t.quota > 0
                    ? `Comparaison de tous + ${t.quota} audits forensic`
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

                {tierId === 'FREE' && authenticated ? (
                  <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Votre offre de départ — active
                  </div>
                ) : (
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
                )}
              </div>
            );
          })}
        </div>

        {/* Réassurance — affichée aussi en embedded (dashboard) : c'est au moment
            du clic d'achat qu'elle compte le plus. */}
        <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Paiement unique sécurisé par Stripe · Sans abonnement · Crédits cumulés, jamais perdus
          {variant === 'page' && (
            <>
              {' · '}
              <Link href="/" className="font-semibold text-emerald-900 hover:underline">
                Retour à l’accueil
              </Link>
            </>
          )}
        </footer>
      </div>

      {/* Sélecteur de bien (owner avec plusieurs biens) */}
      {pickerTier && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choisir un bien"
          onClick={() => setPickerTier(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-emerald-900">
                Pour quel bien ?
              </h3>
              <button
                type="button"
                onClick={() => setPickerTier(null)}
                aria-label="Fermer"
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Offre <strong className="text-emerald-900">{TIERS[pickerTier].label}</strong> —{' '}
              {formatTierPrice(TIERS[pickerTier].priceEur)}, paiement unique. Les crédits restants
              du bien sont conservés et cumulés.
            </p>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {properties.map((p) => {
                const curTier = p.tier && p.tier !== 'FREE' ? p.tier : null;
                const remaining = remainingOf(p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => startCheckout(p.id, pickerTier)}
                      disabled={busyTier !== null}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">
                        {p.label}
                        {curTier && (
                          <span className="block text-[11px] font-normal text-slate-500">
                            Offre actuelle : {TIERS[curTier].label} · {remaining} crédit{remaining > 1 ? 's' : ''} restant{remaining > 1 ? 's' : ''} → conservés
                          </span>
                        )}
                      </span>
                      {busyTier !== null ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/dashboard/owner"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Ajouter un nouveau bien
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
