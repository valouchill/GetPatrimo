"use client";

import type { LeaseFormData } from "./types";

interface SectionClausesProps {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

export function SectionClauses({ formData, onFieldChange }: SectionClausesProps) {
  return (
    <div className="space-y-4">
      {/* Checkboxes structur\u00e9s */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usage & conditions</h4>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={formData.usageMixte === true}
            onChange={(e) => onFieldChange("usageMixte", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Usage mixte (habitation + professionnel)</span>
            <p className="text-xs text-slate-500">Par d\u00e9faut : usage exclusif d&apos;habitation</p>
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={formData.petsAllowed === true}
            onChange={(e) => onFieldChange("petsAllowed", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Animaux domestiques autoris\u00e9s</span>
            <p className="text-xs text-slate-500">
              Note : la loi interdit d&apos;interdire la d\u00e9tention d&apos;animaux domestiques (sauf nuisances)
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={formData.sublettingAllowed === true}
            onChange={(e) => onFieldChange("sublettingAllowed", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Sous-location autoris\u00e9e</span>
            <p className="text-xs text-slate-500">
              Par d\u00e9faut : la sous-location est interdite sans accord \u00e9crit du bailleur
            </p>
          </div>
        </label>
      </div>

      {/* Textarea libre */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Clauses particuli\u00e8res libres
        </h4>
        <textarea
          id="field-autres_conditions_particulieres"
          value={formData.clauses}
          onChange={(e) => onFieldChange("clauses", e.target.value)}
          placeholder="Ajoutez vos clauses particuli\u00e8res ici..."
          className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none resize-y"
        />
        <p className="mt-1 text-xs text-slate-400">
          {formData.clauses.length}/2000 caract\u00e8res
        </p>
      </div>
    </div>
  );
}
