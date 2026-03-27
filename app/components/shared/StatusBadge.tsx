'use client';

type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'indigo' | 'violet';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const VARIANT_CLS: Record<BadgeVariant, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};

const SIZE_CLS = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-3 py-1 text-xs',
} as const;

export function StatusBadge({ label, variant = 'slate', size = 'sm', className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wider ${VARIANT_CLS[variant]} ${SIZE_CLS[size]} ${className}`}>
      {label}
    </span>
  );
}
