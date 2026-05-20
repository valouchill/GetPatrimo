'use client';

/**
 * <NextActionCard> — Cockpit "Prochaine étape" du tunnel apply.
 *
 * Affiche en permanence (sticky en haut du tunnel) la prochaine action
 * concrète que le locataire doit accomplir pour faire avancer son dossier.
 *
 * Pattern Trust Premium : eyebrow gold + H2 serif + CTA primaire amber.
 */

import React from 'react';
import { ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export interface NextActionCardProps {
  /** Nombre de pièces certifiées sur le total requis */
  certifiedCount: number;
  totalRequired: number;
  /** Label de la prochaine pièce manquante (ex: "votre dernier bulletin de salaire") */
  nextDocLabel?: string | null;
  /** Catégorie cible (pour scroll-to ou highlight) */
  nextDocCategory?: 'identity' | 'resources' | 'guarantor' | null;
  /** Callback quand l'utilisateur clique sur le CTA principal */
  onActionClick?: () => void;
  /** Si tout est complété et certifié */
  isComplete?: boolean;
  className?: string;
}

export function NextActionCard({
  certifiedCount,
  totalRequired,
  nextDocLabel,
  nextDocCategory,
  onActionClick,
  isComplete = false,
  className = '',
}: NextActionCardProps): React.ReactElement {
  const progressPct =
    totalRequired > 0
      ? Math.min(100, Math.round((certifiedCount / totalRequired) * 100))
      : 0;

  // État final : dossier complet
  if (isComplete) {
    return (
      <div
        className={`rounded-card border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-white p-5 shadow-card ${className}`}
        role="status"
      >
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
          Dossier complet
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-bold text-slate-900">
              Toutes les pièces requises sont certifiées.
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Vous pouvez maintenant générer votre Passeport Locatif.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // État actif : prochaine étape à accomplir
  return (
    <div
      className={`rounded-card border border-slate-200 bg-white p-5 shadow-card ring-1 ring-amber-100/50 ${className}`}
      role="region"
      aria-label="Prochaine étape du dossier"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200">
          <ShieldCheck className="h-5 w-5 text-amber-700" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">
            Prochaine étape
          </p>
          <h2 className="font-serif text-lg font-bold text-slate-900">
            {nextDocLabel
              ? `Téléchargez ${nextDocLabel}`
              : 'Complétez votre dossier'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Encore {totalRequired - certifiedCount} pièce
            {totalRequired - certifiedCount > 1 ? 's' : ''} à certifier
            sur {totalRequired}.
          </p>
        </div>
        {onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-button bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
            aria-label="Aller à la prochaine pièce à téléverser"
          >
            <span className="hidden sm:inline">Continuer</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {/* Barre de progression — décorative, sourcée uniquement sur les pièces */}
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-500"
          style={{ width: `${progressPct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
