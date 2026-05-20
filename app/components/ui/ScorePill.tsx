'use client';

/**
 * <ScorePill> — Pill score résilience (0-100) coloré selon la grade.
 *
 * Promu depuis dashboard/owner/components/ui.tsx pour usage partagé
 * (côté locataire dans TenantDashboardClient, côté apply tunnel pour
 * la gauge PatrimoMeter, etc.).
 *
 * Consomme GRADE_COLORS de lib/product-lexicon.ts.
 */

import * as React from 'react';
import { getGrade, GRADE_SHORT, GRADE_COLORS } from '@/lib/product-lexicon';

export interface ScorePillProps {
  score: number;
  /** Affiche le grade en plus du score (ex: "S · 92%") */
  showGrade?: boolean;
  /** Classes additionnelles */
  className?: string;
}

export function ScorePill({
  score,
  showGrade = false,
  className = '',
}: ScorePillProps): React.ReactElement {
  const grade = getGrade(score);
  const { bg, text, ring } = GRADE_COLORS[grade];
  const dot =
    grade === 'S' || grade === 'A'
      ? 'bg-emerald-500'
      : grade === 'B' || grade === 'C'
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-bold ring-1 ${bg} ${text} ${ring} ${className}`}
      aria-label={`Score résilience : ${score} sur 100`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {showGrade ? `${GRADE_SHORT[grade]} · ${score}%` : `${score}/100`}
    </span>
  );
}
