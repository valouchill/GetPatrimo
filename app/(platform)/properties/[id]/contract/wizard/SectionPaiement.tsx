"use client";

import type { LeaseFormData } from "./types";

interface Props {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number | boolean) => void;
}

const PAYMENT_MODES = [
  { value: "virement bancaire", label: "Virement bancaire" },
  { value: "chèque", label: "Chèque" },
  { value: "prélèvement automatique", label: "Prélèvement automatique" },
  { value: "espèces", label: "Espèces" },
];

export function SectionPaiement({ formData, onFieldChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Mode de paiement */}
      <label className="block">
        <span className="text-xs font-medium text-slate-600 mb-1 block">Mode de paiement</span>
        <select
          value={formData.paymentMode ?? "virement bancaire"}
          onChange={(e) => onFieldChange("paymentMode", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
        >
          {PAYMENT_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </label>

      {/* Terme de paiement */}
      <div>
        <span className="text-xs font-medium text-slate-600 mb-1 block">Terme de paiement</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onFieldChange("paymentInArrears", false)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              !formData.paymentInArrears
                ? "border-orange-400 bg-orange-50 text-orange-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            \u00c0 échoir (début de mois)
          </button>
          <button
            type="button"
            onClick={() => onFieldChange("paymentInArrears", true)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              formData.paymentInArrears
                ? "border-orange-400 bg-orange-50 text-orange-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Terme échu (fin de mois)
          </button>
        </div>
      </div>

      {/* Jour de paiement */}
      <label className="block">
        <span className="text-xs font-medium text-slate-600 mb-1 block">Jour de paiement</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={28}
            value={formData.paymentDay}
            onChange={(e) => onFieldChange("paymentDay", Number(e.target.value) || 1)}
            className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
          />
          <span className="text-sm text-slate-500">du mois</span>
        </div>
      </label>

      {/* Lieu de paiement */}
      <label className="block">
        <span className="text-xs font-medium text-slate-600 mb-1 block">Lieu de paiement</span>
        <input
          type="text"
          value={formData.paymentLocation ?? ""}
          onChange={(e) => onFieldChange("paymentLocation", e.target.value)}
          placeholder="Ex: Domicile du bailleur, adresse..."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
        />
      </label>
    </div>
  );
}
