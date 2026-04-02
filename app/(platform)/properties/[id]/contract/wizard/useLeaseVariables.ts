'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TemplateParagraph, PreviewData, LeaseFormData, CompileMeta } from './types';

// Client-side mapping: form fields → template variable names
// This allows instant preview updates without server roundtrip
const FORM_TO_VARS: Record<string, string[]> = {
  rentHC: ['loyer_mensuel', 'loyer_principal_chiffres', 'loyer_chiffres', 'mention_loyer_chiffres'],
  charges: ['forfait_charges_mensuel', 'charges_chiffres', 'mention_charges_chiffres', 'montant_provisions_charges'],
  deposit: ['depot_garantie', 'depot_garantie_chiffres'],
  startDate: ['date_debut_location', 'date_effet_bail', 'date_prise_effet'],
  durationMonths: ['duree_bail_mois', 'duree_contrat', 'duree_location'],
  paymentDay: ['paiement_jour_mois'],
  clauses: ['autres_conditions_particulieres'],
};

function formatAmount(value: number): string {
  return value.toFixed(2);
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  } catch {
    return dateStr;
  }
}

function applyClientOverrides(
  mergeData: Record<string, string>,
  formData: LeaseFormData,
): Record<string, string> {
  const updated = { ...mergeData };

  // Rent
  for (const key of FORM_TO_VARS.rentHC) {
    updated[key] = formatAmount(formData.rentHC);
  }

  // Charges
  for (const key of FORM_TO_VARS.charges) {
    updated[key] = formatAmount(formData.charges);
  }

  // Deposit
  for (const key of FORM_TO_VARS.deposit) {
    updated[key] = formatAmount(formData.deposit);
  }

  // Start date
  const formattedDate = formatDateFR(formData.startDate);
  for (const key of FORM_TO_VARS.startDate) {
    updated[key] = formattedDate;
  }

  // Duration
  for (const key of FORM_TO_VARS.durationMonths) {
    updated[key] = String(formData.durationMonths);
  }

  // Payment day
  for (const key of FORM_TO_VARS.paymentDay) {
    updated[key] = String(formData.paymentDay);
  }

  // Clauses
  if (formData.clauses) {
    for (const key of FORM_TO_VARS.clauses) {
      updated[key] = formData.clauses;
    }
  }

  return updated;
}

interface UseLeaseVariablesOptions {
  propertyId: string;
  applicationId?: string;
  candidatureId?: string;
  formData: LeaseFormData;
  enabled: boolean; // Only fetch when tenant is selected
}

interface UseLeaseVariablesResult {
  paragraphs: TemplateParagraph[];
  mergeData: Record<string, string>;
  rawData: Record<string, string>;
  filledCount: number;
  totalCount: number;
  warnings: string[];
  compileMeta: CompileMeta | null;
  isLoading: boolean;
  error: string;
}

export function useLeaseVariables({
  propertyId,
  applicationId,
  candidatureId,
  formData,
  enabled,
}: UseLeaseVariablesOptions): UseLeaseVariablesResult {
  const [paragraphs, setParagraphs] = useState<TemplateParagraph[]>([]);
  const [serverMergeData, setServerMergeData] = useState<Record<string, string>>({});
  const [rawData, setRawData] = useState<Record<string, string>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [serverFilledCount, setServerFilledCount] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [compileMeta, setCompileMeta] = useState<CompileMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchKeyRef = useRef('');

  // Full server fetch
  const fetchPreview = useCallback(async (fd: LeaseFormData) => {
    if (!propertyId || !enabled) return;

    const fetchKey = `${propertyId}:${applicationId || ''}:${candidatureId || ''}:${fd.leaseType}`;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/owner/leases/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          applicationId: applicationId || undefined,
          candidatureId: candidatureId || undefined,
          formData: fd,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      const data: PreviewData = await res.json();
      setParagraphs(data.paragraphs || []);
      setServerMergeData(data.mergeData || {});
      setRawData(data.rawData || {});
      setTotalCount(data.totalVariables || 0);
      setServerFilledCount(data.filledVariables || 0);
      setWarnings(data.warnings || []);
      setCompileMeta(data.compileMeta || null);
      lastFetchKeyRef.current = fetchKey;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, applicationId, candidatureId, enabled]);

  // Initial fetch + refetch when tenant or lease type changes
  useEffect(() => {
    if (!enabled) return;
    fetchPreview(formData);
    // Only refetch on tenant/leaseType change, not every form change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, applicationId, candidatureId, formData.leaseType, enabled]);

  // Debounced refetch on form changes (for server-computed values)
  useEffect(() => {
    if (!enabled || !lastFetchKeyRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview(formData);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.rentHC, formData.charges, formData.deposit, formData.startDate, formData.durationMonths, formData.paymentDay]);

  // Apply client-side overrides for instant feedback
  const mergeData = serverMergeData ? applyClientOverrides(serverMergeData, formData) : {};

  // Approximate filled count (use server count + check our overrides)
  const filledCount = serverFilledCount;

  return {
    paragraphs,
    mergeData,
    rawData,
    filledCount,
    totalCount,
    warnings,
    compileMeta,
    isLoading,
    error,
  };
}
