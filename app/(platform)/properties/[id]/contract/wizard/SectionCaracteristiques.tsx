"use client";

import type { LeaseFormData, PropertyRecord } from "./types";

interface Props {
  formData: LeaseFormData;
  property: PropertyRecord | null;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

const DPE_CLASSES = ["A", "B", "C", "D", "E", "F", "G"];

const HEATING_OPTIONS = [
  { value: "individuel gaz", label: "Individuel gaz" },
  { value: "individuel \u00e9lectrique", label: "Individuel \u00e9lectrique" },
  { value: "collectif gaz", label: "Collectif gaz" },
  { value: "collectif \u00e9lectrique", label: "Collectif \u00e9lectrique" },
  { value: "collectif urbain", label: "Collectif urbain (r\u00e9seau de chaleur)" },
  { value: "individuel fioul", label: "Individuel fioul" },
  { value: "individuel pompe \u00e0 chaleur", label: "Individuel pompe \u00e0 chaleur" },
  { value: "autre", label: "Autre" },
];

const HOT_WATER_OPTIONS = [
  { value: "individuelle \u00e9lectrique", label: "Individuelle \u00e9lectrique" },
  { value: "individuelle gaz", label: "Individuelle gaz" },
  { value: "collective", label: "Collective" },
  { value: "individuelle thermodynamique", label: "Individuelle thermodynamique" },
  { value: "autre", label: "Autre" },
];

function AutoBadge() {
  return (
    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
      Auto-rempli
    </span>
  );
}

export function SectionCaracteristiques({ formData, property, onFieldChange }: Props) {
  const hasDefault = (key: string) => {
    const propMap: Record<string, unknown> = {
      surfaceHabitable: property?.surfaceM2 ?? property?.surfaceHabitableM2,
      rooms: property?.rooms ?? property?.nbPieces,
      typeHabitat: property?.habitatType,
      constructionYear: property?.constructionYear ?? property?.yearBuilt,
      dpeClass: property?.dpeClass,
      dpeDate: property?.dpeDate,
      energyEstimate: property?.energyEstimate,
      modeChauffage: property?.heatingMode ?? property?.heatingType,
      modeEauChaude: property?.hotWaterMode,
      regimeJuridique: property?.legalRegime,
    };
    return propMap[key] !== undefined && propMap[key] !== null && propMap[key] !== "";
  };

  return (
    <div className="space-y-4">
      {/* Surface & Pi\u00e8ces */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1">
            Surface habitable (m\u00b2) {hasDefault("surfaceHabitable") && <AutoBadge />}
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={formData.surfaceHabitable ?? ""}
            onChange={(e) => onFieldChange("surfaceHabitable", Number(e.target.value) || 0)}
            placeholder="Ex: 45"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1">
            Nb pi\u00e8ces principales {hasDefault("rooms") && <AutoBadge />}
          </span>
          <input
            type="number"
            min={1}
            value={formData.rooms ?? ""}
            onChange={(e) => onFieldChange("rooms", Number(e.target.value) || 0)}
            placeholder="Ex: 3"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
      </div>

      {/* Type habitat */}
      <div>
        <span className="text-xs font-medium text-slate-600 mb-1 block">Type d&apos;habitat</span>
        <div className="flex gap-2">
          {(["collectif", "individuel"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onFieldChange("typeHabitat", t)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                formData.typeHabitat === t
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t === "collectif" ? "Collectif" : "Individuel"}
            </button>
          ))}
        </div>
      </div>

      {/* Construction & DPE */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1">
            Ann\u00e9e de construction {hasDefault("constructionYear") && <AutoBadge />}
          </span>
          <input
            type="number"
            min={1600}
            max={2030}
            value={formData.constructionYear ?? ""}
            onChange={(e) => onFieldChange("constructionYear", Number(e.target.value) || 0)}
            placeholder="Ex: 1985"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1">
            Classe DPE {hasDefault("dpeClass") && <AutoBadge />}
          </span>
          <select
            value={formData.dpeClass ?? ""}
            onChange={(e) => onFieldChange("dpeClass", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          >
            <option value="">S\u00e9lectionner</option>
            {DPE_CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600 mb-1 block">Date du DPE</span>
          <input
            type="date"
            value={formData.dpeDate ?? ""}
            onChange={(e) => onFieldChange("dpeDate", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 mb-1 block">Estimation \u00e9nergie</span>
          <input
            type="text"
            value={formData.energyEstimate ?? ""}
            onChange={(e) => onFieldChange("energyEstimate", e.target.value)}
            placeholder="Ex: 150 kWh/m\u00b2/an"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
        </label>
      </div>

      {/* Chauffage & eau chaude */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1">
            Mode de chauffage {hasDefault("modeChauffage") && <AutoBadge />}
          </span>
          <select
            value={formData.modeChauffage ?? ""}
            onChange={(e) => onFieldChange("modeChauffage", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          >
            <option value="">S\u00e9lectionner</option>
            {HEATING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-1">
            Mode eau chaude {hasDefault("modeEauChaude") && <AutoBadge />}
          </span>
          <select
            value={formData.modeEauChaude ?? ""}
            onChange={(e) => onFieldChange("modeEauChaude", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          >
            <option value="">S\u00e9lectionner</option>
            {HOT_WATER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* R\u00e9gime juridique */}
      <div>
        <span className="text-xs font-medium text-slate-600 mb-1 block">R\u00e9gime juridique</span>
        <div className="flex gap-2">
          {(["monopropriete", "copropriete"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onFieldChange("regimeJuridique", r)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                formData.regimeJuridique === r
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {r === "monopropriete" ? "Monopropri\u00e9t\u00e9" : "Copropri\u00e9t\u00e9"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
