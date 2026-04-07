"use client";

import {
  Home,
  Banknote,
  Calendar,
  ScrollText,
  User,
  Building2,
  CreditCard,
  TrendingUp,
  Briefcase,
  Luggage,
  Shield,
} from "lucide-react";

import { SectionLocataire } from "./SectionLocataire";
import { SectionBien } from "./SectionBien";
import { SectionFinancier } from "./SectionFinancier";
import { SectionDuree } from "./SectionDuree";
import { SectionClauses } from "./SectionClauses";
import { SectionGarant } from "./SectionGarant";
import { SectionCaracteristiques } from "./SectionCaracteristiques";
import { SectionEquipements } from "./SectionEquipements";
import { SectionPaiement } from "./SectionPaiement";
import { SectionRevision } from "./SectionRevision";
import { SectionMandataire } from "./SectionMandataire";
import { SectionMobilite } from "./SectionMobilite";
import { SectionGarantDetails } from "./SectionGarantDetails";
import { CollapsibleSection } from "./CollapsibleSection";
import { useFieldVisibility } from "./useFieldVisibility";
import { useFormCompletion, type SectionStatus } from "./useFormCompletion";
import type { SectionKey } from "./leaseFieldRules";
import type { ApplicationRecord, CandidatureRecord, LeaseFormData, PropertyRecord } from "./types";

interface FormPanelProps {
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
  onFieldChange: (field: string, value: string | number | boolean) => void;
  onDepositChange: (value: string) => void;
  onReturnToComparison: () => void;
}

const EMPTY_STATUS: SectionStatus = { filled: 0, total: 0, status: "complete" };

export function FormPanel({
  property,
  selectedApplication,
  legacyCandidature,
  tenantName,
  tenantEmail,
  tenantPhone,
  tenantIncome,
  selectionRequired,
  contractLocked,
  formData,
  onFieldChange,
  onDepositChange,
  onReturnToComparison,
}: FormPanelProps) {
  const showForm = !selectionRequired && !contractLocked;
  const hasGuarantor = selectedApplication?.guarantee?.mode !== "NONE" && Boolean(selectedApplication?.guarantee);

  const { isSectionVisible } = useFieldVisibility(formData, hasGuarantor);
  const { sectionStatus } = useFormCompletion(formData, hasGuarantor);

  const s = (key: SectionKey) => sectionStatus[key] ?? EMPTY_STATUS;

  return (
    <div className="space-y-3 pb-24">
      {/* 1. Locataire (toujours visible, lecture seule) */}
      <SectionLocataire
        selectedApplication={selectedApplication}
        legacyCandidature={legacyCandidature}
        tenantName={tenantName}
        tenantEmail={tenantEmail}
        tenantPhone={tenantPhone}
        tenantIncome={tenantIncome}
        selectionRequired={selectionRequired}
        contractLocked={contractLocked}
        onReturnToComparison={onReturnToComparison}
      />

      {showForm && (
        <>
          {/* 2. Bien */}
          <CollapsibleSection
            icon={<Home className="h-4 w-4" />}
            title="Bien"
            subtitle="Informations du logement"
            defaultOpen
          >
            <SectionBien property={property} />
          </CollapsibleSection>

          {/* 3. Caractéristiques */}
          {isSectionVisible("caracteristiques") && (
            <CollapsibleSection
              icon={<Building2 className="h-4 w-4" />}
              title="Caractéristiques"
              subtitle="Surface, DPE, chauffage, régime juridique"
              status={s("caracteristiques")}
            >
              <SectionCaracteristiques
                formData={formData}
                property={property}
                onFieldChange={onFieldChange}
              />
            </CollapsibleSection>
          )}

          {/* 4. Équipements */}
          {isSectionVisible("equipements") && (
            <CollapsibleSection
              icon={<Home className="h-4 w-4" />}
              title="Équipements & accessoires"
              subtitle="Parties privatives et communes"
            >
              <SectionEquipements formData={formData} onFieldChange={onFieldChange} />
            </CollapsibleSection>
          )}

          {/* 5. Financier */}
          <CollapsibleSection
            icon={<Banknote className="h-4 w-4" />}
            title="Conditions financières"
            subtitle="Loyer, charges et dépôt de garantie"
            status={s("financier")}
            defaultOpen
          >
            <SectionFinancier
              formData={formData}
              onFieldChange={onFieldChange}
              onDepositChange={onDepositChange}
            />
          </CollapsibleSection>

          {/* 6. Révision */}
          {isSectionVisible("revision") && (
            <CollapsibleSection
              icon={<TrendingUp className="h-4 w-4" />}
              title="Révision du loyer"
              subtitle="IRL, encadrement des loyers"
            >
              <SectionRevision formData={formData} onFieldChange={onFieldChange} />
            </CollapsibleSection>
          )}

          {/* 7. Durée */}
          <CollapsibleSection
            icon={<Calendar className="h-4 w-4" />}
            title="Durée et dates"
            subtitle="Début, durée et fin du bail"
            status={s("duree")}
            defaultOpen
          >
            <SectionDuree formData={formData} onFieldChange={onFieldChange} />
          </CollapsibleSection>

          {/* 8. Paiement */}
          <CollapsibleSection
            icon={<CreditCard className="h-4 w-4" />}
            title="Modalités de paiement"
            subtitle="Mode, terme et lieu de paiement"
            status={s("paiement")}
          >
            <SectionPaiement formData={formData} onFieldChange={onFieldChange} />
          </CollapsibleSection>

          {/* 9. Mobilité (conditionnel) */}
          {isSectionVisible("mobilite") && (
            <CollapsibleSection
              icon={<Luggage className="h-4 w-4" />}
              title="Bail mobilité"
              subtitle="Motif justifiant le bail mobilité"
              status={s("mobilite")}
              defaultOpen
            >
              <SectionMobilite formData={formData} onFieldChange={onFieldChange} />
            </CollapsibleSection>
          )}

          {/* 10. Garant résumé (lecture seule) */}
          {hasGuarantor && (
            <SectionGarant selectedApplication={selectedApplication} />
          )}

          {/* 11. Garant détails (éditable, conditionnel) */}
          {isSectionVisible("garant") && (
            <CollapsibleSection
              icon={<Shield className="h-4 w-4" />}
              title="Détails du garant"
              subtitle="Informations complémentaires du garant"
            >
              <SectionGarantDetails
                formData={formData}
                selectedApplication={selectedApplication}
                onFieldChange={onFieldChange}
              />
            </CollapsibleSection>
          )}

          {/* 12. Mandataire */}
          <CollapsibleSection
            icon={<Briefcase className="h-4 w-4" />}
            title="Mandataire"
            subtitle="Agent immobilier ou administrateur"
          >
            <SectionMandataire formData={formData} onFieldChange={onFieldChange} />
          </CollapsibleSection>

          {/* 13. Clauses */}
          <CollapsibleSection
            icon={<ScrollText className="h-4 w-4" />}
            title="Clauses particulières"
            subtitle="Conditions spécifiques et mentions complémentaires"
          >
            <SectionClauses formData={formData} onFieldChange={onFieldChange} />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
