/**
 * Types ViewModel du Passeport Locatif — source unique de vérité.
 *
 * Extrait depuis l'ancien app/components/PassportPDF.tsx (V1 @react-pdf)
 * pour découpler le type de l'implémentation de rendu. Le rendu PDF actuel
 * passe par WeasyPrint via app/components/pdf/PassportTemplateV2.tsx
 * (cf. lib/passport-pdf-service.ts).
 *
 * Consommateurs :
 *  - lib/passport-pdf-service.ts (mapping ViewModel → Template V2 props)
 *  - lib/passport-html-template.ts (rendu HTML alternatif / debug)
 *  - app/api/passport/application/[id]/route.ts (réponse JSON publique)
 *  - app/api/passport/pdf/[id]/route.ts (génération PDF)
 *  - src/utils/passportViewModel.js (producer côté serveur Node)
 */

export interface PassportViewModel {
  id?: string | null;
  slug?: string;
  passportSlug: string;
  state: 'draft' | 'review' | 'ready' | 'sealed';
  stateLabel: string;
  stateMeta: {
    watermark: string;
  };
  shareEnabled: boolean;
  shareUrl: string | null;
  previewUrl: string | null;
  verificationUrl: string | null;
  score: number;
  grade: string;
  resilience?: {
    score: number;
    level: 'PLATINUM' | 'GOLD' | 'SILVER' | 'ALERTE';
    label: string;
    scoreLabel: string;
    source: 'v2' | 'legacy';
    isV2: boolean;
    cachedAt: string | null;
  };
  summary: string;
  readinessReasons: string[];
  warnings: string[];
  nextAction: string | null;
  /** Mot du locataire — présentation libre (optionnel, max 500), en-tête du passeport. */
  presentationText?: string;
  // Colocation — composition du foyer (mono → household null).
  householdLabel?: string;
  household?: {
    isColocation: boolean;
    size: number;
    label: string;
    certifiedCount: number;
    members: Array<{
      slot: number;
      name: string;
      profile: string | null;
      identityVerified: boolean;
      isPrimary: boolean;
    }>;
  } | null;
  hero: {
    name: string;
    fullName: string;
    profession: string;
    region: string;
    propertyName: string;
    gradeLabel: string;
    badge: string;
    candidateStatus: string | null;
    identityVerified: boolean;
  };
  solvency: {
    monthlyIncome: number;
    exactMonthlyIncome: number;
    monthlyIncomeLabel: string | null;
    exactMonthlyIncomeLabel: string | null;
    rentAmount: number;
    rentAmountLabel: string | null;
    effortRate: number | null;
    effortRateLabel: string | null;
    certifiedIncome: boolean;
  };
  guarantee: {
    mode: 'NONE' | 'VISALE' | 'PHYSICAL';
    label: string;
    score: number;
    status: string;
    summary: string;
    shareBadge: string;
    requirement: string;
    satisfied: boolean;
    guarantors: Array<{
      slot: 1 | 2;
      profile: string;
      score: number;
      status: string;
      certificationMethod: string | null;
      label: string;
    }>;
    /** Type de garantie lisible (Visale / Garant physique / Aucune). */
    typeLabel?: string;
    /** Nom (ou descripteur) du garant, si disponible. */
    guarantorName?: string | null;
    /** Revenus nets mensuels du garant formatés, si disponibles. */
    guarantorIncomeLabel?: string | null;
  };
  pillars: Array<{
    id: string;
    label: string;
    score: number;
    max: number;
    verified: boolean;
    status: string;
    summary: string;
    certifiedCount: number;
    reviewCount: number;
    rejectedCount: number;
  }>;
  documentCoverage: {
    counts: {
      totalDocuments: number;
      tenantDocuments: number;
      certifiedDocuments: number;
      reviewDocuments: number;
      rejectedDocuments: number;
      viewCount: number;
      shareCount: number;
    };
    blocks: Array<{
      id: string;
      label: string;
      status: string;
      certifiedCount: number;
      reviewCount: number;
      rejectedCount: number;
      totalCount: number;
      latestDocumentAt: string | null;
    }>;
  };
  documentLinks: Array<{
    id: string;
    label: string;
    category: string | null;
    type: string | null;
    fileName: string | null;
    auditStatus: string;
    url: string;
  }>;
  auditTimeline: Array<{
    id: string;
    title: string;
    status: string;
    time: string | null;
    description: string;
  }>;
  metrics: {
    viewCount: number;
    shareCount: number;
    passportId: string;
    generatedAt: string | null;
    validUntil: string | null;
    certificationDate: string | null;
  };
  marketing?: {
    ownerSignupUrl: string | null;
    verifyUrl: string | null;
    requestAuditUrl: string | null;
    homepageUrl: string | null;
    candidateFirstName: string | null;
    propertyName: string | null;
  };
  /**
   * V6.5 — Cache de l'analyse neuro-symbolique (cf. Application.aiAuditV2).
   * Optionnel : présent uniquement si POST /analyze-v2 a déjà été lancé.
   * Le PDF V2 consomme aiAuditV2.ai.forensicAudit pour la Trust-List enrichie
   * et aiAuditV2.resilience.level pour le badge métal du hero.
   */
  aiAuditV2?: {
    ai: {
      forensicAudit?: Array<{
        checkName: string;
        status: 'VERIFIED' | 'WARNING' | 'ALERT';
        details: string;
      }>;
    };
    resilience: {
      score?: number;
      level?: 'PLATINUM' | 'GOLD' | 'SILVER' | 'ALERTE';
    };
    meta?: { model: string; analyzedAt: string };
    cachedAt?: string;
  } | null;
}
