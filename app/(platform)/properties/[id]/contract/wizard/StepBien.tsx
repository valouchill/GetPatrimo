"use client";

import { Home } from "lucide-react";
import { PremiumSurface } from "@/app/components/ui/premium";
import type { LeaseFormData } from "./types";

const {
  computeSmartDeposit,
  getTomorrowDateInputValue,
} = require("@/src/utils/leaseWizardShared");

type StepBienProps = {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number) => void;
  onDepositChange: (value: string) => void;
};

export function StepBien({ formData, onFieldChange, onDepositChange }: StepBienProps) {
  return (
    <PremiumSurface padding="md" className="border-slate-200/90 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.15)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50">
          <Home className="h-5 w-5 text-stone-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Paramètres du bail</h2>
          <p className="mt-1 text-sm text-slate-500">Le document se calibre ici, sans perdre la lecture métier du dossier.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Type de bail
          <select
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            value={formData.leaseType}
            onChange={(event) => onFieldChange("leaseType", event.target.value)}
            aria-required="true"
          >
            <option value="VIDE">Vide</option>
            <option value="MEUBLE">Meublé</option>
            <option value="MOBILITE">Mobilité</option>
            <option value="GARAGE_PARKING">Garage / Parking</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Date de début
          <input
            type="date"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            value={formData.startDate}
            min={getTomorrowDateInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000))}
            onChange={(event) => onFieldChange("startDate", event.target.value)}
            aria-required="true"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Jour de paiement
          <input
            type="number"
            min={1}
            max={28}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            value={formData.paymentDay}
            onChange={(event) => onFieldChange("paymentDay", Number(event.target.value) || 5)}
            aria-required="true"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Durée (mois)
          <input
            type="number"
            min={1}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            value={formData.durationMonths}
            onChange={(event) => onFieldChange("durationMonths", Number(event.target.value) || 0)}
            aria-required="true"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Loyer HC
          <input
            type="number"
            min={0}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            value={formData.rentHC}
            onChange={(event) => onFieldChange("rentHC", Number(event.target.value) || 0)}
            aria-required="true"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Charges
          <input
            type="number"
            min={0}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            value={formData.charges}
            onChange={(event) => onFieldChange("charges", Number(event.target.value) || 0)}
          />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Dépôt de garantie
          <input
            type="number"
            min={0}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            value={formData.deposit}
            onChange={(event) => onDepositChange(event.target.value)}
          />
          <span className="mt-2 block text-xs text-slate-500">
            Recommandation automatique: {computeSmartDeposit(formData.leaseType, formData.rentHC).toFixed(2)} €
          </span>
        </label>
      </div>
    </PremiumSurface>
  );
}
