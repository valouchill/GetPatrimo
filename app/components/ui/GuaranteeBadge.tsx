'use client';

/**
 * <GuaranteeBadge> — Badge type de garantie locataire.
 *
 * Remplace l'ancien GuaranteeBadge local (owner/components/ui.tsx) qui
 * utilisait des émojis ⚠/✓. Utilise désormais des icônes Lucide via
 * lib/icon-system.ts.
 *
 * 3 modes : NONE (sans garant), VISALE, PHYSICAL (garant physique).
 */

import * as React from 'react';
import { ICON_BY_GUARANTEE, type GuaranteeMode } from '@/lib/icon-system';

export interface GuaranteeBadgeProps {
  mode?: GuaranteeMode | null;
  /** Affichage court (sans préfixe descriptif) */
  short?: boolean;
  /** Affiche l'icône Lucide */
  withIcon?: boolean;
  /** Classes additionnelles */
  className?: string;
}

export function GuaranteeBadge({
  mode = 'NONE',
  short = false,
  withIcon = false,
  className = '',
}: GuaranteeBadgeProps): React.ReactElement {
  const key: GuaranteeMode = mode || 'NONE';
  const visual = ICON_BY_GUARANTEE[key];
  const Icon = visual.icon;
  const label = short ? visual.labelShort : visual.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold ring-1 ${visual.bg} ${visual.text} ${visual.ring} ${className}`}
    >
      {withIcon ? (
        <Icon className="h-3 w-3" aria-hidden="true" />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${visual.dot}`} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
