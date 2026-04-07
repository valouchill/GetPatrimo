"use client";

import { CheckCircle2, Info } from "lucide-react";
import type { LeaseFormData } from "./types";
import { getDurationConstraints, getNoticePeriod } from "./leaseFieldRules";

const { getTomorrowDateInputValue } = require("@/src/utils/leaseWizardShared");

interface SectionDureeProps {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number) => void;
}

function computeEndDate(startDate: string, durationMonths: number): string {
  if (!startDate || !durationMonths) return "—";
  try {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + durationMonths);
    return date.toLocaleDateString("fr-FR");
  } catch {
    return "—";
  }
}

export function SectionDuree({ formData, onFieldChange }: SectionDureeProps) {
  const endDate = computeEndDate(formData.startDate, formData.durationMonths);
  const constraints = getDurationConstraints(formData.leaseType);
  const noticePeriod = getNoticePeriod(formData.leaseType);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="field-date_debut_location" className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Date de début
          </label>
          <input
            id="field-date_debut_location"
            type="date"
            value={formData.startDate}
            min={getTomorrowDateInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000))}
            onChange={(e) => onFieldChange("startDate", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
          />
        </div>

        <div>
          <label htmlFor="field-duree_bail_mois" className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Durée
          </label>
          <div className="relative">
            <input
              id="field-duree_bail_mois"
              type="number"
              min={constraints.min}
              max={constraints.max}
              value={formData.durationMonths}
              onChange={(e) => onFieldChange("durationMonths", Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-14 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">mois</span>
          </div>
          {constraints.hint && (
            <p className="mt-1 text-xs text-slate-400">{constraints.hint}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Date de fin</label>
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <span className="text-sm text-slate-700">{endDate}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Calculé
            </span>
          </div>
        </div>
      </div>

      {/* Préavis informatif */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-700">
          <span className="font-medium">Préavis légal :</span>{" "}
          Locataire : {noticePeriod.tenant} — Propriétaire : {noticePeriod.owner}
        </div>
      </div>
    </div>
  );
}
