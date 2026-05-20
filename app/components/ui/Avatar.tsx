'use client';

/**
 * <Avatar> — Avatar à initiales avec gradient déterministe.
 *
 * Consolide les 2 versions précédentes :
 *  - app/components/shared/Avatar.tsx (générique)
 *  - dashboard/owner/components/ui.tsx (avec palette par ID)
 *
 * Génère un gradient stable depuis l'ID (ou le nom) pour qu'un même candidat
 * conserve la même couleur d'avatar à travers l'app.
 */

import * as React from 'react';

const AVATAR_PALETTE = [
  'from-emerald-500 to-teal-600',
  'from-teal-500 to-cyan-600',
  'from-cyan-500 to-blue-500',
  'from-amber-400 to-amber-500',
  'from-emerald-400 to-emerald-600',
  'from-slate-500 to-slate-700',
];

function pickGradient(id: string | number): string {
  const n =
    typeof id === 'string'
      ? id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
      : id;
  return AVATAR_PALETTE[Math.abs(n) % AVATAR_PALETTE.length];
}

function getInitials(name: string): string {
  return (
    (name || '?')
      .split(/\s+/)
      .map((part) => part[0] || '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

const SIZE_CLS: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'h-7 w-7 rounded-lg text-[10px]',
  sm: 'h-9 w-9 rounded-xl text-xs',
  md: 'h-11 w-11 rounded-xl text-sm',
  lg: 'h-14 w-14 rounded-2xl text-base',
};

export interface AvatarProps {
  name: string;
  /** ID stable pour générer un gradient déterministe (sinon basé sur le nom) */
  id?: string | number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Override du gradient (sinon dérivé de l'ID/nom) */
  gradient?: string;
  className?: string;
}

export function Avatar({
  name,
  id,
  size = 'md',
  gradient,
  className = '',
}: AvatarProps): React.ReactElement {
  const initials = getInitials(name);
  const gradientCls = gradient ?? pickGradient(id ?? name);

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white shadow-sm ${SIZE_CLS[size]} ${gradientCls} ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
