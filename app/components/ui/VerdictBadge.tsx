'use client';

/**
 * <VerdictBadge> — Badge unifié du verdict propriétaire.
 *
 * Source unique de vérité visuelle pour les 3 verdicts serveur :
 *   - recommended → ShieldCheck vert
 *   - review      → AlertTriangle ambre
 *   - risky       → AlertOctagon rouge
 *
 * Consomme VERDICT_STYLES depuis lib/verdict-system.ts (jamais redéfini).
 * Utilisé partout : TopCandidateCard, CandidateAuditModal, DecisionVerdict,
 * CandidateDetailDrawer, SelectionConfirmModal, TenantDashboardClient…
 */

import * as React from 'react';
import {
  VERDICT_STYLES,
  type ServerVerdict,
} from '@/lib/verdict-system';
import { labelForReason } from '@/lib/verdict-reasons';

export interface VerdictBadgeProps {
  /** Verdict serveur (déjà résolu via resolveVerdict si besoin) */
  verdict: ServerVerdict;
  /** Taille visuelle */
  size?: 'sm' | 'md' | 'lg';
  /** Affiche l'icône en plus du label */
  withIcon?: boolean;
  /** Affiche la première raison sous le badge (audit context) */
  showFirstReason?: boolean;
  /** Liste des reason codes (utile si showFirstReason=true) */
  reasonCodes?: string[];
  /** Classes additionnelles */
  className?: string;
}

const SIZE_CLS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

const ICON_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export function VerdictBadge({
  verdict,
  size = 'md',
  withIcon = true,
  showFirstReason = false,
  reasonCodes,
  className = '',
}: VerdictBadgeProps): React.ReactElement {
  const style = VERDICT_STYLES[verdict];
  const Icon = style.icon;
  const firstReason =
    showFirstReason && reasonCodes && reasonCodes.length > 0
      ? labelForReason(reasonCodes[0])
      : null;

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-pill font-bold uppercase tracking-wider ring-1 ${style.badgeBg} ${style.badgeText} ${style.badgeRing} ${SIZE_CLS[size]}`}
        aria-label={`Verdict : ${style.label}`}
      >
        {withIcon && <Icon className={ICON_SIZE[size]} aria-hidden="true" />}
        {style.label}
      </span>
      {firstReason && (
        <p className="text-[11px] text-slate-600 italic">{firstReason}</p>
      )}
    </div>
  );
}
