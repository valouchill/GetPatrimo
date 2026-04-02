'use client';

import { Building2, MapPin, TrendingUp } from 'lucide-react';
import { StagePill, Tag, type LocalBien } from './ui';
import { PropertyCardMenu } from './PropertyCardMenu';

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  CANDIDATE_SELECTION: 'En recherche',
  LEASE_IN_PROGRESS: 'Bail en cours',
  OCCUPIED: 'Occupé',
  VACANT: 'Vacant',
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'bg-blue-50 text-blue-700 border-blue-200',
  CANDIDATE_SELECTION: 'bg-amber-50 text-amber-700 border-amber-200',
  LEASE_IN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
  OCCUPIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VACANT: 'bg-red-50 text-red-700 border-red-200',
};

const PROP_TYPE_LABEL: Record<string, string> = {
  APPARTEMENT: 'Appartement',
  MAISON: 'Maison',
  STUDIO: 'Studio',
  LOFT: 'Loft',
  LOCAL_COMMERCIAL: 'Local',
  GARAGE: 'Garage',
  AUTRE: 'Autre',
};

export function PropertyTable({
  biens,
  onViewProperty,
  onEditProperty,
  onDeleteProperty,
}: {
  biens: LocalBien[];
  onViewProperty: (id: string) => void;
  onEditProperty?: (id: string) => void;
  onDeleteProperty?: (id: string) => void;
}) {
  return (
    <>
      {/* ── Desktop table ─────────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <Th>Bien</Th>
                <Th>Type</Th>
                <Th className="text-right">Surface</Th>
                <Th className="text-right">Loyer</Th>
                <Th>Statut</Th>
                <Th>Locataire</Th>
                <Th className="text-right">Rentabilité</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {biens.map((b) => (
                <tr
                  key={b.id}
                  className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => onViewProperty(b.id)}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                        <Building2 className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{b.label}</div>
                        <div className="flex items-center gap-1 truncate text-xs text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {b.adresse}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600">
                    {PROP_TYPE_LABEL[b.propertyType || ''] || '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm text-slate-600">
                    {b.surface > 0 ? `${b.surface} m²` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm font-semibold text-slate-900">{b.loyer.toLocaleString('fr-FR')} €</span>
                    <span className="text-xs text-slate-500">/mois</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[b.status || ''] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[b.status || ''] || b.flowStageLabel || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600">
                    {b.tenantLabel || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {b.grossYield ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {b.grossYield}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    {onEditProperty && onDeleteProperty ? (
                      <PropertyCardMenu
                        bienId={b.id}
                        bienLabel={b.label}
                        onEdit={() => onEditProperty(b.id)}
                        onDelete={() => onDeleteProperty(b.id)}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile cards ──────────────────────────────────────── */}
      <div className="space-y-3 md:hidden">
        {biens.map((b) => (
          <div
            key={b.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 active:scale-[0.98] transition-transform cursor-pointer"
            onClick={() => onViewProperty(b.id)}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                  <Building2 className="h-5 w-5 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">{b.label}</div>
                  <div className="flex items-center gap-1 truncate text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {b.adresse}
                  </div>
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                {onEditProperty && onDeleteProperty && (
                  <PropertyCardMenu
                    bienId={b.id}
                    bienLabel={b.label}
                    onEdit={() => onEditProperty(b.id)}
                    onDelete={() => onDeleteProperty(b.id)}
                  />
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold text-slate-900">{b.loyer.toLocaleString('fr-FR')} €<span className="text-xs font-normal text-slate-500">/mois</span></span>
                {b.surface > 0 && <span className="text-slate-400">·</span>}
                {b.surface > 0 && <span className="text-slate-600">{b.surface} m²</span>}
                {PROP_TYPE_LABEL[b.propertyType || ''] && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{PROP_TYPE_LABEL[b.propertyType || '']}</span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[b.status || ''] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {STATUS_LABEL[b.status || ''] || b.flowStageLabel || '—'}
              </span>
              {b.tenantLabel && (
                <span className="truncate text-xs text-slate-500">{b.tenantLabel}</span>
              )}
              {b.grossYield && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  <TrendingUp className="h-3 w-3" />
                  {b.grossYield}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
  );
}
