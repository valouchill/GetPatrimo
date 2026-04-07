"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Home, Building2, ShieldCheck, ChevronRight, Settings2,
  Calendar, CreditCard, Banknote, TrendingUp, Luggage, Shield,
  Briefcase, ScrollText,
} from "lucide-react";

import { CollapsibleSection } from "./CollapsibleSection";
import { SectionCaracteristiques } from "./SectionCaracteristiques";
import { SectionEquipements } from "./SectionEquipements";
import { SectionRevision } from "./SectionRevision";
import { SectionPaiement } from "./SectionPaiement";
import { SectionMobilite } from "./SectionMobilite";
import { SectionGarant } from "./SectionGarant";
import { SectionGarantDetails } from "./SectionGarantDetails";
import { SectionMandataire } from "./SectionMandataire";
import { SectionClauses } from "./SectionClauses";
import { SectionDuree } from "./SectionDuree";
import { SectionFinancier } from "./SectionFinancier";
import { useFieldVisibility } from "./useFieldVisibility";
import { useFormCompletion, type SectionStatus } from "./useFormCompletion";
import { getDepositConstraints } from "./leaseFieldRules";
import type { SectionKey } from "./leaseFieldRules";
import type { ApplicationRecord, CandidatureRecord, LeaseFormData, PropertyRecord } from "./types";

const { computeSmartDeposit, getTomorrowDateInputValue } = require("@/src/utils/leaseWizardShared");

interface SmartLeaseEditorProps {
  property: PropertyRecord | null;
  selectedApplication: ApplicationRecord | null;
  legacyCandidature: CandidatureRecord | null;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantIncome: number;
  selectionRequired: boolean;
  contractLocked: boolean;
  formData: LeaseFormData;
  hasGuarantor: boolean;
  mergeData: Record<string, string>;
  onFieldChange: (field: string, value: string | number | boolean | Record<string, unknown>) => void;
  onDepositChange: (value: string) => void;
  onReturnToComparison: () => void;
}

const LEASE_TYPES = [
  { value: "VIDE", label: "Vide" },
  { value: "MEUBLE", label: "Meubl\u00e9" },
  { value: "MOBILITE", label: "Mobilit\u00e9" },
  { value: "GARAGE_PARKING", label: "Garage" },
] as const;

const PAYMENT_DAYS = [
  { value: 1, label: "Le 1er" },
  { value: 5, label: "Le 5" },
  { value: 10, label: "Le 10" },
  { value: 15, label: "Le 15" },
];

const EMPTY_STATUS: SectionStatus = { filled: 0, total: 0, status: "complete" };

// ── Recap Badge Card ────────────────────────────────────────────

function RecapCard({
  icon,
  title,
  lines,
}: {
  icon: React.ReactNode;
  title: string;
  lines: (string | undefined | null)[];
}) {
  const filtered = lines.filter(Boolean) as string[];
  if (filtered.length === 0) return null;

  return (
    <div className="bg-slate-50 rounded-xl p-4 flex gap-3">
      <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">{title}</h4>
        {filtered.map((line, i) => (
          <p key={i} className="text-sm font-medium text-slate-800 truncate">{line}</p>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export function SmartLeaseEditor({
  property,
  selectedApplication,
  legacyCandidature,
  tenantName,
  tenantEmail,
  tenantPhone,
  selectionRequired,
  contractLocked,
  formData,
  hasGuarantor,
  mergeData,
  onFieldChange,
  onDepositChange,
  onReturnToComparison,
}: SmartLeaseEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { isSectionVisible } = useFieldVisibility(formData, hasGuarantor);
  const { sectionStatus } = useFormCompletion(formData, hasGuarantor);
  const s = (key: SectionKey) => sectionStatus[key] ?? EMPTY_STATUS;

  const showDeposit = formData.leaseType !== "MOBILITE";
  const recommendedDeposit = computeSmartDeposit(formData.leaseType, formData.rentHC);
  const depositConstraints = getDepositConstraints(formData.leaseType, formData.rentHC);

  // ── Alert states ──────────────────────────────────────────────

  if (selectionRequired) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-800 mb-3">Aucun locataire s\u00e9lectionn\u00e9</p>
        <button
          type="button"
          onClick={onReturnToComparison}
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          Retour \u00e0 la fiche bien &rarr;
        </button>
      </div>
    );
  }

  if (contractLocked) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-800">Dossier sous scell\u00e9 \u2014 d\u00e9verrouillez pour modifier</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Zone 1: Recap Badges ──────────────────────────────── */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-emerald-900 mb-3">R\u00e9capitulatif</h2>
        <div className="grid grid-cols-1 gap-3">
          <RecapCard
            icon={<User className="h-4 w-4" />}
            title="Locataire"
            lines={[tenantName, tenantEmail, tenantPhone]}
          />
          <RecapCard
            icon={<Home className="h-4 w-4" />}
            title="Bien"
            lines={[
              property?.address,
              [property?.surfaceM2 && `${property.surfaceM2} m\u00b2`, property?.dpeClass && `DPE ${property.dpeClass}`].filter(Boolean).join(" \u2022 "),
            ]}
          />
          <RecapCard
            icon={<Building2 className="h-4 w-4" />}
            title="Bailleur"
            lines={[
              mergeData?.bailleur_nom_prenom || "Depuis votre profil",
              mergeData?.bailleur_adresse,
            ]}
          />
          {hasGuarantor && (
            <RecapCard
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Garantie"
              lines={[
                selectedApplication?.ownerInsights?.guarantee?.label,
                selectedApplication?.ownerInsights?.guarantee?.summary,
              ]}
            />
          )}
        </div>
      </div>

      {/* ── Zone 2: Core Params ───────────────────────────────── */}
      <div>
        <h2 className="font-serif text-lg font-semibold text-emerald-900 mb-3">Param\u00e8tres du bail</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          {/* Lease type pills */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Type de bail</label>
            <div className="flex flex-wrap gap-2">
              {LEASE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onFieldChange("leaseType", t.value)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    formData.leaseType === t.value
                      ? "bg-emerald-700 text-white shadow-md"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date d'entr\u00e9e */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Date d&apos;entr\u00e9e dans les lieux
            </label>
            <input
              type="date"
              value={formData.startDate}
              min={getTomorrowDateInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000))}
              onChange={(e) => onFieldChange("startDate", e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none"
            />
          </div>

          {/* Jour de paiement */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Jour de paiement du loyer
            </label>
            <select
              value={formData.paymentDay}
              onChange={(e) => onFieldChange("paymentDay", Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none"
            >
              {PAYMENT_DAYS.map((d) => (
                <option key={d.value} value={d.value}>{d.label} du mois</option>
              ))}
            </select>
          </div>

          {/* D\u00e9p\u00f4t de garantie */}
          {showDeposit && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                D\u00e9p\u00f4t de garantie
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={depositConstraints.max}
                  value={formData.deposit}
                  onChange={(e) => onDepositChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-8 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">\u20ac</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Recommand\u00e9 : {recommendedDeposit.toFixed(0)} \u20ac \u2014 {depositConstraints.hint}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Zone 3: Personnaliser ─────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700 transition-colors group"
        >
          <Settings2 className="h-4 w-4" />
          <span className="font-medium">Personnaliser le contrat</span>
          <motion.span
            animate={{ rotate: showAdvanced ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="h-4 w-4" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-4">
                {/* Dur\u00e9e \u00e9tendue */}
                <CollapsibleSection icon={<Calendar className="h-4 w-4" />} title="Dur\u00e9e et dates" subtitle="Dur\u00e9e, fin de bail, pr\u00e9avis" status={s("duree")}>
                  <SectionDuree formData={formData} onFieldChange={onFieldChange} />
                </CollapsibleSection>

                {/* Financier \u00e9tendu */}
                <CollapsibleSection icon={<Banknote className="h-4 w-4" />} title="Conditions financi\u00e8res" subtitle="Loyer, charges, d\u00e9p\u00f4t" status={s("financier")}>
                  <SectionFinancier formData={formData} onFieldChange={onFieldChange} onDepositChange={onDepositChange} />
                </CollapsibleSection>

                {isSectionVisible("caracteristiques") && (
                  <CollapsibleSection icon={<Building2 className="h-4 w-4" />} title="Caract\u00e9ristiques" subtitle="Surface, DPE, chauffage" status={s("caracteristiques")}>
                    <SectionCaracteristiques formData={formData} property={property} onFieldChange={onFieldChange} />
                  </CollapsibleSection>
                )}

                {isSectionVisible("equipements") && (
                  <CollapsibleSection icon={<Home className="h-4 w-4" />} title="\u00c9quipements" subtitle="Accessoires et parties communes">
                    <SectionEquipements formData={formData} onFieldChange={onFieldChange} />
                  </CollapsibleSection>
                )}

                {isSectionVisible("revision") && (
                  <CollapsibleSection icon={<TrendingUp className="h-4 w-4" />} title="R\u00e9vision du loyer" subtitle="IRL, encadrement">
                    <SectionRevision formData={formData} onFieldChange={onFieldChange} />
                  </CollapsibleSection>
                )}

                <CollapsibleSection icon={<CreditCard className="h-4 w-4" />} title="Paiement" subtitle="Mode et lieu de paiement" status={s("paiement")}>
                  <SectionPaiement formData={formData} onFieldChange={onFieldChange} />
                </CollapsibleSection>

                {isSectionVisible("mobilite") && (
                  <CollapsibleSection icon={<Luggage className="h-4 w-4" />} title="Bail mobilit\u00e9" subtitle="Motif" status={s("mobilite")} defaultOpen>
                    <SectionMobilite formData={formData} onFieldChange={onFieldChange} />
                  </CollapsibleSection>
                )}

                {hasGuarantor && (
                  <>
                    <SectionGarant selectedApplication={selectedApplication} />
                    {isSectionVisible("garant") && (
                      <CollapsibleSection icon={<Shield className="h-4 w-4" />} title="D\u00e9tails du garant" subtitle="Informations compl\u00e9mentaires">
                        <SectionGarantDetails formData={formData} selectedApplication={selectedApplication} onFieldChange={onFieldChange} />
                      </CollapsibleSection>
                    )}
                  </>
                )}

                <CollapsibleSection icon={<Briefcase className="h-4 w-4" />} title="Mandataire" subtitle="Agent immobilier">
                  <SectionMandataire formData={formData} onFieldChange={onFieldChange} />
                </CollapsibleSection>

                <CollapsibleSection icon={<ScrollText className="h-4 w-4" />} title="Clauses particuli\u00e8res" subtitle="Conditions sp\u00e9cifiques">
                  <SectionClauses formData={formData} onFieldChange={onFieldChange} />
                </CollapsibleSection>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
