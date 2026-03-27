"use client";

import { PremiumSurface } from "@/app/components/ui/premium";
import type { LeaseFormData } from "./types";

type StepConditionsProps = {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number) => void;
};

export function StepConditions({ formData, onFieldChange }: StepConditionsProps) {
  return (
    <PremiumSurface padding="md" className="border-slate-200/90">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">Conditions particulières</h2>
        <p className="mt-1 text-sm text-slate-500">Clauses spécifiques, équipements inclus, précisions de paiement ou toute mention complémentaire au bail.</p>
      </div>
      <label className="text-sm font-medium text-slate-700">
        Clauses complémentaires
        <textarea
          className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
          value={formData.clauses}
          onChange={(event) => onFieldChange("clauses", event.target.value)}
          placeholder="Clauses particulières, équipements, précisions de paiement, etc."
        />
      </label>
    </PremiumSurface>
  );
}
