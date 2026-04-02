'use client';

import { SectionLocataire } from './SectionLocataire';
import { SectionBien } from './SectionBien';
import { SectionFinancier } from './SectionFinancier';
import { SectionDuree } from './SectionDuree';
import { SectionClauses } from './SectionClauses';
import { SectionGarant } from './SectionGarant';
import type { ApplicationRecord, CandidatureRecord, LeaseFormData, PropertyRecord } from './types';

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
  onFieldChange: (field: string, value: string | number) => void;
  onDepositChange: (value: string) => void;
  onReturnToComparison: () => void;
}

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

  return (
    <div className="space-y-4 pb-24">
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
          <SectionBien property={property} />
          <SectionFinancier
            formData={formData}
            onFieldChange={onFieldChange}
            onDepositChange={onDepositChange}
          />
          <SectionDuree formData={formData} onFieldChange={onFieldChange} />
          <SectionClauses formData={formData} onFieldChange={onFieldChange} />
          <SectionGarant selectedApplication={selectedApplication} />
        </>
      )}
    </div>
  );
}
