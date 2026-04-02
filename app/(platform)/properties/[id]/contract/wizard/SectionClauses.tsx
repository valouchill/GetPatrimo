'use client';

import { ScrollText } from 'lucide-react';
import type { LeaseFormData } from './types';

interface SectionClausesProps {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number) => void;
}

export function SectionClauses({ formData, onFieldChange }: SectionClausesProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
          <ScrollText className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Clauses particulières</h3>
          <p className="text-xs text-slate-500">Conditions spécifiques, équipements, mentions complémentaires</p>
        </div>
      </div>

      <textarea
        id="field-autres_conditions_particulieres"
        value={formData.clauses}
        onChange={(e) => onFieldChange('clauses', e.target.value)}
        placeholder="Ajoutez vos clauses particulières ici..."
        className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none resize-y"
      />
    </div>
  );
}
