'use client';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  gradient?: string;
  className?: string;
}

const SIZE_CLS = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
} as const;

export function Avatar({ name, size = 'md', gradient = 'from-emerald-500 to-teal-600', className = '' }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .map(w => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

  return (
    <div
      className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white shadow-sm ${SIZE_CLS[size]} ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
