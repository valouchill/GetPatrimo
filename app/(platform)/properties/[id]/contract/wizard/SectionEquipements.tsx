"use client";

import type { LeaseFormData } from "./types";

interface Props {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

type CheckItem = {
  key: string;
  label: string;
  hasNumero?: boolean;
  numeroKey?: string;
  numeroPlaceholder?: string;
};

const PRIVATE_ITEMS: CheckItem[] = [
  { key: "balcony", label: "Balcon" },
  { key: "terrace", label: "Terrasse" },
  { key: "garden", label: "Jardin" },
  { key: "loggia", label: "Loggia" },
  { key: "caveNumero", label: "Cave", hasNumero: true, numeroKey: "caveNumero", numeroPlaceholder: "N\u00b0 cave" },
  { key: "garageNumero", label: "Garage", hasNumero: true, numeroKey: "garageNumero", numeroPlaceholder: "N\u00b0 garage" },
  { key: "parkingNumber", label: "Parking", hasNumero: true, numeroKey: "parkingNumber", numeroPlaceholder: "N\u00b0 parking" },
  { key: "garageVelo", label: "Garage vélo" },
  { key: "grenier", label: "Grenier" },
  { key: "comble", label: "Combles" },
];

const COMMON_ITEMS: CheckItem[] = [
  { key: "ascenseur", label: "Ascenseur" },
  { key: "espacesVerts", label: "Espaces verts" },
  { key: "gardiennage", label: "Gardiennage" },
  { key: "laverie", label: "Laverie" },
  { key: "localPoubelle", label: "Local poubelle" },
  { key: "airesJeux", label: "Aires de jeux" },
];

function isNumeroField(key: string): boolean {
  return ["caveNumero", "garageNumero", "parkingNumber"].includes(key);
}

function getChecked(formData: LeaseFormData, key: string): boolean {
  if (isNumeroField(key)) {
    return Boolean((formData as Record<string, unknown>)[key]);
  }
  return Boolean((formData as Record<string, unknown>)[key]);
}

export function SectionEquipements({ formData, onFieldChange }: Props) {
  const toggleCheck = (item: CheckItem) => {
    if (item.hasNumero && item.numeroKey) {
      const current = (formData as Record<string, unknown>)[item.numeroKey];
      onFieldChange(item.numeroKey, current ? "" : " ");
    } else {
      const current = (formData as Record<string, unknown>)[item.key];
      onFieldChange(item.key, !current);
    }
  };

  return (
    <div className="space-y-4">
      {/* Parties privatives */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Parties privatives</h4>
        <div className="grid grid-cols-2 gap-2">
          {PRIVATE_ITEMS.map((item) => {
            const checked = getChecked(formData, item.hasNumero ? item.numeroKey! : item.key);
            return (
              <div key={item.key} className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheck(item)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
                  />
                  <span className="text-sm text-slate-700">{item.label}</span>
                </label>
                {item.hasNumero && checked && (
                  <input
                    type="text"
                    value={String((formData as Record<string, unknown>)[item.numeroKey!] || "").trim()}
                    onChange={(e) => onFieldChange(item.numeroKey!, e.target.value || " ")}
                    placeholder={item.numeroPlaceholder}
                    className="ml-6 w-32 rounded border border-slate-200 px-2 py-1 text-xs focus:ring-1 focus:ring-amber-300 focus:border-amber-400 outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Parties communes */}
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Parties communes</h4>
        <div className="grid grid-cols-2 gap-2">
          {COMMON_ITEMS.map((item) => {
            const checked = Boolean((formData as Record<string, unknown>)[item.key]);
            return (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onFieldChange(item.key, !checked)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
                />
                <span className="text-sm text-slate-700">{item.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Autres */}
      <label className="block">
        <span className="text-xs font-medium text-slate-600 mb-1 block">Autres parties communes</span>
        <input
          type="text"
          value={formData.partiesCommunesAutres ?? ""}
          onChange={(e) => onFieldChange("partiesCommunesAutres", e.target.value)}
          placeholder="Ex: local à vélo, piscine..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600 mb-1 block">Autres accessoires</span>
        <input
          type="text"
          value={formData.accessoireAutre ?? ""}
          onChange={(e) => onFieldChange("accessoireAutre", e.target.value)}
          placeholder="Ex: antenne TV, parabole..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none"
        />
      </label>
    </div>
  );
}
