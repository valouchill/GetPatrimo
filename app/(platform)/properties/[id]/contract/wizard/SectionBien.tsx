'use client';

import { Home, CheckCircle2 } from 'lucide-react';
import type { PropertyRecord } from './types';

interface SectionBienProps {
  property: PropertyRecord | null;
}

export function SectionBien({ property }: SectionBienProps) {
  if (!property) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
          <Home className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Bien</h3>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Auto-rempli
          </span>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">Nom</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{property.name || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Adresse</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{property.address || '—'}</dd>
        </div>
        {property.surfaceM2 ? (
          <div>
            <dt className="text-xs font-medium text-slate-500">Surface</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{property.surfaceM2} m²</dd>
          </div>
        ) : null}
        {property.type ? (
          <div>
            <dt className="text-xs font-medium text-slate-500">Type</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{property.type}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
