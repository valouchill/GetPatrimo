'use client';

/**
 * <Tag> — Étiquette générique colorée.
 *
 * Promu depuis dashboard/owner/components/ui.tsx pour usage partagé.
 * 7 variants alignés sur les couleurs des design tokens.
 *
 * Pour des verdicts métier (recommended/review/risky), préférer <VerdictBadge>.
 * Pour un statut document, préférer <StatusBadge>.
 */

import * as React from 'react';

export type TagType =
  | 'slate'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'indigo'
  | 'violet';

export const TAG_CLS: Record<TagType, string> = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200',
  red: 'bg-red-50 text-red-700 border border-red-200',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  indigo: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  violet: 'bg-teal-50 text-teal-700',
};

export interface TagProps {
  children: React.ReactNode;
  type?: TagType;
  className?: string;
}

export function Tag({
  children,
  type = 'slate',
  className = '',
}: TagProps): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${TAG_CLS[type]} ${className}`}
    >
      {children}
    </span>
  );
}
