'use client';

import Link from 'next/link';
import { ArrowRight, Plus, ShieldCheck } from 'lucide-react';

import { PremiumSurface, QuickStat } from '@/app/components/ui/premium';

type HeroMetric = {
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
};

type FocusCard = {
  eyebrow: string;
  title: string;
  reason: string;
  summary: string;
  metricLabel: string;
  metricValue: React.ReactNode;
  ctaLabel: string;
  ctaHref: string;
};

export default function PortfolioFocusHero({
  headline,
  metrics,
  focusCard,
}: {
  headline: string;
  metrics: HeroMetric[];
  focusCard?: FocusCard | null;
}) {
  return (
    <PremiumSurface
      tone="hero"
      padding="lg"
      className="rounded-[2.25rem] border-stone-200/90 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.08),_transparent_32%),linear-gradient(145deg,#fffef9_0%,#f6f2e8_48%,#f7fafc_100%)]"
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] xl:items-start">

        {/* ── Colonne gauche ── */}
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-600">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
            Cockpit Souverain
          </div>

          <h1 className="text-balance font-serif text-4xl tracking-tight text-slate-950 sm:text-[3.2rem] sm:leading-[1.08]">
            {headline}
          </h1>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <QuickStat
                key={metric.label}
                label={metric.label}
                value={metric.value}
                caption={metric.caption}
                className="bg-white/80 backdrop-blur"
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/fast-track"
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Ajouter un actif
            </Link>
            {focusCard ? (
              <Link
                href={focusCard.ctaHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white"
              >
                {focusCard.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* ── Colonne droite : Focus card ── */}
        <div className="rounded-[1.9rem] border border-white/80 bg-white/82 p-5 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
          {focusCard ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-500">
                  {focusCard.eyebrow}
                </div>
                <h2 className="font-serif text-[1.7rem] leading-tight tracking-tight text-slate-950">
                  {focusCard.title}
                </h2>
                <p className="text-sm text-slate-600">{focusCard.reason}</p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/85 px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {focusCard.metricLabel}
                </div>
                <div className="mt-2 text-3xl font-bold text-slate-950">{focusCard.metricValue}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{focusCard.summary}</p>
              </div>

              <Link
                href={focusCard.ctaHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[1.35rem] bg-amber-500 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                {focusCard.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-500">
                Portefeuille prêt
              </div>
              <h2 className="font-serif text-[1.7rem] leading-tight tracking-tight text-slate-950">
                Ajoutez votre premier actif
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Une fois l'actif créé, le Sésame candidat et le cockpit de sélection s'activent automatiquement.
              </p>
            </div>
          )}
        </div>
      </div>
    </PremiumSurface>
  );
}
