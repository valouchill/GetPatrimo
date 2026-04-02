'use client';

import { Banknote } from 'lucide-react';
import type { LeaseFormData } from './types';

const { computeSmartDeposit } = require('@/src/utils/leaseWizardShared');

interface SectionFinancierProps {
  formData: LeaseFormData;
  onFieldChange: (field: string, value: string | number) => void;
  onDepositChange: (value: string) => void;
}

const LEASE_TYPES = [
  { value: 'VIDE', label: 'Vide' },
  { value: 'MEUBLE', label: 'Meublé' },
  { value: 'MOBILITE', label: 'Mobilité' },
  { value: 'GARAGE_PARKING', label: 'Garage' },
] as const;

export function SectionFinancier({ formData, onFieldChange, onDepositChange }: SectionFinancierProps) {
  const recommendedDeposit = computeSmartDeposit(formData.leaseType, formData.rentHC);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
          <Banknote className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Conditions financières</h3>
          <p className="text-xs text-slate-500">Loyer, charges et dépôt de garantie</p>
        </div>
      </div>

      {/* Lease type pills */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-slate-700 mb-2 block">Type de bail</label>
        <div className="flex flex-wrap gap-2">
          {LEASE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              id={`field-lease_type`}
              onClick={() => onFieldChange('leaseType', t.value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                formData.leaseType === t.value
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Rent */}
        <div>
          <label htmlFor="field-loyer_mensuel" className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Loyer HC
          </label>
          <div className="relative">
            <input
              id="field-loyer_mensuel"
              type="number"
              min={0}
              value={formData.rentHC}
              onChange={(e) => onFieldChange('rentHC', Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-16 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">€/mois</span>
          </div>
        </div>

        {/* Charges */}
        <div>
          <label htmlFor="field-charges_chiffres" className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Charges
          </label>
          <div className="relative">
            <input
              id="field-charges_chiffres"
              type="number"
              min={0}
              value={formData.charges}
              onChange={(e) => onFieldChange('charges', Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-16 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">€/mois</span>
          </div>
        </div>

        {/* Deposit */}
        <div>
          <label htmlFor="field-depot_garantie" className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Dépôt de garantie
          </label>
          <div className="relative">
            <input
              id="field-depot_garantie"
              type="number"
              min={0}
              value={formData.deposit}
              onChange={(e) => onDepositChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-8 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Recommandé : {recommendedDeposit.toFixed(0)} €</p>
        </div>

        {/* Payment day */}
        <div>
          <label htmlFor="field-paiement_jour_mois" className="text-xs font-semibold text-slate-700 mb-1.5 block">
            Jour de paiement
          </label>
          <div className="relative">
            <input
              id="field-paiement_jour_mois"
              type="number"
              min={1}
              max={28}
              value={formData.paymentDay}
              onChange={(e) => onFieldChange('paymentDay', Number(e.target.value) || 5)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-16 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">du mois</span>
          </div>
        </div>
      </div>
    </div>
  );
}
