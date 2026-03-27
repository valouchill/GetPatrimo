export interface Property {
  _id: string;
  name: string;
  address: string;
  addressLine: string;
  zipCode: string;
  city: string;
  rentAmount: number;
  chargesAmount: number;
  surfaceM2?: number;
}

export interface Tenant {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  monthlyNetIncome: number;
  contractType: string;
  hasGuarantor: boolean;
  guarantorType: string;
  trustAnalysis?: {
    score: number;
    status: string;
  };
}

export interface Guarantor {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  income: number;
  profession: string;
  visaleNumber?: string;
}

export interface Clause {
  id: string;
  title: string;
  description: string;
  category: "TECH" | "LUXE" | "ENTRETIEN" | "USAGE";
  content: string;
  isPremium?: boolean;
}

export interface BailInstantProps {
  property: Property;
  tenant: Tenant;
  candidatureId?: string;
  onGenerate?: (leaseData: LeaseData) => void;
  onSuccess?: (lease: any) => void;
  onError?: (error: string) => void;
}

export interface LeaseData {
  startDate: Date;
  endDate?: Date;
  rentAmount: number;
  chargesAmount: number;
  depositAmount: number;
  guarantorType: "VISALE" | "PHYSIQUE" | "NONE";
  guarantor?: Guarantor;
  additionalClauses: string;
  selectedClauses: string[]; // IDs des clauses sélectionnées
  customClause: string; // Clause libre
}
