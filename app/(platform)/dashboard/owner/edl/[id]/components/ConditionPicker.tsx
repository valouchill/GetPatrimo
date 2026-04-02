'use client';

// Labels conformes au décret n°2016-382 du 30 mars 2016
type ConditionType = 'TRES_BON' | 'BON' | 'USAGE_NORMAL' | 'MAUVAIS_ETAT' | 'HORS_SERVICE';

const CONDITIONS: { value: ConditionType; label: string; active: string; inactive: string }[] = [
  { value: 'TRES_BON', label: 'Très bon', active: 'bg-emerald-500 text-white border-emerald-500', inactive: 'border-emerald-200 text-emerald-700 bg-emerald-50/50' },
  { value: 'BON', label: 'Bon', active: 'bg-teal-500 text-white border-teal-500', inactive: 'border-teal-200 text-teal-700 bg-teal-50/50' },
  { value: 'USAGE_NORMAL', label: 'Usure normale', active: 'bg-blue-500 text-white border-blue-500', inactive: 'border-blue-200 text-blue-700 bg-blue-50/50' },
  { value: 'MAUVAIS_ETAT', label: 'Mauvais état', active: 'bg-amber-500 text-white border-amber-500', inactive: 'border-amber-200 text-amber-700 bg-amber-50/50' },
  { value: 'HORS_SERVICE', label: 'Hors service', active: 'bg-red-500 text-white border-red-500', inactive: 'border-red-200 text-red-700 bg-red-50/50' },
];

export default function ConditionPicker({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? '' : 'space-y-2'}>
      {!compact && <p className="text-sm font-semibold text-slate-700">{label}</p>}
      <div className={compact ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-2 sm:grid-cols-3 gap-2'}>
        {CONDITIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            className={`rounded-2xl border-2 font-semibold transition-all ${
              compact ? 'px-3 py-1.5 text-xs' : 'min-h-[48px] px-4 py-2.5 text-sm'
            } ${value === c.value ? c.active : c.inactive}`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
