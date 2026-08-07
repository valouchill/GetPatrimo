'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TemplateParagraph, PreviewData, LeaseFormData, CompileMeta } from './types';

// Client-side mapping: form fields → template variable names
// This allows instant preview updates without server roundtrip.
// Exporté : LeaseWizard s'en sert pour traduire les champs obligatoires
// manquants (useFormCompletion) en noms de variables à surligner en rouge
// dans l'aperçu.
export const FORM_TO_VARS: Record<string, string[]> = {
  // Core
  rentHC: ['loyer_mensuel', 'loyer_principal_chiffres', 'loyer_chiffres', 'mention_loyer_chiffres'],
  charges: ['forfait_charges_mensuel', 'charges_chiffres', 'mention_charges_chiffres', 'montant_provisions_charges'],
  deposit: ['depot_garantie', 'depot_garantie_chiffres'],
  startDate: ['date_debut_location', 'date_effet_bail', 'date_prise_effet'],
  durationMonths: ['duree_bail_mois', 'duree_contrat', 'duree_location'],
  paymentDay: ['paiement_jour_mois'],
  clauses: ['autres_conditions_particulieres'],
  // Property
  surfaceHabitable: ['surface_habitable_m2', 'surface_totale_m2'],
  rooms: ['nb_pieces_principales', 'nb_pieces_places'],
  dpeClass: ['dpe_classe'],
  modeChauffage: ['mode_chauffage'],
  modeEauChaude: ['mode_eau_chaude'],
  // Financial
  irlReference: ['irl_reference'],
  irlReferenceDate: ['irl_reference_date'],
  loyerReference: ['loyer_reference'],
  loyerReferenceMajore: ['loyer_reference_majore'],
  complementLoyer: ['complement_loyer', 'complement_loyer_details'],
  // Payment
  paymentMode: ['mode_paiement'],
  paymentLocation: ['lieu_paiement'],
  // Mandataire
  mandataireNomPrenom: ['mandataire_nom_prenom'],
  mandataireDenomination: ['mandataire_denomination'],
  mandataireAdresse: ['mandataire_adresse'],
  mandataireActivite: ['mandataire_activite'],
  mandataireCartePro: ['mandataire_carte_pro'],
};

const CHECKBOX_SYMBOL = '[X]';
const UNCHECKED_SYMBOL = '[ ]';

// Checkbox fields that map formData booleans to template coche_ variables
const CHECKBOX_MAPPINGS: Record<string, { trueVar: string; falseVar: string }> = {
  loyerRevise: { trueVar: 'coche_loyer_revise_oui', falseVar: 'coche_loyer_revise_non' },
  soumisDecretRelocation: { trueVar: 'coche_decret_loyers_oui', falseVar: 'coche_decret_loyers_non' },
  soumisLoyerReferenceMajore: { trueVar: 'coche_loyer_ref_majore_oui', falseVar: 'coche_loyer_ref_majore_non' },
  paymentInArrears: { trueVar: 'coche_paiement_terme_echu', falseVar: 'coche_paiement_a_echoir' },
  hasMandataire: { trueVar: 'coche_mandataire_oui', falseVar: 'coche_mandataire_non' },
  isSocieteCivile: { trueVar: 'coche_societe_civile_oui', falseVar: 'coche_societe_civile_non' },
  usageMixte: { trueVar: 'coche_usage_mixte', falseVar: 'coche_usage_habitation' },
  balcony: { trueVar: 'coche_balcon', falseVar: '' },
  terrace: { trueVar: 'coche_terrasse', falseVar: '' },
  garden: { trueVar: 'coche_jardin', falseVar: '' },
  loggia: { trueVar: 'coche_loggia', falseVar: '' },
  garageVelo: { trueVar: 'coche_garage_velo', falseVar: '' },
  grenier: { trueVar: 'coche_grenier', falseVar: '' },
  comble: { trueVar: 'coche_comble', falseVar: '' },
  airesJeux: { trueVar: 'coche_aires_jeux', falseVar: '' },
  ascenseur: { trueVar: 'coche_ascenseur', falseVar: '' },
  espacesVerts: { trueVar: 'coche_espaces_verts', falseVar: '' },
  gardiennage: { trueVar: 'coche_gardiennage', falseVar: '' },
  laverie: { trueVar: 'coche_laverie', falseVar: '' },
  localPoubelle: { trueVar: 'coche_local_poubelle', falseVar: '' },
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

  // String fields (property, financial, payment, mandataire)
  const stringFields = [
    'surfaceHabitable', 'rooms', 'dpeClass', 'modeChauffage', 'modeEauChaude',
    'irlReference', 'irlReferenceDate', 'loyerReference', 'loyerReferenceMajore',
    'complementLoyer', 'paymentMode', 'paymentLocation',
    'mandataireNomPrenom', 'mandataireDenomination', 'mandataireAdresse',
    'mandataireActivite', 'mandataireCartePro',
  ] as const;

  for (const field of stringFields) {
    const val = (formData as Record<string, unknown>)[field];
    if (val !== undefined && val !== null && val !== '' && FORM_TO_VARS[field]) {
      for (const key of FORM_TO_VARS[field]) {
        updated[key] = String(val);
      }
    }
  }

  // Checkbox fields
  for (const [field, mapping] of Object.entries(CHECKBOX_MAPPINGS)) {
    const val = Boolean((formData as Record<string, unknown>)[field]);
    if (mapping.trueVar) updated[mapping.trueVar] = val ? CHECKBOX_SYMBOL : UNCHECKED_SYMBOL;
    if (mapping.falseVar) updated[mapping.falseVar] = val ? UNCHECKED_SYMBOL : CHECKBOX_SYMBOL;
  }

  // Cave/garage/parking (string presence = checked)
  if (formData.caveNumero) updated['coche_cave'] = CHECKBOX_SYMBOL;
  if (formData.garageNumero) updated['coche_garage'] = CHECKBOX_SYMBOL;
  if (formData.parkingNumber) updated['coche_parking'] = CHECKBOX_SYMBOL;
  if (formData.caveNumero) updated['cave_numero'] = String(formData.caveNumero).trim();
  if (formData.garageNumero) updated['garage_numero'] = String(formData.garageNumero).trim();
  if (formData.parkingNumber) updated['parking_numero'] = String(formData.parkingNumber).trim();

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
  /** Compteur AVANT toute édition : « N champs remplis depuis le dossier ». */
  initialFilledCount: number;
  /** Variables issues d'une identité certifiée eIDAS (Didit) → badge ✓. */
  verifiedVariables: string[];
  warnings: string[];
  compileMeta: CompileMeta | null;
  isLoading: boolean;
  error: string;
  refetch: () => void;
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

  const [verifiedVariables, setVerifiedVariables] = useState<string[]>([]);
  const [initialFilledCount, setInitialFilledCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchKeyRef = useRef('');
  const initialCountCapturedRef = useRef('');

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
      setVerifiedVariables((data as { verifiedVariables?: string[] }).verifiedVariables || []);
      // Le compteur « pré-rempli automatiquement » est celui de la PREMIÈRE
      // réponse pour ce locataire (avant toute édition du bailleur).
      if (initialCountCapturedRef.current !== fetchKey) {
        initialCountCapturedRef.current = fetchKey;
        setInitialFilledCount(data.filledVariables || 0);
      }
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
  }, [
    formData.rentHC, formData.charges, formData.deposit, formData.startDate,
    formData.durationMonths, formData.paymentDay, formData.surfaceHabitable,
    formData.rooms, formData.dpeClass, formData.modeChauffage, formData.modeEauChaude,
    formData.hasMandataire, formData.loyerRevise, formData.soumisDecretRelocation,
    formData.mobilityReason,
  ]);

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
    initialFilledCount,
    verifiedVariables,
    warnings,
    compileMeta,
    isLoading,
    error,
    refetch: () => fetchPreview(formData),
  };
}
