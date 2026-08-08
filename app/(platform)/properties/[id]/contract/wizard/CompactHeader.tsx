'use client';

import { ArrowLeft, FileText } from 'lucide-react';
import { ProgressRing } from './ProgressRing';

interface CompactHeaderProps {
  propertyName: string;
  propertyAddress: string;
  tenantName: string;
  leaseType: string;
  filledCount: number;
  totalCount: number;
  selectionRequired: boolean;
  contractLocked: boolean;
  onBack: () => void;
}

const LEASE_LABELS: Record<string, string> = {
  VIDE: 'Vide',
  MEUBLE: 'Meublé',
  MOBILITE: 'Mobilité',
  GARAGE_PARKING: 'Garage',
};

export function CompactHeader({
  propertyName,
  propertyAddress,
  tenantName,
  leaseType,
  filledCount,
  totalCount,
  selectionRequired,
  contractLocked,
  onBack,
}: CompactHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="font-serif text-base font-semibold text-emerald-900 truncate">
              {propertyName || propertyAddress || 'Bien'}
            </span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-slate-200" />

          {tenantName ? (
            <span className="hidden sm:block text-sm text-slate-600 truncate">
              {tenantName}
            </span>
          ) : null}

          <div className="hidden sm:block h-4 w-px bg-slate-200" />

          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            {LEASE_LABELS[leaseType] || leaseType}
          </span>

          <div className="ml-auto flex items-center gap-3">
            <div
              className="flex items-center gap-2"
              role="img"
              aria-label={`${filledCount} champs du bail remplis sur ${totalCount}`}
            >
              <ProgressRing filled={filledCount} total={totalCount} />
              <span className="hidden lg:block text-xs text-slate-500">
                {filledCount}/{totalCount}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile : le contexte (locataire, type de bail, compteur) était
            entièrement masqué sous sm — seul un anneau sans libellé restait. */}
        {(tenantName || leaseType) && (
          <div className="flex items-center gap-2 border-t border-slate-100 px-4 pb-2 pt-1.5 text-xs text-slate-500 sm:hidden">
            {tenantName && <span className="min-w-0 truncate font-medium text-slate-700">{tenantName}</span>}
            {tenantName && <span aria-hidden="true">·</span>}
            <span>{LEASE_LABELS[leaseType] || leaseType}</span>
            <span className="ml-auto tabular-nums">{filledCount}/{totalCount} champs</span>
          </div>
        )}
      </header>

      {selectionRequired ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          Sélectionnez d&apos;abord un dossier depuis la fiche bien avant de préparer le bail.
        </div>
      ) : contractLocked ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          Le dossier sélectionné est sous scellé. Déverrouillez-le depuis la fiche bien.
        </div>
      ) : null}
    </>
  );
}
