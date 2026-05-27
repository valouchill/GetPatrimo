'use client';

/**
 * <GradeBadge> — Badge niveau institutionnel (PLATINUM/GOLD/SILVER/ALERTE).
 *
 * V6.6 — Migration depuis le legacy lettrage S/A/B/C/D vers les métaux
 * précieux inspirés des cartes bancaires Banque Privée. Consomme
 * METAL_BADGE_CLASS + METAL_LABELS de lib/product-lexicon.ts.
 */

import * as React from 'react';
import {
  getMetalLevel,
  METAL_BADGE_CLASS,
  METAL_LABELS,
} from '@/lib/product-lexicon';

export interface GradeBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3.5 py-1.5 text-sm',
};

export function GradeBadge({
  score,
  size = 'md',
  className = '',
}: GradeBadgeProps): React.ReactElement {
  const level = getMetalLevel(score);
  const badgeCls = METAL_BADGE_CLASS[level];
  const label = METAL_LABELS[level];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill font-bold uppercase tracking-[0.14em] ring-1 ${badgeCls} ${SIZE_CLS[size]} ${className}`}
      aria-label={`Niveau ${label}`}
    >
      {level === 'PLATINUM' && (
        <span aria-hidden="true">★</span>
      )}
      {label}
    </span>
  );
}
