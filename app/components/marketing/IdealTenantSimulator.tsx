'use client';

/**
 * <IdealTenantSimulator> — Lead magnet interactif de la landing page.
 *
 * Le visiteur saisit le loyer charges comprises de son bien (slider + champ).
 * Un mini-algorithme déterministe calcule, en temps réel, le « profil exigé »
 * par l'IA PatrimoTrust pour viser le statut PLATINUM, présenté comme un
 * rapport financier haut de gamme. Conversion via CTA vers l'inscription.
 *
 * Règles (loyer = L) :
 *   - Revenus nets min (PLATINUM) : L × 3,03  → taux d'effort max ~33 %
 *   - Garant : revenus de L × 4, ou certification Visale
 *   - Tolérance fraude : 0 % (fixe)
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Crown, UserCheck, ScanSearch, ArrowRight, Sparkles } from 'lucide-react';

const MIN = 300;
const MAX = 4000;
const STEP = 10;
const DEFAULT = 850;
const QUICK = [600, 850, 1200, 2000];

const eur = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);

export default function IdealTenantSimulator() {
  // On stocke la saisie en chaîne pour autoriser la frappe libre ;
  // la valeur de calcul `L` est dérivée et bornée à [MIN, MAX].
  const [rentStr, setRentStr] = useState(String(DEFAULT));
  const parsed = parseInt(rentStr, 10);
  const L = Math.min(MAX, Math.max(MIN, Number.isFinite(parsed) ? parsed || DEFAULT : DEFAULT));

  const minIncome = Math.round(L * 3.03);
  const guarantorIncome = Math.round(L * 4);

  return (
    <section id="simulateur" className="relative px-6 py-16 md:py-24">
      {/* Halo décoratif */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-8 -z-10 mx-auto h-72 max-w-3xl bg-[radial-gradient(ellipse_at_center,rgba(6,78,59,0.08),transparent_70%)]"
      />

      <div className="mx-auto max-w-3xl">
        {/* En-tête */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Simulateur en temps réel
          </span>
          <h2 className="mx-auto mt-5 max-w-2xl font-serif text-3xl font-bold text-emerald-900 sm:text-4xl">
            Testez notre IA : quel est le profil idéal pour votre bien ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
            Saisissez votre loyer charges comprises&nbsp;: notre algorithme calcule
            les exigences strictes de la plateforme.
          </p>
        </div>

        {/* Carte simulateur */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(6,78,59,0.25)]"
        >
          {/* ── Zone interactive (input) ── */}
          <div className="border-b border-slate-100 bg-slate-50/60 p-6 sm:p-8">
            <label
              htmlFor="rent-input"
              className="block text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Loyer mensuel charges comprises
            </label>

            <div className="mt-3 flex items-center justify-center">
              <input
                id="rent-input"
                inputMode="numeric"
                value={rentStr}
                onChange={(e) =>
                  setRentStr(e.target.value.replace(/[^\d]/g, '').slice(0, 5))
                }
                onBlur={() => setRentStr(String(L))}
                style={{ width: `${Math.max(2, rentStr.length || 1)}ch` }}
                className="bg-transparent text-center font-serif text-5xl font-bold text-emerald-900 outline-none transition-colors focus:text-emerald-700 sm:text-6xl"
                aria-label="Loyer mensuel en euros"
              />
              <span className="font-serif text-4xl font-bold text-slate-300 sm:text-5xl">
                €
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={MIN}
              max={MAX}
              step={STEP}
              value={L}
              onChange={(e) => setRentStr(e.target.value)}
              className="mt-6 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-700"
              style={{
                background: `linear-gradient(to right, #047857 0%, #047857 ${
                  ((L - MIN) / (MAX - MIN)) * 100
                }%, #e2e8f0 ${((L - MIN) / (MAX - MIN)) * 100}%, #e2e8f0 100%)`,
              }}
              aria-label="Curseur de réglage du loyer"
            />
            <div className="mt-1.5 flex justify-between text-xs font-medium text-slate-400">
              <span>{eur(MIN)}</span>
              <span>{eur(MAX)}+</span>
            </div>

            {/* Quick picks */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {QUICK.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRentStr(String(v))}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    L === v
                      ? 'bg-emerald-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800'
                  }`}
                >
                  {eur(v)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Rapport IA (résultat temps réel) ── */}
          <div className="p-6 sm:p-8">
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/50 to-white p-5 sm:p-6">
              {/* Bandeau rapport */}
              <div className="mb-5 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Rapport IA · profil exigé
                </span>
                <span className="font-serif text-xs font-semibold text-slate-400">
                  PatrimoTrust™
                </span>
              </div>

              {/* Critère 1 — Revenus PLATINUM (mis en avant) */}
              <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-slate-100">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <Crown className="h-5 w-5 text-amber-500" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">
                      Revenus nets minimum{' '}
                      <span className="text-amber-600">— Grade PLATINUM</span>
                    </p>
                    <p className="mt-0.5 font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl">
                      {eur(minIncome)}
                      <span className="ml-1 text-sm font-medium text-slate-400">
                        / mois
                      </span>
                    </p>
                    <p className="mt-1.5 text-[13px] leading-snug text-slate-500">
                      Pour garantir un reste-à-vivre optimal et le statut Platinum,
                      l’IA filtrera les dossiers sous ce seuil{' '}
                      <span className="font-semibold text-slate-600">
                        (taux d’effort max&nbsp;33&nbsp;%)
                      </span>
                      .
                    </p>
                  </div>
                </div>
              </div>

              {/* Critère 2 — Garant */}
              <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-slate-100">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <UserCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">
                      Profil garant exigé
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-slate-500">
                      Si les revenus sont inférieurs à {eur(minIncome)}, l’IA exige un{' '}
                      <span className="font-semibold text-slate-600">
                        garant physique avec {eur(guarantorIncome)}
                      </span>{' '}
                      de revenus, ou une{' '}
                      <span className="font-semibold text-emerald-700">
                        certification Visale
                      </span>{' '}
                      pour compenser.
                    </p>
                  </div>
                </div>
              </div>

              {/* Critère 3 — Tolérance fraude (fixe) */}
              <div className="mt-3 rounded-xl bg-white p-4 ring-1 ring-slate-100">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                    <ScanSearch className="h-5 w-5 text-red-500" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">
                      Tolérance à la fraude
                    </p>
                    <p className="mt-1 text-[13px] leading-snug text-slate-500">
                      <span className="font-bold text-red-600">0&nbsp;%</span> — rejet
                      automatique si les métadonnées d’un document sont altérées.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── CTA ── */}
            <Link
              href="/auth/register"
              className="group mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-900 px-6 py-4 text-center text-base font-semibold text-white shadow-[0_16px_36px_-12px_rgba(6,78,59,0.5)] transition-all hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              Créer un lien pour trouver ce locataire — Gratuit
              <ArrowRight
                className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <p className="mt-3 text-center text-xs text-slate-400">
              Simulation indicative. PatrimoTrust reste un outil d’aide à la décision.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
