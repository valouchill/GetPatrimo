'use client';

/**
 * <ProClient> — Landing B2B « vendre d'abord ».
 * Grille 99/199/sur devis affichée, AUCUN checkout : le seul CTA est la demande
 * de pilote gratuit (10 dossiers), collectée via WaitlistForm (Lead source
 * 'pilote-b2b'). DA alignée sur la landing B2C (émeraude/or, titres serif).
 * Wording : obligation de moyens — jamais de promesse de solvabilité (CGU/CGV).
 */

import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  Clock3,
  FileSearch,
  Fingerprint,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { WaitlistForm } from '@/app/components/marketing/WaitlistForm';

const BENEFITS = [
  {
    icon: FileSearch,
    title: 'Un rapport d’audit par dossier',
    text: 'Métadonnées, traces d’édition, cohérence des cumuls, recoupement fiscal : chaque candidature reçoit un rapport documenté. Votre diligence vis-à-vis des mandants est tracée, noir sur blanc.',
  },
  {
    icon: Clock3,
    title: '3 minutes au lieu de 30',
    text: 'Vos gestionnaires ne décortiquent plus les bulletins à la main. L’audit tourne automatiquement, votre équipe ne traite que les alertes et la décision.',
  },
  {
    icon: ClipboardCheck,
    title: 'Vos candidats classés, par lot',
    text: 'Score et grade par candidat, comparaison par logement, multi-lots. La short-list se construit toute seule — vous arbitrez, avec des faits.',
  },
];

const STEPS = [
  { n: '1', title: 'Recevez', text: 'Un lien de candidature par lot centralise les dossiers (ou chargez les pièces reçues).' },
  { n: '2', title: 'Auditez', text: 'Chaque dossier passe l’audit forensic : falsifications, cohérence des revenus, taux d’effort.' },
  { n: '3', title: 'Décidez', text: 'Comparaison classée des candidats + rapport par dossier à joindre à votre recommandation.' },
];

const PLANS = [
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

export function ProClient() {
  return (
    <div className="bg-slate-50">
      {/* ===== HERO ===== */}
      <section className="bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-800 px-6 py-20 text-center md:py-28">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Agences · administrateurs de biens · mandataires
          </span>
          <h1 className="mt-5 font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">
            L’audit anti-fraude des dossiers locataires, pour les professionnels
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-emerald-100/90">
            Les faux bulletins de salaire sont devenus indétectables à l’œil — et c’est votre
            responsabilité vis-à-vis des mandants qui est exposée. Maison Patrimo audite chaque
            dossier en 3 minutes et documente votre diligence.
          </p>
          <a
            href="#pilote"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-emerald-950 shadow-lg transition-colors hover:bg-amber-400"
          >
            Demander un pilote gratuit — 10 dossiers
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <p className="mt-3 text-xs text-emerald-200/70">
            Sans engagement · réponse sous 24 h · vos vrais dossiers, nos audits
          </p>
        </div>
      </section>

      {/* ===== BÉNÉFICES ===== */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="rounded-3xl border border-slate-200 bg-white p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-900 text-amber-400">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 font-serif text-xl font-semibold text-emerald-900">{b.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== COMMENT ÇA MARCHE ===== */}
      <section className="border-y border-slate-200 bg-white px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-serif text-3xl font-bold text-emerald-900">
            Trois étapes, zéro changement de vos process
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 font-serif text-lg font-bold text-emerald-950">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== GRILLE B2B (statique — CTA = pilote) ===== */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-serif text-3xl font-bold text-emerald-900">
            Des forfaits pensés pour le volume d’une agence
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
            Offre de lancement — la facturation est activée à l’issue du pilote, jamais avant.
            Dépassement : 2,90 € par audit supplémentaire.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-3xl border bg-white p-7 ${
                  p.highlighted ? 'border-amber-300 shadow-lg' : 'border-slate-200'
                }`}
              >
                {p.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-950">
                    Recommandé
                  </span>
                )}
                <h3 className="font-serif text-xl font-semibold text-emerald-900">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-serif text-3xl font-bold text-emerald-900">{p.price}</span>
                  <span className="text-sm text-slate-500">{p.unit}</span>
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-700">{p.quota}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#pilote"
                  className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    p.highlighted
                      ? 'bg-amber-500 text-emerald-950 hover:bg-amber-400'
                      : 'bg-emerald-900 text-white hover:bg-emerald-800'
                  }`}
                >
                  Commencer par le pilote gratuit
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PILOTE (formulaire) ===== */}
      <section id="pilote" className="border-t border-slate-200 bg-white px-6 py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800 ring-1 ring-emerald-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Pilote gratuit
          </span>
          <h2 className="mt-4 font-serif text-3xl font-bold text-emerald-900">
            Testez sur 10 de vos vrais dossiers
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Laissez votre email professionnel : on vous répond sous 24 h pour lancer le pilote —
            10 audits offerts sur vos dossiers réels, débrief des résultats en 15 minutes, sans
            engagement.
          </p>
          <div className="mx-auto mt-6 max-w-md">
            <WaitlistForm source="pilote-b2b" />
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Vous préférez l’email ?{' '}
            <a href="mailto:contact@maisonpatrimo.com?subject=Pilote%20B2B%20Maison%20Patrimo" className="underline">
              contact@maisonpatrimo.com
            </a>
          </p>
        </div>
      </section>

      {/* ===== RÉASSURANCE ===== */}
      <section className="px-6 py-12">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" /> RGPD · données hébergées en UE</span>
          <span className="inline-flex items-center gap-2"><Fingerprint className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Identité biométrique eIDAS</span>
          <span className="inline-flex items-center gap-2"><ScanSearch className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Forensic documentaire</span>
          <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Pièces chiffrées</span>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-slate-400">
          Maison Patrimo est un outil d’aide à la décision (obligation de moyens) : il détecte les
          incohérences et falsifications documentaires mais ne garantit pas la solvabilité future
          d’un locataire. Voir{' '}
          <Link href="/cgv" className="underline">CGV</Link> et{' '}
          <Link href="/terms" className="underline">CGU</Link>.
        </p>
      </section>
    </div>
  );
}
