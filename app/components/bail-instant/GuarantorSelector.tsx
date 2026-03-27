"use client";

import { motion } from "framer-motion";
import { Shield, User } from "lucide-react";
import { Guarantor, LeaseData } from "./types";
import { SmartCard } from "./SmartCard";

/**
 * Sélecteur de Garantie Intelligent
 */
export interface GuarantorSelectorProps {
  guarantorType: "VISALE" | "PHYSIQUE" | "NONE";
  guarantor?: Guarantor;
  onChangeType: (type: "VISALE" | "PHYSIQUE" | "NONE") => void;
  onFieldChange: (field: keyof Guarantor, value: string | number) => void;
}

export function GuarantorSelector({
  guarantorType,
  guarantor,
  onChangeType,
  onFieldChange,
}: GuarantorSelectorProps) {
  return (
    <SmartCard
      icon={<Shield className="w-5 h-5" />}
      title="Type de Garantie"
      isComplete={guarantorType !== "NONE" && !!guarantor}
    >
      <div className="space-y-4">
        {/* Sélection du type */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onChangeType("VISALE")}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              guarantorType === "VISALE"
                ? "border-emerald bg-emerald/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="font-semibold text-sm text-navy mb-1">Visale</div>
            <div className="text-xs text-slate-500">Garantie publique</div>
          </button>
          <button
            onClick={() => onChangeType("PHYSIQUE")}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              guarantorType === "PHYSIQUE"
                ? "border-emerald bg-emerald/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="font-semibold text-sm text-navy mb-1">Physique</div>
            <div className="text-xs text-slate-500">Garant personne</div>
          </button>
          <button
            onClick={() => onChangeType("NONE")}
            className={`p-4 border-2 rounded-lg text-center transition-all ${
              guarantorType === "NONE"
                ? "border-slate-300 bg-slate-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="font-semibold text-sm text-slate-600 mb-1">Aucun</div>
            <div className="text-xs text-slate-500">Sans garant</div>
          </button>
        </div>

        {/* Formulaire Visale */}
        {guarantorType === "VISALE" && guarantor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-3 pt-4 border-t border-slate-200"
          >
            <div>
              <label className="block text-sm text-slate-600 mb-2">
                Numéro de Visa
              </label>
              <input
                type="text"
                value={guarantor.visaleNumber || ""}
                onChange={(e) => onFieldChange("visaleNumber", e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                placeholder="Ex: VISALE123456789"
              />
            </div>
          </motion.div>
        )}

        {/* Formulaire Garant Physique */}
        {guarantorType === "PHYSIQUE" && guarantor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-3 pt-4 border-t border-slate-200"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-2">Prénom</label>
                <input
                  type="text"
                  value={guarantor.firstName}
                  onChange={(e) => onFieldChange("firstName", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-2">Nom</label>
                <input
                  type="text"
                  value={guarantor.lastName}
                  onChange={(e) => onFieldChange("lastName", e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Email</label>
              <input
                type="email"
                value={guarantor.email}
                onChange={(e) => onFieldChange("email", e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-2">Revenus mensuels nets</label>
              <input
                type="number"
                value={guarantor.income || ""}
                onChange={(e) => onFieldChange("income", parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald"
                placeholder="Montant en euros"
              />
            </div>
            {/* Carte Résumé du Garant */}
            {guarantor.firstName && guarantor.lastName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-emerald/5 border border-emerald/20 rounded-lg"
              >
                <div className="text-xs text-slate-600 mb-2">Résumé du garant</div>
                <div className="font-semibold text-navy">
                  {guarantor.firstName} {guarantor.lastName}
                </div>
                {guarantor.income > 0 && (
                  <div className="text-sm text-slate-600 mt-1">
                    Revenus certifiés : {guarantor.income.toFixed(2)} €/mois
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </SmartCard>
  );
}
