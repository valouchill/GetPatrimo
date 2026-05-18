"use client";

import type { LeaseFormData } from "./types";

interface SectionClausesProps {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

export function SectionClauses({ formData, onFieldChange }: SectionClausesProps) {
  return (
    <div className="space-y-4">
      {/* Checkboxes structurés */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Usage & conditions</h4>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={formData.usageMixte === true}
            onChange={(e) => onFieldChange("usageMixte", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Usage mixte (habitation + professionnel)</span>
            <p className="text-xs text-slate-500">Par défaut : usage exclusif d&apos;habitation</p>
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={formData.petsAllowed === true}
            onChange={(e) => onFieldChange("petsAllowed", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Animaux domestiques autorisés</span>
            <p className="text-xs text-slate-500">
              Note : la loi interdit d&apos;interdire la détention d&apos;animaux domestiques (sauf nuisances)
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
          <input
            type="checkbox"
            checked={formData.sublettingAllowed === true}
            onChange={(e) => onFieldChange("sublettingAllowed", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Sous-location autorisée</span>
            <p className="text-xs text-slate-500">
              Par défaut : la sous-location est interdite sans accord écrit du bailleur
            </p>
          </div>
        </label>
      </div>

      {/* Textarea libre */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Clauses particulières libres
        </h4>
        <textarea
          id="field-autres_conditions_particulieres"
          value={formData.clauses}
          onChange={(e) => onFieldChange("clauses", e.target.value)}
          placeholder="Ajoutez vos clauses particulières ici..."
          className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-amber-300 focus:ring-2 focus:ring-amber-100 outline-none resize-y"
        />
        <p className="mt-1 text-xs text-slate-400">
          {formData.clauses.length}/2000 caractères
        </p>
      </div>
    </div>
  );
}
