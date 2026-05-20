'use client';

/**
 * <GradeBadge> — Badge grade lettre (S/A/B/C/D) selon score résilience.
 *
 * Promu depuis dashboard/owner/components/ui.tsx pour usage partagé.
 * Consomme GRADE_COLORS de lib/product-lexicon.ts.
 */

import * as React from 'react';
import { getGrade, GRADE_SHORT, GRADE_COLORS } from '@/lib/product-lexicon';

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
  const grade = getGrade(score);
  const { bg, text, ring } = GRADE_COLORS[grade];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill font-bold uppercase tracking-wide ring-1 ${bg} ${text} ${ring} ${SIZE_CLS[size]} ${className}`}
      aria-label={`Grade ${GRADE_SHORT[grade]}`}
    >
      {GRADE_SHORT[grade]}
    </span>
  );
}
