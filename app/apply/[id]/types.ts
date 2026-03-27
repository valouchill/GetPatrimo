// Types partagés pour le tunnel de candidature

export interface DocumentAnalysisResult {
  documentType: string;
  extractedData: {
    nom?: string;
    prenom?: string;
    montants?: number[];
    dates?: string[];
    autres?: Record<string, unknown>;
  };
  confidenceScore: number;
  recommendations: string[];
  fraudIndicators?: {
    suspicious: boolean;
    reasons: string[];
  };
  personaMatch?: {
    matches: boolean;
    expectedProfile: string;
    detectedProfile: string;
  };
  error?: string;
}

export interface AnalysisV2Result extends DocumentAnalysisResult {
  ownerName?: string;
  date?: string;
  suggestedFileName?: string;
  originalFileName?: string;
  isIllegible?: boolean;
  errorMessage?: string;
  analysisMethod?: string;
  fraudScore?: number;
  fraudAudit?: {
    structureAnalysis?: { suspiciousAlignment: boolean; fontInconsistencies: boolean; details: string[] };
    mathematicalAudit?: { calculationErrors: boolean; brutNetDifference?: number; details: string[] };
    consistencyCheck?: { dateIssues: boolean; addressMismatch: boolean; details: string[] };
    metadataAnalysis?: { suspiciousCreator: boolean; creatorSoftware?: string; details: string[] };
  };
  document_metadata?: {
    type: string;
    owner_name: string;
    is_owner_match: boolean;
    date_emission: string;
    date_validite?: string;
    suggested_file_name: string;
    [key: string]: unknown;
  };
  financial_data?: {
    monthly_net_income: number;
    currency: string;
    is_recurring: boolean;
    extra_details?: { visale?: { numero_visa: string; date_validite: string; loyer_maximum_garanti: number; code_2d_doc?: string; code_2d_doc_valide?: boolean } };
  };
  trust_and_security?: {
    fraud_score: number;
    forensic_alerts: string[];
    math_validation: boolean;
    digital_seal_authenticated?: boolean;
    digital_seal_status?: string;
    needs_human_review?: boolean;
    human_review_reason?: string;
    partial_extraction?: boolean;
    extracted_fields?: string[];
  };
  ai_analysis?: {
    detected_profile: string;
    impact_on_patrimometer: number;
    expert_advice: string;
    improvement_tip?: string;
    visale_alert?: string;
  };
  needsHumanReview?: boolean;
  humanReviewReason?: string;
  partialExtraction?: boolean;
  extractedFields?: string[];
  improvementTip?: string;
  expertAdvice?: string;
  status?: string;
  message?: string;
}

export interface DocumentFile {
  id: string;
  file?: File;
  name: string;
  type: string;
  originalName?: string;
  suggestedName?: string;
  isRenamed?: boolean;
  category: string;
  status: 'scanning' | 'ANALYZING' | 'CERTIFIED' | 'NEEDS_REVIEW' | 'REJECTED' | 'ILLEGIBLE' | 'pending' | 'certified' | 'analyzing' | 'rejected' | 'illegible' | 'needs_review';
  url?: string;
  confidenceScore?: number;
  fraudScore?: number;
  flagged?: boolean;
  dateEmission?: string;
  dateExpiration?: string;
  needsHumanReview?: boolean;
  humanReviewReason?: string;
  partialExtraction?: boolean;
  extractedFields?: string[];
  improvementTip?: string;
  forceSent?: boolean;
  canForceSend?: boolean;
  categoryMatch?: boolean;
  subjectType?: 'tenant' | 'guarantor' | 'visale';
  subjectSlot?: 1 | 2;
  inconsistencyDetected?: boolean;
  inconsistencyJustification?: string;
  inconsistencyResolved?: boolean;
  extractedData?: {
    nom?: string;
    prenom?: string;
    montants?: number[];
    dates?: string[];
    employeur?: string;
    organisme?: string;
  };
  aiAnalysis?: {
    documentType: string;
    ownerName?: string;
    document_metadata?: { owner_name?: string };
    financial_data?: AnalysisV2Result['financial_data'];
    trust_and_security?: AnalysisV2Result['trust_and_security'];
    recommendations: string[];
    fraudIndicators?: {
      suspicious: boolean;
      reasons: string[];
    };
    fraudAudit?: {
      structureAnalysis?: { suspiciousAlignment: boolean; fontInconsistencies: boolean; details: string[] };
      mathematicalAudit?: { calculationErrors: boolean; brutNetDifference?: number; details: string[] };
      consistencyCheck?: { dateIssues: boolean; addressMismatch: boolean; details: string[] };
      metadataAnalysis?: { suspiciousCreator: boolean; creatorSoftware?: string; details: string[] };
    };
  };
  errorMessage?: string;
  analysisResult?: AnalysisV2Result;
  amount?: number;
  subject?: string;
  guarantorSlot?: number;
  evidenceKind?: string;
  [key: string]: unknown;
}

export type CandidateStatus = 'Etudiant' | 'Salarie' | 'Independant' | 'Retraite';
export type GuaranteeMode = 'NONE' | 'VISALE' | 'PHYSICAL';
export type VerificationMode = 'choice' | 'didit' | 'manual';

export interface Property {
  _id: string;
  name: string;
  address: string;
  rentAmount: number;
  chargesAmount?: number;
  photos?: string[];
  city?: string;
  surfaceM2?: number;
  type?: string;
  applyToken?: string;
  user?: string;
  ownerName?: string;
  [key: string]: unknown;
}

export interface CertificationItem {
  id: string;
  category: string;
  label: string;
  description: string;
  keywords: string[];
  required: boolean;
}

export interface AiFeedback {
  visible: boolean;
  message: string;
  type: 'success' | 'warning' | 'info';
}
