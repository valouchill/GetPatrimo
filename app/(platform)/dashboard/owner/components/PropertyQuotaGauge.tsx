'use client';

/**
 * <PropertyQuotaGauge> — Jauge d'utilisation du quota d'analyses IA (V8.0).
 *
 * Affiche "Dossiers analysés : X / quota" + barre de progression.
 * - FREE                → encart upsell "Activez l'analyse IA"
 * - ≥ 90% du quota      → badge d'alerte "quota presque atteint"
 * - quota épuisé        → badge "rachetez une offre" (plafond dur one-time)
 *
 * Charte banque privée : émeraude / ambre / rouge selon l'état.
 */

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { TIERS, type PropertyTier } from '@/lib/billing/tiers';

export interface PropertyQuotaGaugeProps {
  propertyId: string;
  tier?: PropertyTier;
  used?: number;
  quota?: number;
  className?: string;
}

export function PropertyQuotaGauge({
  propertyId,
  tier = 'FREE',
  used = 0,
  quota = 0,
  className = '',
}: PropertyQuotaGaugeProps): React.ReactElement {
  const tierLabel = TIERS[tier]?.label || 'Gratuit';

  // ─── FREE : upsell ───────────────────────────────────────────────────
  if (tier === 'FREE') {
    return (
      <section
        className={`rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-amber-400">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              Offre Gratuite
            </p>
            <h3 className="mt-0.5 font-serif text-base font-semibold text-emerald-900">
              Essai gratuit : 3 analyses IA offertes
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Votre compte gratuit inclut 3 analyses IA anti-fraude (au total) pour tester
              le service. Au-delà, souscrivez une offre.
            </p>
            <Link
              href={`/pricing?property=${propertyId}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              Voir les offres
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // ─── Offre payante : jauge ───────────────────────────────────────────
  const safeQuota = Math.max(1, quota);
  const pct = Math.min(100, Math.round((used / safeQuota) * 100));
  const isOverage = used >= quota;
  // Seuil relatif (90 %) inatteignable avec les petits quotas (3/10/20) → on
  // alerte aussi quand il ne reste qu'un seul crédit.
  const isNearLimit = !isOverage && (pct >= 90 || safeQuota - used === 1);

  const barColor = isOverage
    ? 'bg-red-500'
    : isNearLimit
    ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Offre {tierLabel} · Analyses IA
          </p>
          <h3 className="mt-0.5 font-serif text-lg font-semibold text-emerald-900">
            Dossiers analysés : {used} / {quota}
          </h3>
        </div>
        <Link
          href={`/pricing?property=${propertyId}`}
          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Gérer l&rsquo;offre
        </Link>
      </div>

      {/* Barre de progression */}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={quota}
        aria-label={`${used} dossiers analysés sur ${quota}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* État / alerte */}
      {isOverage ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-red-800">
              Quota épuisé
            </p>
            <p className="mt-0.5 text-[11px] text-red-700">
              Vous avez utilisé toutes vos analyses incluses. Rachetez une offre
              pour analyser de nouveaux dossiers sur ce bien.
            </p>
            <Link
              href={`/pricing?property=${propertyId}`}
              className="mt-1.5 inline-block text-[11px] font-bold text-red-800 underline hover:text-red-900"
            >
              Racheter une offre →
            </Link>
          </div>
        </div>
      ) : isNearLimit ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-800">
              Quota presque atteint
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700">
              Pensez à racheter une offre avant épuisement pour continuer à
              analyser de nouveaux dossiers.
            </p>
            <Link
              href={`/pricing?property=${propertyId}`}
              className="mt-1.5 inline-block text-[11px] font-bold text-amber-800 underline hover:text-amber-900"
            >
              Voir les offres →
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-2.5 text-[11px] text-slate-500">
          {quota - used} analyse{quota - used > 1 ? 's' : ''} restante
          {quota - used > 1 ? 's' : ''} dans votre forfait.
        </p>
      )}
    </section>
  );
}
