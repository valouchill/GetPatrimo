"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LeaseSchema } from "@/lib/schemas/lease";
import { CompactHeader } from "./wizard/CompactHeader";
import { ContractPreview } from "./wizard/ContractPreview";
import { FormPanel } from "./wizard/FormPanel";
import { ActionFooter } from "./wizard/ActionFooter";
import { useLeaseVariables } from "./wizard/useLeaseVariables";
import type {
  ApplicationRecord,
  CandidatureRecord,
  CompiledDocument,
  LeaseFormData,
  PropertyRecord,
} from "./wizard/types";

const {
  computeSmartDeposit,
  deriveLeaseType,
  getTomorrowDateInputValue,
} = require("@/src/utils/leaseWizardShared");

type LeaseWizardProps = { propertyId: string; returnUrl?: string };

function buildInitialFormState(property?: PropertyRecord | null): LeaseFormData {
  const leaseType = deriveLeaseType(property || {}, null);
  const rentHC = Number(property?.rentAmount || 0);
  return {
    leaseType,
    startDate: getTomorrowDateInputValue(),
    paymentDay: 5,
    rentHC,
    charges: Number(property?.chargesAmount || 0),
    deposit: computeSmartDeposit(leaseType, rentHC),
    durationMonths: leaseType === "MOBILITE" ? 10 : 12,
    clauses: "",
  };
}

async function fetchOwnerResource<T>(url: string, retries = 2): Promise<{ ok: boolean; data?: T }> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { cache: "no-store" });
    if (response.ok) return { ok: true, data: await response.json() };
    const shouldRetry = (response.status === 401 || response.status === 404) && attempt < retries;
    if (!shouldRetry) return { ok: false };
    await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
  }
  return { ok: false };
}

export default function LeaseWizard({ propertyId, returnUrl: returnUrlProp }: LeaseWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [property, setProperty] = useState<PropertyRecord | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [legacyCandidature, setLegacyCandidature] = useState<CandidatureRecord | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [formData, setFormData] = useState<LeaseFormData>(buildInitialFormState());
  const [compileStatus, setCompileStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [compileError, setCompileError] = useState("");
  const [compiledDocuments, setCompiledDocuments] = useState<CompiledDocument[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [activeTab, setActiveTab] = useState<"contrat" | "formulaire">("formulaire");

  const explicitApplicationId = searchParams.get("applicationId") || searchParams.get("tenantId") || "";
  const explicitCandidatureId = searchParams.get("candidatureId") || "";
  const returnUrl = returnUrlProp || searchParams.get("returnUrl") || "/dashboard/owner";
  const depositTouchedRef = useRef(false);
  const appliedDraftKeyRef = useRef("");

  // ── Load property ─────────────────────────────────────────────
  useEffect(() => {
    if (!propertyId) return;
    fetchOwnerResource<PropertyRecord>(`/api/owner/properties/${propertyId}`).then((res) => {
      if (!res.ok || !res.data) return;
      setProperty(res.data);
      setFormData((prev) => ({
        ...prev,
        ...buildInitialFormState(res.data),
        startDate: prev.startDate || getTomorrowDateInputValue(),
        paymentDay: prev.paymentDay || 5,
        clauses: prev.clauses,
      }));
    }).catch(console.error);
  }, [propertyId]);

  // ── Load candidatures ─────────────────────────────────────────
  useEffect(() => {
    if (!propertyId) return;
    fetchOwnerResource<{ candidatures?: ApplicationRecord[]; selectedCandidateId?: string | null }>(
      `/api/owner/properties/${propertyId}/candidatures`
    ).then((res) => {
      if (!res.ok || !res.data) return;
      const list = Array.isArray(res.data.candidatures) ? res.data.candidatures : [];
      const selectedId = String(explicitApplicationId || res.data.selectedCandidateId || property?.acceptedTenantId || "");
      setApplications(list);
      setSelectedApplicationId(selectedId && list.some((a) => a.id === selectedId) ? selectedId : "");
    }).catch(console.error);
  }, [explicitApplicationId, property?.acceptedTenantId, propertyId]);

  // ── Load legacy candidature ───────────────────────────────────
  useEffect(() => {
    if (!explicitCandidatureId) return;
    fetch(`/api/owner/candidatures/${explicitCandidatureId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setLegacyCandidature(data))
      .catch(console.error);
  }, [explicitCandidatureId]);

  // ── Sync form with property ───────────────────────────────────
  useEffect(() => {
    if (!property) return;
    setFormData((prev) => {
      const nextLeaseType = deriveLeaseType(property, prev.leaseType);
      const nextRent = Number(property.rentAmount || 0);
      return {
        ...prev,
        leaseType: prev.leaseType || nextLeaseType,
        rentHC: prev.rentHC || nextRent,
        charges: prev.charges || Number(property.chargesAmount || 0),
      };
    });
  }, [property]);

  // ── Auto-compute deposit ──────────────────────────────────────
  useEffect(() => {
    if (depositTouchedRef.current) return;
    setFormData((prev) => ({ ...prev, deposit: computeSmartDeposit(prev.leaseType, prev.rentHC) }));
  }, [formData.leaseType, formData.rentHC]);

  // ── Selected application ──────────────────────────────────────
  const selectedApplication =
    applications.find((a) => a.id === selectedApplicationId) ||
    applications.find((a) => a.id === explicitApplicationId) ||
    applications.find((a) => a.id === String(property?.acceptedTenantId || "")) ||
    null;

  useEffect(() => {
    if (selectedApplication?.id && selectedApplication.id !== selectedApplicationId) {
      setSelectedApplicationId(selectedApplication.id);
    }
  }, [selectedApplication, selectedApplicationId]);

  // ── Restore draft ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedApplication?.id || typeof window === "undefined") return;
    const candidateScopedKey = `lease-draft:${propertyId}:${selectedApplication.id}`;
    const fallbackKey = `lease-draft:${propertyId}`;
    const draftKey = window.sessionStorage.getItem(candidateScopedKey)
      ? candidateScopedKey
      : window.sessionStorage.getItem(fallbackKey) ? fallbackKey : "";
    if (!draftKey || appliedDraftKeyRef.current === draftKey) return;
    try {
      const rawDraft = window.sessionStorage.getItem(draftKey);
      if (!rawDraft) return;
      const parsed = JSON.parse(rawDraft);
      setFormData((prev) => ({
        ...prev,
        leaseType: parsed.leaseType || prev.leaseType,
        startDate: parsed.startDate || prev.startDate,
        deposit: Number(parsed.deposit ?? prev.deposit) || 0,
      }));
      if (parsed.deposit != null) depositTouchedRef.current = true;
      appliedDraftKeyRef.current = draftKey;
      window.sessionStorage.removeItem(draftKey);
    } catch (error) {
      console.error("Erreur lecture preset contractualisation:", error);
    }
  }, [propertyId, selectedApplication?.id]);

  // ── Derived values ────────────────────────────────────────────
  const activeTenant = legacyCandidature || selectedApplication;
  const contractLocked = Boolean(selectedApplication?.isSealed);
  const selectionRequired = !legacyCandidature && applications.length > 0 && !selectedApplication;
  const tenantName = legacyCandidature
    ? `${legacyCandidature.firstName || ""} ${legacyCandidature.lastName || ""}`.trim()
    : `${selectedApplication?.profile?.firstName || ""} ${selectedApplication?.profile?.lastName || ""}`.trim();
  const tenantEmail = legacyCandidature?.email || selectedApplication?.userEmail || "";
  const tenantPhone = legacyCandidature?.phone || selectedApplication?.profile?.phone || "";
  const tenantIncome = legacyCandidature?.monthlyNetIncome || selectedApplication?.financialSummary?.totalMonthlyIncome || 0;

  // ── Live preview hook ─────────────────────────────────────────
  const preview = useLeaseVariables({
    propertyId,
    applicationId: selectedApplication?.id,
    candidatureId: legacyCandidature?._id,
    formData,
    enabled: Boolean(activeTenant) && !contractLocked && !selectionRequired,
  });

  // ── Form handlers ─────────────────────────────────────────────
  const handleFieldChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDepositChange = (value: string) => {
    depositTouchedRef.current = true;
    handleFieldChange("deposit", Number(value) || 0);
  };

  // ── Compile ───────────────────────────────────────────────────
  const handleCompile = async () => {
    if (!activeTenant) {
      setCompileStatus("error");
      setCompileError("Aucun locataire sélectionné.");
      return;
    }
    const parsed = LeaseSchema.safeParse(formData);
    if (!parsed.success) {
      setCompileStatus("error");
      setCompileError(parsed.error.issues[0]?.message || "Données invalides");
      return;
    }
    setCompileStatus("loading");
    setCompileError("");
    try {
      const response = await fetch("/api/owner/leases/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          applicationId: selectedApplication?.id,
          candidatureId: legacyCandidature?._id,
          formData,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.msg || "Impossible de générer le bail");
      setCompiledDocuments(data.documents || []);
      setCompileStatus("success");
    } catch (error) {
      setCompileStatus("error");
      setCompileError(error instanceof Error ? error.message : "Erreur inattendue");
    }
  };

  // ── Download ──────────────────────────────────────────────────
  const handleDownload = async (url?: string, fileName?: string) => {
    if (!url) return;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Téléchargement impossible");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName || "document";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  // ── Save lease ────────────────────────────────────────────────
  const handleSaveLease = async () => {
    if (!activeTenant) {
      setSaveStatus("error");
      setSaveError("Aucun locataire sélectionné");
      return;
    }
    setSaveStatus("loading");
    setSaveError("");
    try {
      const [firstName, ...rest] = tenantName.split(" ");
      const response = await fetch("/api/leases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          applicationId: selectedApplication?.id || undefined,
          candidatureId: legacyCandidature?._id || undefined,
          tenantFirstName: firstName || "",
          tenantLastName: rest.join(" ") || "",
          tenantEmail,
          tenantPhone,
          leaseType: formData.leaseType,
          startDate: formData.startDate,
          durationMonths: formData.durationMonths,
          rentAmount: formData.rentHC,
          chargesAmount: formData.charges,
          depositAmount: formData.deposit,
          paymentDay: formData.paymentDay,
          additionalClauses: formData.clauses,
          generatedDocuments: compiledDocuments.map((doc) => ({
            kind: doc.kind,
            template: doc.template || "",
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            docxPath: doc.docxPath || "",
            pdfPath: doc.pdfPath || "",
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.msg || "Impossible d'enregistrer");
      setSaveStatus("success");
      window.setTimeout(() => router.push("/dashboard/owner?page=baux"), 1500);
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Erreur inattendue");
    }
  };

  // ── Navigation ────────────────────────────────────────────────
  const handleBack = () => {
    const appParam = selectedApplication?.id ? `?applicationId=${encodeURIComponent(selectedApplication.id)}` : "";
    router.push(`${returnUrl}${appParam}`);
  };

  const handleReturnToComparison = () => {
    router.push(returnUrl);
  };

  const canCompile = Boolean(activeTenant) && !contractLocked && !selectionRequired;

  return (
    <div className="min-h-screen bg-slate-50">
      <CompactHeader
        propertyName={property?.name || ""}
        propertyAddress={property?.address || ""}
        tenantName={tenantName}
        leaseType={formData.leaseType}
        filledCount={preview.filledCount}
        totalCount={preview.totalCount}
        selectionRequired={selectionRequired}
        contractLocked={contractLocked}
        onBack={handleBack}
      />

      {/* Desktop: split-view */}
      <div className="hidden lg:grid lg:grid-cols-2" style={{ height: "calc(100vh - 56px - 57px)" }}>
        {/* Left: contract preview */}
        <div className="overflow-y-auto border-r border-slate-200 bg-slate-50">
          <ContractPreview
            paragraphs={preview.paragraphs}
            mergeData={preview.mergeData}
            rawData={preview.rawData}
            isLoading={preview.isLoading}
          />
        </div>

        {/* Right: form */}
        <div className="overflow-y-auto bg-slate-50 p-6">
          <FormPanel
            property={property}
            selectedApplication={selectedApplication}
            legacyCandidature={legacyCandidature}
            tenantName={tenantName}
            tenantEmail={tenantEmail}
            tenantPhone={tenantPhone}
            tenantIncome={tenantIncome}
            selectionRequired={selectionRequired}
            contractLocked={contractLocked}
            formData={formData}
            onFieldChange={handleFieldChange}
            onDepositChange={handleDepositChange}
            onReturnToComparison={handleReturnToComparison}
          />
        </div>
      </div>

      {/* Mobile: tabs */}
      <div className="lg:hidden">
        {/* Tab bar */}
        <div className="sticky top-14 z-30 flex border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab("contrat")}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
              activeTab === "contrat"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Contrat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("formulaire")}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
              activeTab === "formulaire"
                ? "border-b-2 border-orange-500 text-orange-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Formulaire
          </button>
        </div>

        {/* Tab content */}
        <div className="pb-24">
          {activeTab === "contrat" ? (
            <ContractPreview
              paragraphs={preview.paragraphs}
              mergeData={preview.mergeData}
              rawData={preview.rawData}
              isLoading={preview.isLoading}
            />
          ) : (
            <div className="p-4">
              <FormPanel
                property={property}
                selectedApplication={selectedApplication}
                legacyCandidature={legacyCandidature}
                tenantName={tenantName}
                tenantEmail={tenantEmail}
                tenantPhone={tenantPhone}
                tenantIncome={tenantIncome}
                selectionRequired={selectionRequired}
                contractLocked={contractLocked}
                formData={formData}
                onFieldChange={handleFieldChange}
                onDepositChange={handleDepositChange}
                onReturnToComparison={handleReturnToComparison}
              />
            </div>
          )}
        </div>
      </div>

      <ActionFooter
        filledCount={preview.filledCount}
        totalCount={preview.totalCount}
        warningsCount={preview.warnings.length}
        compileStatus={compileStatus}
        compileError={compileError}
        saveStatus={saveStatus}
        saveError={saveError}
        compiledDocuments={compiledDocuments}
        canCompile={canCompile}
        onCompile={handleCompile}
        onSave={handleSaveLease}
        onDownload={handleDownload}
      />
    </div>
  );
}
