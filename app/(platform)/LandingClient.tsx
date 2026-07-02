'use client';

/**
 * <LandingClient> — Landing Page officielle Maison Patrimo (V1).
 *
 * Objectif CRO : maximiser les inscriptions (création de lien gratuit).
 * Direction artistique : « Banque Privée de l'immobilier » — fonds clairs,
 * Émeraude profond pour l'autorité, Or brossé pour les accents, titres serif
 * (Playfair Display), micro-animations Framer Motion sobres (fade-in-up).
 *
 * La Navbar est rendue séparément par <LandingHeader> (via ConditionalHeader).
 * Cette page contient : Hero · Réassurance · 3 Piliers · Tarifs · CTA · Footer.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  Sparkles,
  ShieldCheck,
  ScanSearch,
  FileSignature,
  Crown,
  ArrowRight,
  Check,
  Lock,
  Fingerprint,
  BadgeCheck,
  Stamp,
  AlertTriangle,
  FileText,
  CreditCard,
  Building2,
  Eye,
} from 'lucide-react';
import IdealTenantSimulator from '@/app/components/marketing/IdealTenantSimulator';
import { WaitlistForm } from '@/app/components/marketing/WaitlistForm';
import { isEnabled } from '@/lib/features';

/* ──────────────────────────────────────────────────────────────
 * Animation helper : fade-in-up au scroll (sobre, élégant)
 * ────────────────────────────────────────────────────────────── */
function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Données
 * ────────────────────────────────────────────────────────────── */
const STANDARDS = [
  { label: 'eIDAS', sub: 'Biométrie', icon: Fingerprint },
  { label: 'Certification DGFIP', sub: 'Revenus vérifiés', icon: BadgeCheck },
  { label: 'Norme ALUR', sub: 'Bail conforme', icon: FileText },
  { label: 'OCR Anti-Fraude', sub: 'Détection retouche', icon: ScanSearch },
];

const RESILIENCE_TIERS = [
  {
    label: 'PLATINUM',
    range: '90 – 100',
    desc: "Dossier d'exception — validation rapide possible.",
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    soft: 'bg-emerald-50',
    width: 'w-full',
  },
  {
    label: 'GOLD',
    range: '75 – 89',
    desc: 'Dossier solide — revue manuelle recommandée.',
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    soft: 'bg-amber-50',
    width: 'w-4/5',
  },
  {
    label: 'SILVER',
    range: '50 – 74',
    desc: 'Dossier acceptable — vérifications complémentaires.',
    dot: 'bg-slate-400',
    bar: 'bg-slate-400',
    text: 'text-slate-600',
    ring: 'ring-slate-200',
    soft: 'bg-slate-50',
    width: 'w-3/5',
  },
  {
    label: 'ALERTE',
    range: '0 – 49',
    desc: 'Dossier à écarter — alertes critiques détectées.',
    dot: 'bg-red-500',
    bar: 'bg-red-500',
    text: 'text-red-600',
    ring: 'ring-red-200',
    soft: 'bg-red-50',
    width: 'w-1/3',
  },
];

const PRICING = [
  {
    name: 'Gratuit',
    price: '0',
    unit: '€',
    tagline: 'Recevez et pré-triez tous vos candidats, gratuitement.',
    features: [
      'Boîte de réception centralisée',
      'Pré-tri automatique : score & grade',
      '3 audits forensic offerts (au total)',
      'Stockage chiffré · conforme RGPD',
    ],
    cta: 'Créer mon lien gratuit',
    href: '/auth/register',
    highlight: false,
  },
  {
    name: 'Essentiel',
    price: '19,90',
    unit: '€ / logement',
    tagline: 'Vérifiez votre finaliste — jusqu’à 3 candidats audités.',
    features: [
      'Comparaison détaillée de tous vos candidats',
      '3 audits forensic par logement',
      'Détection de falsification',
      'Indice de Résilience institutionnel',
    ],
    cta: 'Choisir Essentiel',
    href: '/pricing',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '39,90',
    unit: '€ / logement',
    tagline: 'Comparez votre short-list — jusqu’à 10 candidats audités.',
    features: [
      'Tout le plan Essentiel',
      '10 audits forensic par l’IA',
      'Shortlist automatique des dossiers',
      'Passeport Locatif PDF premium',
    ],
    cta: 'Choisir Pro',
    href: '/pricing',
    highlight: true,
    badge: 'Recommandé',
  },
  {
    name: 'Pro max',
    price: '59,90',
    unit: '€ / logement',
    tagline: 'Zones tendues & relocations — jusqu’à 20 candidats audités.',
    features: [
      'Tout le plan Pro',
      '20 audits forensic par l’IA',
      'Idéal forte demande locative',
      'Support prioritaire',
    ],
    cta: 'Choisir Max',
    href: '/pricing',
    highlight: false,
  },
];

/* ──────────────────────────────────────────────────────────────
 * Visuels stylisés (mockups — aucune image externe)
 * ────────────────────────────────────────────────────────────── */

/** Mockup “Dashboard” du Hero : candidat PLATINUM + zéro retouche. */
function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      {/* Carte principale */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(6,78,59,0.30)]">
        {/* Barre fenêtre */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
          <span className="h-3 w-3 rounded-full bg-red-300" />
          <span className="h-3 w-3 rounded-full bg-amber-300" />
          <span className="h-3 w-3 rounded-full bg-emerald-300" />
          <span className="ml-3 text-xs font-medium text-slate-400">
            maisonpatrimo.com · tableau de bord
          </span>
        </div>

        {/* Corps */}
        <div className="space-y-5 p-6 sm:p-7">
          {/* Ligne candidat */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-base font-semibold text-white">
                CD
              </div>
              <div>
                <p className="font-serif text-lg font-semibold text-slate-900">
                  Camille Durand
                </p>
                <p className="text-xs text-slate-500">Cadre · CDI · Garant Visale</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
              <Crown className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              Platinum
            </span>
          </div>

          {/* Score Résilience */}
          <div className="rounded-2xl bg-slate-50 p-5">
            <div className="mb-2 flex items-end justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Indice de Résilience
              </span>
              <span className="font-serif text-3xl font-bold text-emerald-800">
                94<span className="text-base font-medium text-slate-400">/100</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                initial={{ width: 0 }}
                whileInView={{ width: '94%' }}
                viewport={{ once: true }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              />
            </div>
          </div>

          {/* Checks forensic */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[
              'Revenus certifiés DGFIP',
              'Identité vérifiée eIDAS',
              'Bulletins de paie cohérents',
              'Métadonnées : aucune retouche',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span className="text-[13px] font-medium text-slate-600">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Badge flottant “Zéro retouche” */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -bottom-5 -right-3 flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-[0_16px_40px_-12px_rgba(245,158,11,0.45)] sm:-right-6"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
          <ScanSearch className="h-5 w-5 text-amber-600" aria-hidden="true" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-medium text-slate-400">Audit Forensic</p>
          <p className="text-sm font-bold text-slate-900">Zéro retouche détectée</p>
        </div>
      </motion.div>
    </div>
  );
}

/** Visuel Pilier 1 — panneau d'audit forensic. */
function ForensicMockup() {
  const checks = [
    { label: 'Calques Photoshop', value: 'Aucun détecté', ok: true },
    { label: 'Métadonnées EXIF', value: 'Authentiques', ok: true },
    { label: 'Cohérence des revenus', value: 'Validée', ok: true },
    { label: 'Bulletin retouché', value: 'Falsification', ok: false },
  ];
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-elevated">
      <div className="mb-5 flex items-center gap-2">
        <ScanSearch className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        <span className="font-serif text-lg font-semibold text-slate-900">
          Audit Forensic
        </span>
      </div>
      <div className="space-y-2.5">
        {checks.map((c) => (
          <div
            key={c.label}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              c.ok ? 'border-emerald-100 bg-emerald-50/50' : 'border-red-100 bg-red-50/60'
            }`}
          >
            <span className="text-sm font-medium text-slate-600">{c.label}</span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                c.ok ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {c.ok ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              )}
              {c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Visuel Pilier 2 — échelle de notation PLATINUM → ALERTE. */
function ResilienceMockup() {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-elevated">
      <div className="mb-5 flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-500" aria-hidden="true" />
        <span className="font-serif text-lg font-semibold text-slate-900">
          Indice de Résilience
        </span>
      </div>
      <div className="space-y-3">
        {RESILIENCE_TIERS.map((t) => (
          <div key={t.label} className="flex items-center gap-3">
            <span
              className={`inline-flex w-[5.5rem] shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ${t.soft} ${t.text} ${t.ring}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
              {t.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${t.bar} ${t.width}`} />
            </div>
            <span className="w-14 shrink-0 text-right text-[11px] font-semibold text-slate-400">
              {t.range}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Visuel Pilier 3 — bail ALUR scellé. */
function SealMockup() {
  return (
    <div className="relative rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-elevated">
      <div className="mb-5 flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        <span className="font-serif text-lg font-semibold text-slate-900">Bail ALUR</span>
      </div>
      {/* Faux document */}
      <div className="space-y-2.5 rounded-xl bg-slate-50 p-5">
        <div className="h-2.5 w-1/2 rounded-full bg-slate-300" />
        <div className="h-2 w-full rounded-full bg-slate-200" />
        <div className="h-2 w-5/6 rounded-full bg-slate-200" />
        <div className="h-2 w-full rounded-full bg-slate-200" />
        <div className="h-2 w-2/3 rounded-full bg-slate-200" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            PDF
          </span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
            DOCX
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
          <Stamp className="h-4 w-4" aria-hidden="true" />
          Scellé · 3 min
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Bloc Pilier (Z-pattern : alternance texte / visuel)
 * ────────────────────────────────────────────────────────────── */
function Pillar({
  eyebrow,
  title,
  children,
  visual,
  reverse = false,
  bullets,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  visual: ReactNode;
  reverse?: boolean;
  bullets: string[];
}) {
  return (
    <div
      className={`flex flex-col gap-10 lg:items-center lg:gap-16 ${
        reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'
      }`}
    >
      <Reveal className="flex-1" y={32}>
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
          {eyebrow}
        </span>
        <h3 className="mt-3 font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl">
          {title}
        </h3>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">{children}</p>
        <ul className="mt-6 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              </span>
              <span className="text-[15px] text-slate-600">{b}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal className="flex-1" delay={0.1} y={32}>
        {visual}
      </Reveal>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────── */
export default function LandingClient() {
  return (
    <div className="overflow-hidden bg-slate-50 text-slate-900">
      {/* ============================ HERO ============================ */}
      <section className="relative px-6 pt-16 pb-20 sm:pt-20 md:pt-24 md:pb-28">
        {/* Halo décoratif */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[480px] max-w-5xl bg-[radial-gradient(ellipse_at_top,rgba(6,78,59,0.10),transparent_60%)]"
        />
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
              <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
              La nouvelle norme de sélection locative
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-6 font-serif text-4xl font-bold leading-[1.1] tracking-tight text-emerald-900 sm:text-5xl md:text-6xl">
              Ne laissez plus la fraude
              <br className="hidden sm:block" />{' '}
              <span className="text-emerald-900">dicter vos choix locatifs.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              L’Intelligence Artificielle de niveau institutionnel qui audite vos
              dossiers locataires, détecte les falsifications et compare vos
              candidats en 3 clics.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-9 flex flex-col items-center gap-4">
              <Link
                href="/auth/register"
                className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-900 px-7 py-4 text-base font-semibold text-white shadow-[0_16px_36px_-10px_rgba(6,78,59,0.55)] transition-all hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-[0_20px_44px_-10px_rgba(6,78,59,0.65)] sm:text-lg"
              >
                Créer mon premier lien de candidature — 0€
                <ArrowRight
                  className="h-5 w-5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Aucune carte bancaire requise. 100% conforme RGPD.
              </p>
            </div>
          </Reveal>
        </div>

        {/* Visuel dashboard */}
        <Reveal delay={0.3} className="mt-16 sm:mt-20">
          <DashboardMockup />
        </Reveal>
      </section>

      {/* ============ SIMULATEUR LOCATAIRE IDÉAL (lead magnet) ============ */}
      <IdealTenantSimulator />

      {/* ===================== RÉASSURANCE / TRUST ===================== */}
      <section id="securite" className="border-y border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Technologie de vérification compatible avec les standards
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STANDARDS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center justify-center gap-3 text-slate-400"
                >
                  <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-slate-500">{s.label}</p>
                    <p className="text-xs text-slate-400">{s.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ DIFFÉRENCIATION vs DossierFacile ============ */}
      <section id="vs-dossierfacile" className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              Complémentaire, pas concurrent
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-emerald-900 sm:text-4xl">
              Vous recevez un DossierFacile ? Vérifiez-le en 3 clics.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              DossierFacile aide le locataire à présenter son dossier. Maison Patrimo aide le
              propriétaire à <strong className="text-emerald-900">décider</strong> : détecter la
              fraude, scorer le risque et comparer ses candidats.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <Reveal className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                DossierFacile · service public
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Constituer et partager un dossier de location, côté locataire.
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                {['Dossier locataire numérique', 'Pièces regroupées et partageables', 'Gratuit, côté candidat'].map(
                  (f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span>{f}</span>
                    </li>
                  ),
                )}
              </ul>
            </Reveal>
            <Reveal className="rounded-3xl border-2 border-emerald-200 bg-emerald-50/40 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Maison Patrimo · côté propriétaire
              </p>
              <p className="mt-2 text-sm text-emerald-900">
                Décider en confiance — ce que Maison Patrimo ajoute :
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                {[
                  'Audit forensic anti-fraude (faux bulletins détectés)',
                  'Indice de Résilience + grade par candidat',
                  'Comparaison classée de tous vos candidats',
                  'Décision assistée, sans expertise requise',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            Maison Patrimo est un outil d’aide à la décision et ne garantit pas la solvabilité future du locataire.
          </p>
        </div>
      </section>

      {/* ======================== 3 PILIERS ========================== */}
      <section id="features" className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              Pourquoi Maison Patrimo
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-emerald-900 sm:text-4xl md:text-5xl">
              Trois certitudes avant de signer.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Un audit de niveau bancaire, une notation lisible, une comparaison
              qui tranche. Vous décidez ; nous sécurisons.
            </p>
          </Reveal>

          <div className="mt-16 space-y-20 md:space-y-28">
            {/* Pilier 1 */}
            <Pillar
              eyebrow="Le Filtre Anti-Fraude"
              title="L’Audit Forensic le plus poussé du marché."
              visual={<ForensicMockup />}
              bullets={[
                'Détection des retouches Photoshop & métadonnées EXIF',
                'Validation croisée des revenus et bulletins de paie',
                'Alerte immédiate sur tout document falsifié',
              ]}
            >
              Notre IA inspecte chaque pièce comme un expert judiciaire&nbsp;: elle
              repère les calques, les incohérences de métadonnées et les revenus
              maquillés que l’œil humain ne voit pas.
            </Pillar>

            {/* Pilier 2 */}
            <Pillar
              eyebrow="L’Indice de Résilience"
              title="L’échelle de notation des Banques Privées."
              visual={<ResilienceMockup />}
              reverse
              bullets={[
                'Une note unique de 0 à 100, instantanément lisible',
                'Quatre niveaux : PLATINUM, GOLD, SILVER, ALERTE',
                'Comparez vos candidats d’un seul coup d’œil',
              ]}
            >
              Fini les dossiers illisibles. Chaque candidat reçoit un score de
              résilience institutionnel, traduit en quatre niveaux clairs pour une
              décision sereine et objective.
            </Pillar>

            {/* Pilier 3 */}
            <Pillar
              eyebrow="Le Scellement — bientôt disponible"
              title="De la sélection à la signature en 3 minutes."
              visual={<SealMockup />}
              bullets={[
                'Bail ALUR pré-rempli automatiquement',
                'Export PDF & DOCX prêts à signer',
                'Conforme à la réglementation en vigueur',
              ]}
            >
              Une fois votre locataire choisi, Maison Patrimo génère un bail conforme
              à la norme ALUR, pré-rempli avec les données vérifiées du dossier.
              Plus de copier-coller, plus d’erreurs.
            </Pillar>
          </div>
        </div>
      </section>

      {/* ========================== TARIFS =========================== */}
      <section id="pricing" className="bg-white px-6 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              Tarifs
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-emerald-900 sm:text-4xl md:text-5xl">
              Payez à la mise en location.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Démarrez gratuitement. Activez l’IA uniquement quand vous publiez un
              bien. Aucun abonnement caché.
            </p>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRICING.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 0.06}>
                <div
                  className={`relative flex h-full flex-col rounded-[1.5rem] border bg-white p-6 transition-all ${
                    plan.highlight
                      ? 'border-amber-300 shadow-[0_24px_60px_-20px_rgba(245,158,11,0.45)] lg:-translate-y-3'
                      : 'border-slate-200 shadow-card hover:border-slate-300'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-amber">
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="font-serif text-xl font-bold text-emerald-900">
                    {plan.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-serif text-4xl font-bold text-emerald-900">
                      {plan.price}
                    </span>
                    <span className="text-sm font-medium text-slate-400">
                      {plan.unit}
                    </span>
                  </div>
                  <p className="mt-2 min-h-[2.5rem] text-sm text-slate-500">
                    {plan.tagline}
                  </p>

                  <ul className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            plan.highlight ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-[13px] leading-snug text-slate-600">
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.href}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                      plan.highlight
                        ? 'bg-amber-500 text-white shadow-amber hover:bg-amber-600'
                        : 'bg-emerald-900 text-white hover:bg-emerald-800'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-2 text-center text-sm text-slate-500">
            <CreditCard className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            Quota épuisé ? Rachetez une offre : vos crédits restants sont conservés
            et cumulés. Prix valable pour un logement mis en location.
          </p>
        </div>
      </section>

      {/* ============ WAITLIST GESTION LOCATIVE ============ */}
      {isEnabled('WAITLIST_MANAGEMENT') && (
        <section id="waitlist-gestion" className="px-6 py-16 md:py-20">
          <Reveal className="mx-auto max-w-3xl rounded-[2rem] border border-emerald-100 bg-gradient-to-b from-emerald-50/50 to-white p-8 text-center sm:p-12">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
              Bientôt
            </span>
            <h2 className="mt-3 font-serif text-3xl font-bold text-emerald-900 sm:text-4xl">
              La gestion locative, en autonomie
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">
              Quittances, avis d’échéance, courriers, coffre-fort et rappels — au même endroit,
              une fois votre locataire choisi. Rejoignez la liste d’attente pour être prévenu au
              lancement, et profiter du tarif fondateur.
            </p>
            <div className="mx-auto mt-6 max-w-md">
              <WaitlistForm source="waitlist_gestion_locative" />
            </div>
          </Reveal>
        </section>
      )}

      {/* ====================== CTA FINAL (dark) ===================== */}
      <section className="px-6 py-20 md:py-24">
        <Reveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 px-8 py-14 text-center shadow-emerald sm:px-16 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"
            />
            <Building2 className="mx-auto h-10 w-10 text-amber-400" aria-hidden="true" />
            <h2 className="mx-auto mt-5 max-w-2xl font-serif text-3xl font-bold leading-tight text-white sm:text-4xl">
              Votre prochain locataire mérite un audit d’exception.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-emerald-100/80">
              Créez votre lien gratuit en 30 secondes. Recevez vos premiers dossiers
              audités dès aujourd’hui.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/auth/register"
                className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-amber-500 px-7 py-4 text-base font-semibold text-white shadow-amber transition-all hover:-translate-y-0.5 hover:bg-amber-600"
              >
                Créer mon lien gratuit
                <ArrowRight
                  className="h-5 w-5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Eye className="h-5 w-5" aria-hidden="true" />
                Se connecter
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* =========================== FOOTER ========================== */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900">
                  <ShieldCheck className="h-5 w-5 text-amber-400" aria-hidden="true" />
                </span>
                <span className="font-serif text-lg font-semibold text-emerald-900">
                  Maison Patrimo
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Maison Patrimo est un outil d’aide à la décision. Le propriétaire reste
                seul décisionnaire de la sélection de son locataire.
              </p>
            </div>

            <nav className="flex flex-col gap-3 text-sm" aria-label="Liens légaux">
              <span className="font-semibold text-slate-900">Légal</span>
              <Link href="/terms" className="text-slate-500 transition-colors hover:text-emerald-800">
                CGU
              </Link>
              <Link href="/cgv" className="text-slate-500 transition-colors hover:text-emerald-800">
                CGV
              </Link>
              <Link href="/privacy" className="text-slate-500 transition-colors hover:text-emerald-800">
                Confidentialité
              </Link>
              <Link
                href="/mentions-legales"
                className="text-slate-500 transition-colors hover:text-emerald-800"
              >
                Mentions légales
              </Link>
            </nav>

            <nav className="flex flex-col gap-3 text-sm" aria-label="Produit">
              <span className="font-semibold text-slate-900">Produit</span>
              <a href="#features" className="text-slate-500 transition-colors hover:text-emerald-800">
                Fonctionnalités
              </a>
              <a href="#securite" className="text-slate-500 transition-colors hover:text-emerald-800">
                Sécurité
              </a>
              <a href="#pricing" className="text-slate-500 transition-colors hover:text-emerald-800">
                Tarifs
              </a>
            </nav>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
            <p>© {new Date().getFullYear()} Maison Patrimo. Tous droits réservés.</p>
            <p className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Données chiffrées · Hébergement en France · RGPD
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
