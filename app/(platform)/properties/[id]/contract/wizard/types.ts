export type PropertyRecord = {
  _id?: string;
  acceptedTenantId?: string | null;
  name?: string;
  address?: string;
  rentAmount?: number;
  chargesAmount?: number;
  surfaceM2?: number;
  type?: string;
  furnished?: string;
  managed?: boolean;
  status?: string;
  flow?: {
    stage?: "search" | "analysis" | "selection" | "contract" | "management";
    stageLabel?: string;
    summary?: string;
  };
};

export type ApplicationRecord = {
  id: string;
  isSealed?: boolean;
  profile?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  userEmail?: string;
  financialSummary?: {
    totalMonthlyIncome?: number;
    monthlyNetIncome?: number;
    remainingIncome?: number | null;
    riskLevel?: string;
    riskPercent?: number;
    effortRate?: number | null;
    contractType?: string;
  };
  guarantor?: {
    status?: string;
    guarantorId?: string;
  };
  guarantee?: {
    mode?: "NONE" | "VISALE" | "PHYSICAL";
  } | null;
  patrimometer?: {
    score?: number;
    grade?: string;
  };
  passport?: {
    state?: "draft" | "review" | "ready" | "sealed";
    stateLabel?: string;
    summary?: string;
  } | null;
  ownerInsights?: {
    aiAudit?: {
      status?: "CLEAR" | "REVIEW" | "ALERT";
      summary?: string;
      blockers?: string[];
      reviewReasons?: string[];
    };
    financial?: {
      summary?: string;
      monthlyIncomeLabel?: string | null;
      remainingIncomeLabel?: string | null;
      effortRateLabel?: string | null;
      riskBand?: {
        label?: string;
      };
    };
    contractReadiness?: {
      ready?: boolean;
      blockers?: string[];
      warnings?: string[];
      leaseType?: string;
      suggestedDepositLabel?: string | null;
    };
    guarantee?: {
      label?: string;
      summary?: string;
    };
  } | null;
  status?: string;
};

export type CandidatureRecord = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  monthlyNetIncome?: number;
  guarantorType?: string;
  hasGuarantor?: boolean;
};

export type CompiledDocument = {
  kind: "lease" | "guarantee";
  fileName: string;
  mimeType: string;
  secureUrl?: string;
  pdfUrl?: string;
};

export type LeaseFormData = {
  leaseType: string;
  startDate: string;
  paymentDay: number;
  rentHC: number;
  charges: number;
  deposit: number;
  durationMonths: number;
  clauses: string;
};

export type CompileMeta = {
  leaseType?: string;
  hasGuarantee?: boolean;
  signerRoles?: string[];
  warnings?: string[];
};
