'use client';

import { User, CheckCircle2, ArrowLeft } from 'lucide-react';
import type { ApplicationRecord, CandidatureRecord } from './types';

interface SectionLocataireProps {
  selectedApplication: ApplicationRecord | null;
  legacyCandidature: CandidatureRecord | null;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantIncome: number;
  selectionRequired: boolean;
  contractLocked: boolean;
  onReturnToComparison: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value || 'Non renseigné'}</dd>
    </div>
  );
}

export function SectionLocataire({
  selectedApplication,
  legacyCandidature,
  tenantName,
  tenantEmail,
  tenantPhone,
  tenantIncome,
  selectionRequired,
  contractLocked,
  onReturnToComparison,
}: SectionLocataireProps) {
  if (selectionRequired || contractLocked) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <User className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-800">
              {selectionRequired ? 'Aucun locataire sélectionné' : 'Dossier sous scellé'}
            </h3>
            <p className="mt-1 text-sm text-amber-700">
              {selectionRequired
                ? 'Retournez à la fiche bien pour sélectionner un candidat.'
                : 'Déverrouillez le dossier depuis la fiche bien pour continuer.'}
            </p>
            <button
              type="button"
              onClick={onReturnToComparison}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour à la fiche bien
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedApplication && !legacyCandidature) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
          <User className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Locataire</h3>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Auto-rempli
          </span>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <InfoRow label="Nom complet" value={tenantName} />
        <InfoRow label="Email" value={tenantEmail} />
        <InfoRow label="Téléphone" value={tenantPhone} />
        <InfoRow label="Revenus mensuels" value={tenantIncome ? `${tenantIncome.toLocaleString('fr-FR')} €` : 'Non renseigné'} />
      </dl>

      {selectedApplication?.ownerInsights?.financial?.effortRateLabel && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Taux d'effort</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{selectedApplication.ownerInsights.financial.effortRateLabel}</div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Reste à vivre</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{selectedApplication.ownerInsights?.financial?.remainingIncomeLabel || '—'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Garantie</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{selectedApplication.ownerInsights?.guarantee?.label || 'Sans garant'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
