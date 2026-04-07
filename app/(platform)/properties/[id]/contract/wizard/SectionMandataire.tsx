"use client";

import type { LeaseFormData } from "./types";

interface Props {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

export function SectionMandataire({ formData, onFieldChange }: Props) {
  const active = formData.hasMandataire === true;

  return (
    <div className="space-y-4">
      {/* Toggle mandataire */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={active}
          onClick={() => onFieldChange("hasMandataire", !active)}
          className={`relative mt-0.5 flex-shrink-0 h-5 w-9 rounded-full transition-colors ${
            active ? "bg-orange-500" : "bg-slate-200"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              active ? "translate-x-4" : ""
            }`}
          />
        </button>
        <div>
          <span className="text-sm font-medium text-slate-700">Le bail est géré par un mandataire</span>
          <p className="text-xs text-slate-500">Agent immobilier ou administrateur de biens</p>
        </div>
      </div>

      {active && (
        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Nom / Prénom</span>
              <input
                type="text"
                value={formData.mandataireNomPrenom ?? ""}
                onChange={(e) => onFieldChange("mandataireNomPrenom", e.target.value)}
                placeholder="Nom du mandataire"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Dénomination</span>
              <input
                type="text"
                value={formData.mandataireDenomination ?? ""}
                onChange={(e) => onFieldChange("mandataireDenomination", e.target.value)}
                placeholder="Raison sociale"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 mb-1 block">Adresse</span>
            <input
              type="text"
              value={formData.mandataireAdresse ?? ""}
              onChange={(e) => onFieldChange("mandataireAdresse", e.target.value)}
              placeholder="Adresse complète"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">Activité</span>
              <input
                type="text"
                value={formData.mandataireActivite ?? ""}
                onChange={(e) => onFieldChange("mandataireActivite", e.target.value)}
                placeholder="Ex: Gestion locative"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">N\u00b0 carte professionnelle</span>
              <input
                type="text"
                value={formData.mandataireCartePro ?? ""}
                onChange={(e) => onFieldChange("mandataireCartePro", e.target.value)}
                placeholder="CPI XXXX XXXX XXXX"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
              />
            </label>
          </div>

          {/* Société civile */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isSocieteCivile === true}
              onChange={(e) => onFieldChange("isSocieteCivile", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
            />
            <span className="text-sm text-slate-700">Le bailleur est une société civile</span>
          </label>
        </div>
      )}
    </div>
  );
}
