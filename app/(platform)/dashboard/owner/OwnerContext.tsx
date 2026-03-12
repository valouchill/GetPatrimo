'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

export interface Candidature {
  id: string;
  applyToken: string;
  isSealed: boolean;
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
  status: string;
  submittedAt: string;
  integrityScore?: { score: number; category: string; label: string };
  documentsCount?: number;
  certifiedDocumentsCount?: number;
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
}

export interface PropertyWithCandidatures {
  property: Property;
  candidatures: Candidature[];
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

  const activeEntry = data.find((d) => d.property.id === activePropertyId) ?? data[0] ?? null;

  return (
    <OwnerContext.Provider
      value={{ data, loading, activePropertyId, setActivePropertyId, activeEntry, userEmail, refresh: fetchData }}
    >
      {children}
    </OwnerContext.Provider>
  );
}
