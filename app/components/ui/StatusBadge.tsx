'use client';

/**
 * <StatusBadge> — Badge de statut (document, dossier, audit).
 *
 * Promu depuis app/components/shared/StatusBadge.tsx avec :
 *  - Support icône Lucide optionnelle (via prop `status` qui résout via icon-system)
 *  - Variants alignés sur design-tokens.verdictColors / uploadStateColors
 *  - Tailles sm/md
 *
 * Usage typique côté tunnel apply :
 *   <StatusBadge status="CERTIFIED" />  → ShieldCheck + "Certifié"
 *   <StatusBadge status="ANALYZING" /> → Loader2 + "Analyse en cours"
 *
 * Usage générique :
 *   <StatusBadge label="Validé" variant="green" />
 */

import * as React from 'react';
import {
  ICON_BY_STATUS,
  normalizeDocumentStatus,
  type DocumentStatus,
} from '@/lib/icon-system';
import type { LucideIcon } from 'lucide-react';

export type BadgeVariant =
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'slate'
  | 'indigo'
  | 'violet';

interface BaseProps {
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusBadgePropsWithStatus extends BaseProps {
  /** Statut document (auto-résolu vers icône + couleur + label) */
  status: DocumentStatus | string;
  label?: string;
  variant?: never;
  icon?: never;
}

interface StatusBadgePropsExplicit extends BaseProps {
  status?: never;
  label: string;
  variant?: BadgeVariant;
  icon?: LucideIcon;
}

export type StatusBadgeProps =
  | StatusBadgePropsWithStatus
  | StatusBadgePropsExplicit;

const VARIANT_CLS: Record<BadgeVariant, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};

const SIZE_CLS: Record<'sm' | 'md', string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
};

const ICON_SIZE: Record<'sm' | 'md', string> = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
};

export function DocumentStatusBadge(props: StatusBadgeProps): React.ReactElement {
  const size = props.size ?? 'sm';
  const sizeCls = SIZE_CLS[size];
  const iconSize = ICON_SIZE[size];

  // Mode "status" : résout depuis icon-system
  if ('status' in props && props.status) {
    const normalized = normalizeDocumentStatus(props.status as string);
    const visual = ICON_BY_STATUS[normalized];
    const Icon = visual.icon;
    const label = props.label ?? visual.label;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-pill border font-bold uppercase tracking-wider ${visual.bg} ${visual.text} ${visual.ring} ${sizeCls} ${props.className ?? ''}`}
      >
        <Icon
          className={`${iconSize} ${normalized === 'ANALYZING' ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {label}
      </span>
    );
  }

  // Mode "explicit" : variant + label + icon optionnels
  const variant = (props.variant ?? 'slate') as BadgeVariant;
  const Icon = props.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border font-bold uppercase tracking-wider ${VARIANT_CLS[variant]} ${sizeCls} ${props.className ?? ''}`}
    >
      {Icon && <Icon className={iconSize} aria-hidden="true" />}
      {props.label}
    </span>
  );
}
