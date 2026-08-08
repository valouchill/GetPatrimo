"use client";

import { ExternalLink } from "lucide-react";
import { getLatestIrl, ZONE_TENDUE_SIMULATOR_URL } from "@/lib/lease/irl";
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
          checked ? "bg-amber-500" : "bg-slate-200"
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
  const latestIrl = getLatestIrl();

  // À l'activation de la révision, on pré-remplit le dernier IRL publié par
  // l'INSEE : chaque bailleur devait le chercher sur Google. Prefill uniquement
  // si les champs sont vides — un choix explicite garde toujours la main.
  const handleReviseToggle = (v: boolean) => {
    onFieldChange("loyerRevise", v);
    if (v && latestIrl && !formData.irlReference) {
      onFieldChange("irlReference", latestIrl.value);
      onFieldChange("irlQuarterReference", latestIrl.quarter);
      onFieldChange("irlReferenceDate", latestIrl.quarter);
    }
  };

  return (
    <div className="space-y-4">
      {/* Révision IRL */}
      <Toggle
        label="Révision annuelle du loyer (IRL)"
        checked={formData.loyerRevise === true}
        onChange={handleReviseToggle}
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
                placeholder={latestIrl ? `Ex: ${latestIrl.value}` : "Ex: 148,37"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
              />
              {latestIrl && formData.irlReference === latestIrl.value && (
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  ✓ Dernier indice publié par l&apos;INSEE ({latestIrl.quarter})
                </p>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Date de référence IRL</span>
              <input
                type="text"
                value={formData.irlReferenceDate ?? ""}
                onChange={(e) => onFieldChange("irlReferenceDate", e.target.value)}
                placeholder="Ex: 4e trim. 2025"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
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
        <a
          href={ZONE_TENDUE_SIMULATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-12 mt-1.5 inline-flex items-center gap-1 text-xs text-slate-500 underline decoration-slate-300 hover:text-emerald-700"
        >
          Vérifier si ma commune est en zone tendue (simulateur officiel)
          <ExternalLink className="h-3 w-3" />
        </a>

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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">Loyer de réf. majoré (€/m²)</span>
                <input
                  type="text"
                  value={formData.loyerReferenceMajore ?? ""}
                  onChange={(e) => onFieldChange("loyerReferenceMajore", e.target.value)}
                  placeholder="Ex: 15.00"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
                />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
