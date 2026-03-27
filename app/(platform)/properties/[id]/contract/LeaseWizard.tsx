"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LeaseSchema } from "@/lib/schemas/lease";
import { WizardHeader } from "./wizard/WizardHeader";
import { StepLocataire } from "./wizard/StepLocataire";
import { StepBien } from "./wizard/StepBien";
import { StepConditions } from "./wizard/StepConditions";
import { StepDiagnostics } from "./wizard/StepDiagnostics";
import { StepRecap } from "./wizard/StepRecap";
import type {
  ApplicationRecord,
  CandidatureRecord,
  CompiledDocument,
  CompileMeta,
  LeaseFormData,
  PropertyRecord,
} from "./wizard/types";

const {
  computeSmartDeposit,
  deriveLeaseType,
  getTomorrowDateInputValue,
} = require("@/src/utils/leaseWizardShared");

type LeaseWizardProps = { propertyId: string };

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

export default function LeaseWizard({ propertyId }: LeaseWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [property, setProperty] = useState<PropertyRecord | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [legacyCandidature, setLegacyCandidature] = useState<CandidatureRecord | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [formData, setFormData] = useState<LeaseFormData>(buildInitialFormState());
  const [compileStatus, setCompileStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [compileError, setCompileError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [compiledDocuments, setCompiledDocuments] = useState<CompiledDocument[]>([]);
  const [compileMeta, setCompileMeta] = useState<CompileMeta | null>(null);

  const explicitApplicationId = searchParams.get("applicationId") || searchParams.get("tenantId") || "";
  const explicitCandidatureId = searchParams.get("candidatureId") || "";
  const depositTouchedRef = useRef(false);
  const appliedDraftKeyRef = useRef("");

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
    }).catch((error) => console.error("Erreur chargement propriété:", error));
  }, [propertyId]);

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
    }).catch((error) => console.error("Erreur chargement candidatures:", error));
  }, [explicitApplicationId, property?.acceptedTenantId, propertyId]);

  useEffect(() => {
    if (!explicitCandidatureId) return;
    fetch(`/api/owner/candidatures/${explicitCandidatureId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setLegacyCandidature(data))
      .catch((error) => console.error("Erreur chargement candidature legacy:", error));
  }, [explicitCandidatureId]);

  useEffect(() => {
    if (!property) return;
    setFormData((prev) => {
      const nextLeaseType = deriveLeaseType(property, prev.leaseType);
      const nextRent = Number(property.rentAmount || 0);
      return { ...prev, leaseType: prev.leaseType || nextLeaseType, rentHC: prev.rentHC || nextRent, charges: prev.charges || Number(property.chargesAmount || 0) };
    });
  }, [property]);

  useEffect(() => {
    if (depositTouchedRef.current) return;
    setFormData((prev) => ({ ...prev, deposit: computeSmartDeposit(prev.leaseType, prev.rentHC) }));
  }, [formData.leaseType, formData.rentHC]);

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
      setFormData((prev) => ({ ...prev, leaseType: parsed.leaseType || prev.leaseType, startDate: parsed.startDate || prev.startDate, deposit: Number(parsed.deposit ?? prev.deposit) || 0 }));
      if (parsed.deposit != null) depositTouchedRef.current = true;
      appliedDraftKeyRef.current = draftKey;
      window.sessionStorage.removeItem(draftKey);
    } catch (error) {
      console.error("Erreur lecture preset contractualisation:", error);
    }
  }, [propertyId, selectedApplication?.id]);

  const activeTenant = legacyCandidature || selectedApplication;
  const contractLocked = Boolean(selectedApplication?.isSealed);
  const selectionRequired = !legacyCandidature && applications.length > 0 && !selectedApplication;
  const comparisonHref = `/dashboard/owner/property/${propertyId}?tab=candidates`;
  const backHref = `/dashboard/owner/property/${propertyId}?tab=${selectedApplication ? "seal" : "candidates"}${
    selectedApplication?.id ? `&applicationId=${encodeURIComponent(selectedApplication.id)}` : ""
  }`;
  const tenantName = legacyCandidature
    ? `${legacyCandidature.firstName || ""} ${legacyCandidature.lastName || ""}`.trim()
    : `${selectedApplication?.profile?.firstName || ""} ${selectedApplication?.profile?.lastName || ""}`.trim();
  const tenantEmail = legacyCandidature?.email || selectedApplication?.userEmail || "";
  const tenantPhone = legacyCandidature?.phone || selectedApplication?.profile?.phone || "";
  const tenantIncome = legacyCandidature?.monthlyNetIncome || selectedApplication?.financialSummary?.totalMonthlyIncome || 0;

  useEffect(() => {
    if (!propertyId || !activeTenant) { setWarnings([]); return undefined; }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/owner/leases/check-readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId, applicationId: selectedApplication?.id, candidatureId: legacyCandidature?._id, formData }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        setCompileMeta((prev) => ({ ...(prev || {}), ...(data.compileMeta || {}) }));
      } catch (error) {
        if ((error as Error).name !== "AbortError") console.error("Erreur pré-validation Smart Lease:", error);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeoutId); };
  }, [propertyId, activeTenant, selectedApplication?.id, legacyCandidature?._id, formData]);

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDepositChange = (value: string) => {
    depositTouchedRef.current = true;
    handleFieldChange("deposit", Number(value) || 0);
  };

  const handleCompile = async () => {
    if (!activeTenant) { setCompileStatus("error"); setCompileError("Impossible de déterminer le locataire à contractualiser."); return; }
    const parsed = LeaseSchema.safeParse(formData);
    if (!parsed.success) { setCompileStatus("error"); setCompileError(parsed.error.issues[0]?.message || "Données de formulaire invalides"); return; }
    setCompileStatus("loading");
    setCompileError("");
    try {
      const response = await fetch("/api/owner/leases/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, applicationId: selectedApplication?.id, candidatureId: legacyCandidature?._id, formData }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.msg || "Compilation Smart Lease impossible");
      setWarnings(Array.isArray(data.warnings) ? data.warnings : warnings);
      setCompiledDocuments(data.documents || []);
      setCompileMeta(data.compileMeta || null);
      setCompileStatus("success");
    } catch (error) {
      setCompileStatus("error");
      setCompileError(error instanceof Error ? error.message : "Erreur inattendue");
    }
  };

  const handleDownload = async (url?: string, fileName?: string) => {
    if (!url) return;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Téléchargement impossible");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName || "smart-lease-document";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleReturnToComparison = (applicationId?: string) => {
    const url = new URL(`https://doc2loc.local/dashboard/owner/property/${propertyId}`);
    url.searchParams.set("tab", "candidates");
    if (applicationId) url.searchParams.set("applicationId", applicationId);
    router.push(`${url.pathname}${url.search}`);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f9fc_0%,#eef3f8_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <WizardHeader
          property={property}
          selectedApplication={selectedApplication}
          selectionRequired={selectionRequired}
          contractLocked={contractLocked}
          tenantName={tenantName}
          backHref={backHref}
          comparisonHref={comparisonHref}
          onNavigate={(href) => router.push(href)}
        />
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <StepLocataire
              applications={applications}
              selectedApplication={selectedApplication}
              legacyCandidature={legacyCandidature}
              property={property}
              selectionRequired={selectionRequired}
              contractLocked={contractLocked}
              tenantName={tenantName}
              tenantEmail={tenantEmail}
              tenantPhone={tenantPhone}
              tenantIncome={tenantIncome}
              onReturnToComparison={handleReturnToComparison}
              onReturnToComparisonHref={comparisonHref}
              onNavigate={(href) => router.push(href)}
            />
            {!selectionRequired && !contractLocked ? (
              <>
                <StepBien formData={formData} onFieldChange={handleFieldChange} onDepositChange={handleDepositChange} />
                <StepConditions formData={formData} onFieldChange={handleFieldChange} />
              </>
            ) : null}
          </section>
          <aside className="space-y-6">
            <StepDiagnostics
              selectedApplication={selectedApplication}
              formData={formData}
              compileMeta={compileMeta}
              warnings={warnings}
              compileStatus={compileStatus}
              compileError={compileError}
              contractLocked={contractLocked}
              onCompile={handleCompile}
            />
            <StepRecap
              compiledDocuments={compiledDocuments}
              selectedApplication={selectedApplication}
              onDownload={handleDownload}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
