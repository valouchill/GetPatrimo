"use client";

import type { LeaseFormData } from "./types";

interface Props {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 flex-shrink-0 h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-orange-500" : "bg-slate-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
      <div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function SectionRevision({ formData, onFieldChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Révision IRL */}
      <Toggle
        label="Révision annuelle du loyer (IRL)"
        checked={formData.loyerRevise === true}
        onChange={(v) => onFieldChange("loyerRevise", v)}
        hint="Indexation sur l’Indice de Référence des Loyers"
      />

      {formData.loyerRevise && (
        <div className="ml-12 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Indice IRL de référence</span>
              <input
                type="text"
                value={formData.irlReference ?? ""}
                onChange={(e) => onFieldChange("irlReference", e.target.value)}
                placeholder="Ex: 142.06"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Date de référence IRL</span>
              <input
                type="text"
                value={formData.irlReferenceDate ?? ""}
                onChange={(e) => onFieldChange("irlReferenceDate", e.target.value)}
                placeholder="Ex: 4e trim. 2025"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Trimestre de référence</span>
            <input
              type="text"
              value={formData.irlQuarterReference ?? ""}
              onChange={(e) => onFieldChange("irlQuarterReference", e.target.value)}
              placeholder="Ex: 4ème trimestre 2025"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
            />
          </label>
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        {/* Encadrement des loyers */}
        <Toggle
          label="Soumis à l’encadrement des loyers"
          checked={formData.soumisDecretRelocation === true}
          onChange={(v) => onFieldChange("soumisDecretRelocation", v)}
          hint="Décret de référence des loyers (zones tendues)"
        />

        {formData.soumisDecretRelocation && (
          <div className="ml-12 mt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Loyer de référence (€/m²)</span>
                <input
                  type="text"
                  value={formData.loyerReference ?? ""}
                  onChange={(e) => onFieldChange("loyerReference", e.target.value)}
                  placeholder="Ex: 12.50"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Loyer de réf. majoré (€/m²)</span>
                <input
                  type="text"
                  value={formData.loyerReferenceMajore ?? ""}
                  onChange={(e) => onFieldChange("loyerReferenceMajore", e.target.value)}
                  placeholder="Ex: 15.00"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
                />
              </label>
            </div>

            <Toggle
              label="Complément de loyer"
              checked={formData.soumisLoyerReferenceMajore === true}
              onChange={(v) => onFieldChange("soumisLoyerReferenceMajore", v)}
              hint="Le loyer dépasse le loyer de référence majoré"
            />

            {formData.soumisLoyerReferenceMajore && (
              <label className="block ml-12 animate-in slide-in-from-top-2 duration-200">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Justification du complément</span>
                <input
                  type="text"
                  value={formData.complementLoyer ?? ""}
                  onChange={(e) => onFieldChange("complementLoyer", e.target.value)}
                  placeholder="Ex: Vue exceptionnelle, terrasse..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
