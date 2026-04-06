export type PropertyRecord = {
  _id?: string;
  acceptedTenantId?: string | null;
  name?: string;
  address?: string;
  rentAmount?: number;
  chargesAmount?: number;
  surfaceM2?: number;
  surfaceHabitableM2?: number;
  type?: string;
  furnished?: string;
  managed?: boolean;
  status?: string;
  rooms?: number;
  nbPieces?: number;
  habitatType?: string;
  constructionYear?: number;
  yearBuilt?: number;
  dpeClass?: string;
  dpeDate?: string;
  energyEstimate?: string;
  heatingMode?: string;
  heatingType?: string;
  hotWaterMode?: string;
  legalRegime?: string;
  zipCode?: string;
  city?: string;
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
  docxPath?: string;
  pdfPath?: string;
  template?: string;
};

export type GuarantorOverrides = {
  firstName?: string;
  lastName?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  birthDate?: string;
};

export type LeaseFormData = {
  // ── Core (existant) ──────────────────────────────────────────
  leaseType: string;
  startDate: string;
  paymentDay: number;
  rentHC: number;
  charges: number;
  deposit: number;
  durationMonths: number;
  clauses: string;

  // ── Caractéristiques du bien ─────────────────────────────────
  surfaceHabitable?: number;
  rooms?: number;
  typeHabitat?: "collectif" | "individuel";
  constructionYear?: number;
  dpeClass?: string;
  dpeDate?: string;
  energyEstimate?: string;
  modeChauffage?: string;
  modeEauChaude?: string;
  regimeJuridique?: "monopropriete" | "copropriete";

  // ── Accessoires & équipements ────────────────────────────────
  balcony?: boolean;
  terrace?: boolean;
  garden?: boolean;
  loggia?: boolean;
  caveNumero?: string;
  garageNumero?: string;
  parkingNumber?: string;
  garageVelo?: boolean;
  grenier?: boolean;
  comble?: boolean;
  airesJeux?: boolean;
  ascenseur?: boolean;
  espacesVerts?: boolean;
  gardiennage?: boolean;
  laverie?: boolean;
  localPoubelle?: boolean;
  accessoireAutre?: string;
  partiesCommunesAutres?: string;

  // ── Financier étendu ─────────────────────────────────────────
  loyerRevise?: boolean;
  irlReference?: string;
  irlReferenceDate?: string;
  irlQuarterReference?: string;
  loyerReference?: string;
  loyerReferenceMajore?: string;
  complementLoyer?: string;
  soumisDecretRelocation?: boolean;
  soumisLoyerReferenceMajore?: boolean;
  paymentInArrears?: boolean;

  // ── Paiement ─────────────────────────────────────────────────
  paymentMode?: string;
  paymentLocation?: string;

  // ── Mandataire ───────────────────────────────────────────────
  hasMandataire?: boolean;
  mandataireNomPrenom?: string;
  mandataireDenomination?: string;
  mandataireAdresse?: string;
  mandataireActivite?: string;
  mandataireCartePro?: string;
  isSocieteCivile?: boolean;

  // ── Mobilité (MOBILITE uniquement) ───────────────────────────
  mobilityReason?: string;

  // ── Garant ───────────────────────────────────────────────────
  guarantorOverrides?: GuarantorOverrides;

  // ── Usage & clauses structurées ──────────────────────────────
  usageMixte?: boolean;
  petsAllowed?: boolean;
  sublettingAllowed?: boolean;
};

export type CompileMeta = {
  leaseType?: string;
  hasGuarantee?: boolean;
  signerRoles?: string[];
  warnings?: string[];
};

// --- Preview types ---

export interface TemplateVariable {
  name: string;
  start: number;
  end: number;
}

export interface TemplateParagraph {
  text: string;
  variables: TemplateVariable[];
}

export interface PreviewData {
  paragraphs: TemplateParagraph[];
  mergeData: Record<string, string>;
  rawData: Record<string, string>;
  totalVariables: number;
  filledVariables: number;
  warnings: string[];
  compileMeta: CompileMeta | null;
}
