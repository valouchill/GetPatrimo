'use client';

/**
 * <LoadingSpinner> — Spinner de chargement standardisé.
 *
 * Migré depuis app/components/shared/LoadingSpinner.tsx.
 * À privilégier sur les `Loader2 animate-spin` éparpillés dans les composants.
 */

import * as React from 'react';

export type SpinnerColor = 'emerald' | 'slate' | 'blue' | 'red' | 'amber';

const SIZE_CLS = {
  sm: 'w-5 h-5 border-2',
  md: 'w-10 h-10 border-4',
  lg: 'w-16 h-16 border-4',
} as const;

const COLOR_CLS: Record<SpinnerColor, string> = {
  emerald: 'border-emerald-200 border-t-emerald-600',
  slate: 'border-slate-200 border-t-slate-600',
  blue: 'border-blue-200 border-t-blue-600',
  red: 'border-red-200 border-t-red-500',
  amber: 'border-amber-200 border-t-amber-500',
};

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: SpinnerColor;
  /** Texte accessible pour les screen readers */
  label?: string;
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  color = 'emerald',
  label,
  className = '',
}: LoadingSpinnerProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-label={label ?? 'Chargement…'}
      className={`inline-block animate-spin rounded-full ${SIZE_CLS[size]} ${COLOR_CLS[color]} ${className}`}
    >
      <span className="sr-only">{label ?? 'Chargement…'}</span>
    </div>
  );
}
