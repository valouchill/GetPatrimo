'use client';

/**
 * <ScorePill> — Pill Indice de Résilience (0-100) coloré selon le niveau
 * métal (V2 : PLATINUM/GOLD/SILVER/ALERTE).
 *
 * Promu depuis dashboard/owner/components/ui.tsx pour usage partagé
 * (côté locataire dans TenantDashboardClient, côté apply tunnel pour
 * la gauge PatrimoMeter, etc.).
 *
 * V8.2 — Single source of truth : consomme METAL_* de product-lexicon.
 */

import * as React from 'react';
import {
  getMetalLevel,
  METAL_LABELS,
  METAL_COLORS,
} from '@/lib/product-lexicon';

export interface ScorePillProps {
  score: number;
  /** Affiche le niveau en plus du score (ex: "PLATINUM · 92%") */
  showGrade?: boolean;
  /** Classes additionnelles */
  className?: string;
}

export function ScorePill({
  score,
  showGrade = false,
  className = '',
}: ScorePillProps): React.ReactElement {
  const level = getMetalLevel(score);
  const { bg, text, ring, barFill } = METAL_COLORS[level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-bold ring-1 ${bg} ${text} ${ring} ${className}`}
      aria-label={`Indice de Résilience : ${score} sur 100 (${METAL_LABELS[level]})`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${barFill}`} aria-hidden="true" />
      {showGrade ? `${METAL_LABELS[level]} · ${score}%` : `${score}/100`}
    </span>
  );
}
