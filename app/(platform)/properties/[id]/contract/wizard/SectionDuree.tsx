'use client';

import { Calendar, CheckCircle2 } from 'lucide-react';
import type { LeaseFormData } from './types';

const { getTomorrowDateInputValue } = require('@/src/utils/leaseWizardShared');

interface SectionDureeProps {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number) => void;
}

function computeEndDate(startDate: string, durationMonths: number): string {
  if (!startDate || !durationMonths) return '—';
  try {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + durationMonths);
    return date.toLocaleDateString('fr-FR');
  } catch {
    return '—';
  }
}

export function SectionDuree({ formData, onFieldChange }: SectionDureeProps) {
  const endDate = computeEndDate(formData.startDate, formData.durationMonths);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
          <Calendar className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Durée et dates</h3>
          <p className="text-xs text-slate-500">Début, durée et fin du bail</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="field-date_debut_location" className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Date de début
          </label>
          <input
            id="field-date_debut_location"
            type="date"
            value={formData.startDate}
            min={getTomorrowDateInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000))}
            onChange={(e) => onFieldChange('startDate', e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
          />
        </div>

        <div>
          <label htmlFor="field-duree_bail_mois" className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Durée
          </label>
          <div className="relative">
            <input
              id="field-duree_bail_mois"
              type="number"
              min={1}
              value={formData.durationMonths}
              onChange={(e) => onFieldChange('durationMonths', Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-14 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">mois</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Date de fin</label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <span className="text-sm text-slate-700">{endDate}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Calculé
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
