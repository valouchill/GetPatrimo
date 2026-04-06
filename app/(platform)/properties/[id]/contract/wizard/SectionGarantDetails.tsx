"use client";

import type { ApplicationRecord, LeaseFormData } from "./types";

interface Props {
  formData: LeaseFormData;
  selectedApplication: ApplicationRecord | null;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

export function SectionGarantDetails({ formData, selectedApplication, onFieldChange }: Props) {
  const guaranteeLabel = selectedApplication?.ownerInsights?.guarantee?.label;
  const guaranteeSummary = selectedApplication?.ownerInsights?.guarantee?.summary;
  const overrides = formData.guarantorOverrides ?? {};

  const handleOverride = (key: string, value: string) => {
    onFieldChange("guarantorOverrides", {
      ...overrides,
      [key]: value,
    } as unknown as string);
  };

  return (
    <div className="space-y-4">
      {/* Infos de la garantie (lecture seule) */}
      {guaranteeLabel && (
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Type de garantie</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              Auto-rempli
            </span>
          </div>
          <p className="text-sm font-medium text-slate-800 mt-1">{guaranteeLabel}</p>
          {guaranteeSummary && <p className="text-xs text-slate-500 mt-0.5">{guaranteeSummary}</p>}
        </div>
      )}

      {/* Champs \u00e9ditables du garant */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600 mb-1 block">Pr\u00e9nom du garant</span>
          <input
            type="text"
            value={overrides.firstName ?? ""}
            onChange={(e) => handleOverride("firstName", e.target.value)}
            placeholder="Pr\u00e9nom"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 mb-1 block">Nom du garant</span>
          <input
            type="text"
            value={overrides.lastName ?? ""}
            onChange={(e) => handleOverride("lastName", e.target.value)}
            placeholder="Nom"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-600 mb-1 block">Adresse du garant</span>
        <input
          type="text"
          value={overrides.address ?? ""}
          onChange={(e) => handleOverride("address", e.target.value)}
          placeholder="Adresse compl\u00e8te"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600 mb-1 block">Code postal</span>
          <input
            type="text"
            value={overrides.zipCode ?? ""}
            onChange={(e) => handleOverride("zipCode", e.target.value)}
            placeholder="Code postal"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 mb-1 block">Ville</span>
          <input
            type="text"
            value={overrides.city ?? ""}
            onChange={(e) => handleOverride("city", e.target.value)}
            placeholder="Ville"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-600 mb-1 block">Date de naissance</span>
        <input
          type="date"
          value={overrides.birthDate ?? ""}
          onChange={(e) => handleOverride("birthDate", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
        />
      </label>
    </div>
  );
}
