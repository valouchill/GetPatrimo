'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'emerald' | 'slate' | 'blue' | 'red' | 'amber';
  className?: string;
  label?: string;
}

const SIZE_CLS = {
  sm: 'w-5 h-5 border-2',
  md: 'w-10 h-10 border-4',
  lg: 'w-16 h-16 border-4',
} as const;

const COLOR_CLS = {
  emerald: 'border-emerald-200 border-t-emerald-600',
  slate: 'border-slate-200 border-t-slate-600',
  blue: 'border-blue-200 border-t-blue-600',
  red: 'border-red-200 border-t-red-500',
  amber: 'border-amber-200 border-t-amber-500',
} as const;

export function LoadingSpinner({ size = 'md', color = 'emerald', className = '', label }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`} role="status" aria-label={label || 'Chargement'}>
      <div className={`rounded-full animate-spin ${SIZE_CLS[size]} ${COLOR_CLS[color]}`} />
      {label && <p className="mt-3 text-sm text-slate-500">{label}</p>}
    </div>
  );
}
