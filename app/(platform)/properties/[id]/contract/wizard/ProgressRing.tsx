'use client';

interface ProgressRingProps {
  filled: number;
  total: number;
  size?: number;
}

export function ProgressRing({ filled, total, size = 36 }: ProgressRingProps) {
  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f97316"
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[9px] font-bold text-slate-700">{percent}%</span>
    </div>
  );
}
