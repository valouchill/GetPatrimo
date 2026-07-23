'use client';

/**
 * <LiveAuditDemo> — Le « waouh » de la landing : un audit forensic scénarisé
 * qui se joue sous les yeux du visiteur (remplace l'ancien simulateur de loyer).
 *
 * 100 % côté client : animation scriptée déterministe (AUCUN appel API, aucun
 * coût, accessible sans compte). Reprend le langage visuel du produit réel
 * (Trust-List, score, niveau ALERTE — cf. AnalysisV2Panel) : un faux bulletin
 * « parfait en apparence » passe l'audit → les contrôles tombent → ALERTE 12/100.
 * Honnêteté : libellé « démonstration, dossier fictif inspiré de cas réels ».
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type CheckStatus = 'VERIFIED' | 'WARNING' | 'ALERT';

const CHECKS: Array<{ name: string; status: CheckStatus; detail: string }> = [
  {
    name: 'Métadonnées PDF',
    status: 'ALERT',
    detail: 'Producteur : Adobe Photoshop 25.2 — attendu : logiciel de paie (Silae, ADP, PayFit…)',
  },
  {
    name: 'Cohérence des cumuls',
    status: 'WARNING',
    detail: 'Cumul imposable de novembre ≠ net mensuel × 11 — incohérence de génération',
  },
  {
    name: 'Recoupement fiscal',
    status: 'ALERT',
    detail: '4 200 €/mois déclarés vs avis d’imposition ≈ 1 500 €/mois : revenus falsifiés',
  },
  {
    name: 'Signature de génération IA',
    status: 'ALERT',
    detail: 'Manifeste C2PA embarqué (Adobe Firefly) — visuel généré par IA, document synthétique',
  },
  {
    name: 'Identité (eIDAS)',
    status: 'VERIFIED',
    detail: 'Pièce d’identité conforme — la fraude porte sur les revenus, pas l’identité',
  },
];

const CHECK_STYLE: Record<CheckStatus, { icon: typeof ShieldCheck; cls: string; box: string; label: string }> = {
  VERIFIED: { icon: ShieldCheck, cls: 'text-emerald-600', box: 'border-emerald-200 bg-emerald-50/70', label: 'Vérifié' },
  WARNING: { icon: AlertTriangle, cls: 'text-amber-600', box: 'border-amber-200 bg-amber-50/70', label: 'À surveiller' },
  ALERT: { icon: AlertOctagon, cls: 'text-red-600', box: 'border-red-200 bg-red-50/70', label: 'Alerte' },
};

const STEP_MS = 950;
const SCORE_START = 87;
const SCORE_END = 12;

export default function LiveAuditDemo() {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [revealed, setRevealed] = useState(0);
  const [score, setScore] = useState(SCORE_START);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const start = () => {
    clearTimers();
    setRevealed(0);
    setScore(SCORE_START);

    // Accessibilité : si l'utilisateur préfère éviter les animations, tout
    // s'affiche instantanément.
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setRevealed(CHECKS.length);
      setScore(SCORE_END);
      setPhase('done');
      return;
    }

    setPhase('running');
    CHECKS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setRevealed(i + 1), (i + 1) * STEP_MS));
    });
    // Décompte du score après le dernier contrôle (20 ticks × 40 ms ≈ 0,8 s)
    const scoreStart = (CHECKS.length + 1) * STEP_MS;
    const ticks = 20;
    for (let t = 1; t <= ticks; t += 1) {
      timers.current.push(
        setTimeout(() => {
          setScore(Math.round(SCORE_START - ((SCORE_START - SCORE_END) * t) / ticks));
          if (t === ticks) setPhase('done');
        }, scoreStart + t * 40),
      );
    }
  };

  const scanningIndex = phase === 'running' && revealed < CHECKS.length ? revealed : -1;
  const alertsFound = CHECKS.slice(0, revealed).filter((c) => c.status !== 'VERIFIED').length;

  return (
    <section id="demo-audit" className="relative px-6 py-16 md:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-8 -z-10 mx-auto h-72 max-w-3xl bg-[radial-gradient(ellipse_at_center,rgba(6,78,59,0.08),transparent_70%)]"
      />

      <div className="mx-auto max-w-5xl">
        {/* En-tête */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Démonstration en direct
          </span>
          <h2 className="mx-auto mt-5 max-w-2xl font-serif text-3xl font-bold text-emerald-900 sm:text-4xl">
            Le faux dossier que vous n&rsquo;auriez jamais repéré.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
            Ce bulletin de salaire a l&rsquo;air impeccable. Lancez l&rsquo;audit forensic
            et regardez ce que l&rsquo;œil nu ne voit pas.
          </p>
        </div>

        {/* Démo */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Le document « parfait » */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  bulletin-paie-novembre.pdf
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                  Apparence : impeccable
                </span>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Bulletin de paie</p>
                  <p className="mt-1 font-serif text-lg font-semibold text-slate-900">Kevin M. — Consultant</p>
                  <p className="text-xs text-slate-500">KM Consulting · Novembre 2026 · CDI</p>
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Salaire brut</span><span className="font-medium text-slate-800">5 385,00 €</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cotisations</span><span className="font-medium text-slate-800">− 1 185,00 €</span></div>
                  <div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-semibold text-slate-700">Net à payer</span><span className="font-bold text-emerald-900">4 200,00 €</span></div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Logo net, mise en page conforme, montants ronds mais crédibles. Un très bon faux.
                </p>
              </div>
            </div>
          </div>

          {/* Le panneau d'audit */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-slate-900 p-2 text-white">
                  <ScanSearch className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Audit forensic</p>
                  <p className="text-[11px] text-slate-500">{CHECKS.length} contrôles anti-fraude</p>
                </div>
              </div>
              {/* Score */}
              <div
                className={`flex items-baseline gap-1 rounded-xl px-3 py-1.5 ring-1 transition-colors duration-500 ${
                  phase === 'done'
                    ? 'bg-red-50 ring-red-200'
                    : 'bg-slate-50 ring-slate-200'
                }`}
              >
                <span className={`tabular-nums font-serif text-2xl font-bold ${phase === 'done' ? 'text-red-600' : 'text-slate-800'}`}>
                  {phase === 'idle' ? SCORE_START : score}
                </span>
                <span className="text-xs text-slate-500">/100</span>
              </div>
            </div>

            {/* Contrôles */}
            <ul className="mt-5 flex-1 space-y-2" aria-live="polite">
              {CHECKS.map((c, i) => {
                if (i >= revealed && i !== scanningIndex) {
                  return (
                    <li key={c.name} className="rounded-lg border border-dashed border-slate-200 px-3 py-2.5 text-xs text-slate-400">
                      {c.name}
                    </li>
                  );
                }
                if (i === scanningIndex) {
                  return (
                    <li key={c.name} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden="true" />
                      <span className="text-sm text-slate-600">Analyse : {c.name}…</span>
                    </li>
                  );
                }
                const st = CHECK_STYLE[c.status];
                const Icon = st.icon;
                return (
                  <li key={c.name} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${st.box}`}>
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${st.cls}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{c.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Verdict + CTA */}
            {phase === 'idle' && (
              <button
                type="button"
                onClick={start}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                <ScanSearch className="h-4 w-4" aria-hidden="true" />
                Lancer l&rsquo;audit forensic
              </button>
            )}
            {phase === 'running' && (
              <p className="mt-5 text-center text-xs text-slate-500">
                {alertsFound > 0 ? `${alertsFound} anomalie${alertsFound > 1 ? 's' : ''} détectée${alertsFound > 1 ? 's' : ''}…` : 'Analyse en cours…'}
              </p>
            )}
            {phase === 'done' && (
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center">
                  <p className="font-serif text-lg font-bold text-red-700">ALERTE — Dossier à écarter</p>
                  <p className="mt-0.5 text-xs text-red-800/80">
                    À l&rsquo;œil nu, ce dossier serait passé.
                  </p>
                </div>
                <Link
                  href="/auth/register?role=owner"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-600"
                >
                  Auditez vos vrais dossiers — 1 audit offert
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Rejouer la démonstration
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-400">
          Démonstration scénarisée — dossier fictif inspiré de cas réels. Sur la plateforme,
          chaque contrôle est exécuté sur les pièces réelles du candidat.
        </p>
      </div>
    </section>
  );
}
