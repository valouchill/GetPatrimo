'use client';

import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { ApplicationRecord } from './types';

interface SectionGarantProps {
  selectedApplication: ApplicationRecord | null;
}

export function SectionGarant({ selectedApplication }: SectionGarantProps) {
  const guarantee = selectedApplication?.ownerInsights?.guarantee;
  const guaranteeMode = selectedApplication?.guarantee?.mode;

  if (!guarantee?.label || guaranteeMode === 'NONE') return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
          <ShieldCheck className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Garant</h3>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Auto-rempli
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">{guarantee.label}</div>
        {guarantee.summary && (
          <p className="mt-1 text-xs text-slate-500">{guarantee.summary}</p>
        )}
      </div>
    </div>
  );
}
