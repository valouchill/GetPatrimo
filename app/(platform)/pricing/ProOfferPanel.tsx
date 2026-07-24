import Link from 'next/link';
import { Building2, Check, Mail, ShieldCheck } from 'lucide-react';

/**
 * <ProOfferPanel> — la vue « Mon offre Pro » des comptes B2B (accountType=B2B).
 * Remplace TOUTE surface de prix B2C pour ces comptes : onglet du dashboard
 * (OwnerDashboardClient, page 'tarifs') ET /pricing en accès direct.
 *
 * AUCUN checkout : la vente B2B est consultative (Payment Link dégainé en call)
 * — le CTA est un contact direct. Composant sans hook ni code serveur : rendu
 * indifféremment côté server (/pricing) et client (dashboard).
 */

const B2B_PLANS = [
  {
    name: 'Pro Starter',
    price: '99 €',
    unit: '/ mois',
    quota: '50 audits forensic / mois',
    features: ['Lots illimités', 'Rapports d’audit par dossier', 'Comparaison des candidats', 'Support email'],
    highlighted: false,
  },
  {
    name: 'Pro Agence',
    price: '199 €',
    unit: '/ mois',
    quota: '120 audits forensic / mois',
    features: ['Tout Pro Starter', 'Multi-utilisateurs', 'Support prioritaire', 'Accompagnement à la mise en place'],
    highlighted: true,
  },
  {
    name: 'Réseau & marque blanche',
    price: 'Sur devis',
    unit: '',
    quota: 'Volume, API, rapports à votre marque',
    features: ['Intégration à vos process', 'Rapports en marque blanche', 'Interlocuteur dédié'],
    highlighted: false,
  },
];

export interface ProOfferPanelProps {
  /** Somme des quotas d'audits sur les lots du compte (affiché si fourni). */
  quotaTotal?: number;
  /** Somme des audits consommés. */
  consumed?: number;
}

export function ProOfferPanel({ quotaTotal, consumed }: ProOfferPanelProps) {
  const hasUsage = typeof quotaTotal === 'number' && quotaTotal > 0;
  const remaining = hasUsage ? Math.max(0, quotaTotal - (consumed || 0)) : 0;
  const exhausted = hasUsage && remaining === 0;

  return (
    <div className="mx-auto max-w-5xl">
      {/* En-tête compte Pro */}
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          Compte professionnel
        </span>
        <h2 className="mt-4 font-serif text-3xl font-bold text-emerald-950">Mon offre Pro</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Votre compte bénéficie des conditions professionnelles — les offres grand public ne
          s&rsquo;appliquent pas à votre usage.
        </p>
      </div>

      {/* Forfait en cours */}
      {hasUsage && (
        <div
          className={`mx-auto mt-6 flex max-w-md items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
            exhausted ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50/60'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Audits sur vos lots
            </p>
            <p className="mt-0.5 font-serif text-2xl font-bold tabular-nums text-emerald-950">
              {consumed || 0}
              <span className="text-base font-semibold text-slate-400"> / {quotaTotal}</span>
            </p>
          </div>
          <p className={`text-xs font-semibold ${exhausted ? 'text-amber-700' : 'text-emerald-700'}`}>
            {exhausted
              ? 'Forfait épuisé — contactez-nous pour l’étendre'
              : `${remaining} audit${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* Grille B2B (informative — pas de checkout) */}
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {B2B_PLANS.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col rounded-3xl border bg-white p-6 ${
              p.highlighted ? 'border-amber-300 shadow-lg' : 'border-slate-200'
            }`}
          >
            {p.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-950">
                Recommandé
              </span>
            )}
            <h3 className="font-serif text-lg font-semibold text-emerald-900">{p.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-serif text-2xl font-bold text-emerald-900">{p.price}</span>
              <span className="text-sm text-slate-500">{p.unit}</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">{p.quota}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* CTA contact — la vente B2B reste consultative */}
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-6 py-5 text-center">
        <p className="font-semibold text-emerald-950">
          Étendre votre forfait, changer de formule, ou une question ?
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Réponse sous 24 h — activation immédiate de votre nouveau forfait.
        </p>
        <a
          href="mailto:contact@maisonpatrimo.com?subject=Mon%20forfait%20Pro%20Maison%20Patrimo"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Contacter votre interlocuteur
        </a>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
        <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        RGPD · hébergement UE · rapports d&rsquo;audit conservés ·{' '}
        <Link href="/cgv" className="underline">CGV</Link>
      </p>
    </div>
  );
}
