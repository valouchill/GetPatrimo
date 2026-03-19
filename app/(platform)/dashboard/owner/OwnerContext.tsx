'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export interface Candidature {
  id: string;
  applyToken: string;
  isSealed: boolean;
  isUnlocked?: boolean;
  isTop3?: boolean;
  isOwnerSelected?: boolean;
  rank?: number;
  sealedLabel?: string;
  sealedId?: string;
  profile: { firstName: string; lastName: string; phone: string | null; email?: string | null };
  patrimometer: { score: number; grade: string };
  financialSummary?: {
    monthlyNetIncome?: number;
    contractType?: string;
    remainingIncome?: number;
    riskLevel?: string;
    riskPercent?: number;
  } | null;
  didit: { status: string };
  guarantor: { status: string; certificationMethod?: string };
  guarantee?: {
    mode?: 'NONE' | 'VISALE' | 'PHYSICAL';
    guarantors?: Array<{ slot: 1 | 2 }>;
  } | null;
  passport?: {
    state: 'draft' | 'review' | 'ready' | 'sealed';
    stateLabel: string;
    previewUrl?: string | null;
    shareUrl?: string | null;
    downloadUrl?: string | null;
    summary?: string;
    shareEnabled?: boolean;
    readinessReasons?: string[];
  } | null;
  ownerInsights?: {
    aiAudit?: {
      status: 'CLEAR' | 'REVIEW' | 'ALERT';
      score: number;
      summary: string;
      highlights?: string[];
      blockers?: string[];
      reviewReasons?: string[];
    };
    financial?: {
      monthlyIncome?: number;
      monthlyIncomeLabel?: string | null;
      rentAmount?: number;
      remainingIncome?: number | null;
      remainingIncomeLabel?: string | null;
      effortRate?: number | null;
      effortRateLabel?: string | null;
      riskBand?: {
        label: string;
        score: number;
        tone: string;
      };
      summary?: string;
    };
    quality?: {
      score: number;
      status?: { label: string; tone: string };
      summary?: string;
      certifiedDocuments?: number;
      reviewDocuments?: number;
      rejectedDocuments?: number;
      missingCriticalBlocks?: string[];
    };
    contractReadiness?: {
      ready: boolean;
      blockers?: string[];
      warnings?: string[];
      leaseType?: string;
      suggestedDepositLabel?: string | null;
    };
    decisionSummary?: {
      headline: string;
      strengths: string[];
      watchouts: string[];
      identityVerified: boolean;
      readyToLease: boolean;
      riskLabel: string;
    };
    comparison?: {
      scoreValue: number;
      scoreLabel: string;
      identityVerified: boolean;
      identityVerifiedLabel: string;
      monthlyIncomeLabel: string;
      remainingIncomeLabel: string;
      effortRateLabel: string;
      qualityLabel: string;
      qualityScore: number;
      guaranteeLabel: string;
      readyToLease: boolean;
      readyToLeaseLabel: string;
      riskLabel: string;
      auditLabel: string;
      masked: boolean;
    };
    tunnel?: {
      currentStep?: string;
      steps?: Array<{
        id: string;
        label: string;
        status: string;
        description: string;
      }>;
    };
    guarantee?: {
      mode?: 'NONE' | 'VISALE' | 'PHYSICAL';
      label?: string;
      status?: string;
      summary?: string;
    };
    pillars?: Array<{
      id: string;
      label: string;
      score: number;
      max: number;
      status: string;
      summary: string;
    }>;
  } | null;
  status: string;
  submittedAt: string;
  integrityScore?: { score: number; category: string; label: string };
  documentsCount?: number;
  certifiedDocumentsCount?: number;
}

export interface OwnerPropertyFlow {
  stage: 'search' | 'analysis' | 'selection' | 'contract' | 'management';
  stageLabel: string;
  stageTone: string;
  stageOrder: number;
  progress: number;
  unlocked?: boolean;
  summary: string;
  nextAction: {
    id: string;
    label: string;
    description?: string;
    href: string;
    kind: string;
    applicationId?: string | null;
  };
  compareHref?: string;
  guidance?: {
    currentStage: { id: string; label: string; tip: string; progress: number };
    completedStages: Array<{ id: string; label: string; tip: string }>;
    upcomingStages: Array<{ id: string; label: string; tip: string }>;
    contextualAdvice: string;
    whyThisStage: string;
    nextAction?: { label: string; href: string; kind: string; advice: string } | null;
  };
  focusCard?: {
    propertyId: string;
    priority: number;
    tone: string;
    eyebrow: string;
    title: string;
    reason: string;
    summary: string;
    metricLabel: string;
    metricValue: string | number;
    ctaLabel: string;
    ctaHref: string;
  };
  selectionState?: {
    mode: 'empty' | 'review' | 'compare' | 'selected';
    defaultTab: 'overview' | 'compare' | 'selected';
    compareHref: string;
    selectedCandidateId?: string | null;
    selectedCandidateLabel?: string | null;
    selectionReason?: string | null;
    finalistsCount: number;
    otherCandidatesCount: number;
    headline: string;
    body: string;
    primaryAction?: {
      label: string;
      href: string;
      kind: string;
    } | null;
  };
  primaryCandidateId?: string | null;
  selectedCandidateId?: string | null;
  selectionRequired?: boolean;
  sealedCount: number;
  readyToContractCount: number;
  totalCandidates: number;
  alerts: string[];
  blockers: string[];
  topCandidates?: OwnerPrimaryCandidate[];
  managementSummary: {
    tenantLabel: string;
    leaseStatusLabel: string;
    documentsLabel: string;
    nextMilestone: string;
    nextActions: string[];
    summary: string;
  };
}

export interface OwnerPrimaryCandidate {
  id: string | null;
  label: string;
  rank?: number | null;
  isTop3?: boolean;
  isOwnerSelected?: boolean;
  isUnlocked?: boolean;
  sealed: boolean;
  score: number;
  grade: string;
  passportState: string;
  passportStateLabel: string;
  guaranteeLabel: string;
  contractReady: boolean;
  auditStatus: string;
  auditSummary: string;
  remainingIncomeLabel?: string | null;
  effortRateLabel?: string | null;
}

export interface Property {
  id: string;
  title: string;
  address: string;
  rent?: number;
  surfaceM2?: number;
  chargesAmount?: number;
  applyToken?: string;
  archived?: boolean;
  managed?: boolean;
  isRented?: boolean;
  status?: string;
}

export interface PropertyWithCandidatures {
  property: Property;
  candidatures: Candidature[];
  flow: OwnerPropertyFlow;
  primaryCandidate?: OwnerPrimaryCandidate | null;
}

interface OwnerContextValue {
  data: PropertyWithCandidatures[];
  loading: boolean;
  activePropertyId: string | null;
  setActivePropertyId: (id: string) => void;
  activeEntry: PropertyWithCandidatures | null;
  userEmail: string;
  refresh: () => void;
}

const OwnerContext = createContext<OwnerContextValue | null>(null);

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error('useOwner must be used inside OwnerProvider');
  return ctx;
}

export function OwnerProvider({ userEmail, children }: { userEmail: string; children: ReactNode }) {
  const [data, setData] = useState<PropertyWithCandidatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch('/api/owner/properties')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: PropertyWithCandidatures[]) => {
        const list = Array.isArray(d) ? d : [];
        setData(list);
        if (typeof window !== 'undefined') {
          const stored = window.localStorage.getItem('owner:last-property-id');
          const storedEntry = stored ? list.find((entry) => entry.property.id === stored) : null;
          if (storedEntry) {
            setActivePropertyId(storedEntry.property.id);
            return;
          }
        }
        if (!activePropertyId && list.length > 0) {
          const first = list.find((e) => !e.property.archived && !e.property.isRented)
            ?? list.find((e) => !e.property.archived)
            ?? list[0];
          setActivePropertyId(first.property.id);
        }
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [activePropertyId]);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined' || !activePropertyId) return;
    window.localStorage.setItem('owner:last-property-id', activePropertyId);
  }, [activePropertyId]);

  const activeEntry = data.find((d) => d.property.id === activePropertyId) ?? data[0] ?? null;

  return (
    <OwnerContext.Provider
      value={{ data, loading, activePropertyId, setActivePropertyId, activeEntry, userEmail, refresh: fetchData }}
    >
      {children}
    </OwnerContext.Provider>
  );
}
