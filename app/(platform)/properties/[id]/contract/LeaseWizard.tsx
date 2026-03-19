"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Crown,
  Download,
  FileSearch,
  FileText,
  Home,
  Lock,
  Loader2,
  ScrollText,
  Shield,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  ActionBar,
  EmptyState,
  InfoRow,
  MetricTile,
  PremiumSectionHeader,
  PremiumSurface,
  QuickStat,
  StageRail,
  StatusBadge,
} from "@/app/components/ui/premium";

const {
  computeSmartDeposit,
  deriveLeaseType,
  getTomorrowDateInputValue,
} = require("@/src/utils/leaseWizardShared");

type PropertyRecord = {
  _id?: string;
  acceptedTenantId?: string | null;
  name?: string;
  address?: string;
  rentAmount?: number;
  chargesAmount?: number;
  surfaceM2?: number;
  type?: string;
  furnished?: string;
  managed?: boolean;
  status?: string;
  flow?: {
    stage?: "search" | "analysis" | "selection" | "contract" | "management";
    stageLabel?: string;
    summary?: string;
  };
};

type ApplicationRecord = {
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

type CandidatureRecord = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  monthlyNetIncome?: number;
  guarantorType?: string;
  hasGuarantor?: boolean;
};

type CompiledDocument = {
  kind: "lease" | "guarantee";
  fileName: string;
  mimeType: string;
  secureUrl?: string;
  pdfUrl?: string;
};

type LeaseWizardProps = {
  propertyId: string;
};

function buildInitialFormState(property?: PropertyRecord | null) {
  const leaseType = deriveLeaseType(property || {}, null);
  const rentHC = Number(property?.rentAmount || 0);

  return {
    leaseType,
    startDate: getTomorrowDateInputValue(),
    paymentDay: 5,
    rentHC,
    charges: Number(property?.chargesAmount || 0),
    deposit: computeSmartDeposit(leaseType, rentHC),
    durationMonths: leaseType === "mobilite" ? 10 : 12,
    clauses: "",
  };
}

function auditBadge(status?: string) {
  if (status === "ALERT") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function progressWidth(value?: number | null, max = 100) {
  const width = Math.max(4, Math.min(100, ((Number(value || 0) / max) * 100)));
  return `${width}%`;
}

async function fetchOwnerResource<T>(url: string, retries = 2): Promise<{ ok: boolean; data?: T }> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, { cache: "no-store" });

    if (response.ok) {
      return { ok: true, data: await response.json() };
    }

    const shouldRetry = (response.status === 401 || response.status === 404) && attempt < retries;
    if (!shouldRetry) {
      return { ok: false };
    }

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
  const [formData, setFormData] = useState(buildInitialFormState());
  const [compileStatus, setCompileStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [compileError, setCompileError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [compiledDocuments, setCompiledDocuments] = useState<CompiledDocument[]>([]);
  const [compileMeta, setCompileMeta] = useState<{ leaseType?: string; hasGuarantee?: boolean; signerRoles?: string[]; warnings?: string[] } | null>(null);

  const explicitApplicationId = searchParams.get("applicationId") || searchParams.get("tenantId") || "";
  const explicitCandidatureId = searchParams.get("candidatureId") || "";
  const depositTouchedRef = useRef(false);
  const appliedDraftKeyRef = useRef("");

  useEffect(() => {
    if (!propertyId) return;

    const loadProperty = async () => {
      try {
        const response = await fetchOwnerResource<PropertyRecord>(`/api/owner/properties/${propertyId}`);
        if (!response.ok || !response.data) {
          throw new Error("Bien introuvable");
        }
        const data = response.data;
        setProperty(data);
        setFormData((prev) => ({
          ...prev,
          ...buildInitialFormState(data),
          startDate: prev.startDate || getTomorrowDateInputValue(),
          paymentDay: prev.paymentDay || 5,
          clauses: prev.clauses,
        }));
      } catch (error) {
        console.error("Erreur chargement propriété:", error);
      }
    };

    loadProperty();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;

    const loadApplications = async () => {
      try {
        const response = await fetchOwnerResource<{ candidatures?: ApplicationRecord[]; selectedCandidateId?: string | null }>(
          `/api/owner/properties/${propertyId}/candidatures`
        );
        if (!response.ok || !response.data) return;
        const data = response.data;
        const list = Array.isArray(data.candidatures) ? data.candidatures : [];
        const selectedId = String(
          explicitApplicationId ||
            data.selectedCandidateId ||
            property?.acceptedTenantId ||
            ""
        );
        setApplications(list);
        setSelectedApplicationId(
          selectedId && list.some((application) => application.id === selectedId)
            ? selectedId
            : ""
        );
      } catch (error) {
        console.error("Erreur chargement candidatures:", error);
      }
    };

    loadApplications();
  }, [explicitApplicationId, property?.acceptedTenantId, propertyId]);

  useEffect(() => {
    if (!explicitCandidatureId) return;

    const loadCandidature = async () => {
      try {
        const response = await fetch(`/api/owner/candidatures/${explicitCandidatureId}`);
        if (!response.ok) return;
        const data = await response.json();
        setLegacyCandidature(data);
      } catch (error) {
        console.error("Erreur chargement candidature legacy:", error);
      }
    };

    loadCandidature();
  }, [explicitCandidatureId]);

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

  useEffect(() => {
    if (depositTouchedRef.current) return;
    setFormData((prev) => ({
      ...prev,
      deposit: computeSmartDeposit(prev.leaseType, prev.rentHC),
    }));
  }, [formData.leaseType, formData.rentHC]);

  const selectedApplication =
    applications.find((application) => application.id === selectedApplicationId) ||
    applications.find((application) => application.id === explicitApplicationId) ||
    applications.find((application) => application.id === String(property?.acceptedTenantId || "")) ||
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
      : window.sessionStorage.getItem(fallbackKey)
        ? fallbackKey
        : "";

    if (!draftKey || appliedDraftKeyRef.current === draftKey) return;

    try {
      const rawDraft = window.sessionStorage.getItem(draftKey);
      if (!rawDraft) return;

      const parsedDraft = JSON.parse(rawDraft);
      setFormData((prev) => ({
        ...prev,
        leaseType: parsedDraft.leaseType || prev.leaseType,
        startDate: parsedDraft.startDate || prev.startDate,
        deposit: Number(parsedDraft.deposit ?? prev.deposit) || 0,
      }));
      if (parsedDraft.deposit != null) {
        depositTouchedRef.current = true;
      }
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
    if (!propertyId || !activeTenant) {
      setWarnings([]);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/owner/leases/check-readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            applicationId: selectedApplication?.id,
            candidatureId: legacyCandidature?._id,
            formData,
          }),
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;

        setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
        setCompileMeta((prev) => ({
          ...(prev || {}),
          ...(data.compileMeta || {}),
        }));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Erreur pré-validation Smart Lease:", error);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [propertyId, activeTenant, selectedApplication?.id, legacyCandidature?._id, formData]);

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDepositChange = (value: string) => {
    depositTouchedRef.current = true;
    handleFieldChange("deposit", Number(value) || 0);
  };

  const handleCompile = async () => {
    if (!activeTenant) {
      setCompileStatus("error");
      setCompileError("Impossible de déterminer le locataire à contractualiser.");
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
      if (!response.ok) {
        throw new Error(data.msg || "Compilation Smart Lease impossible");
      }

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
    if (!response.ok) {
      throw new Error("Téléchargement impossible");
    }

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
    if (applicationId) {
      url.searchParams.set("applicationId", applicationId);
    }
    router.push(`${url.pathname}${url.search}`);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f9fc_0%,#eef3f8_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PremiumSurface tone="hero" padding="lg" className="mb-8 border-stone-200/90">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-end">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => router.push(backHref)}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la fiche bien
              </button>
              <div className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
                Contractualisation
              </div>
              <h1 className="mt-3 max-w-3xl text-balance font-serif text-[2.65rem] tracking-tight text-slate-950">
                Le bureau de contractualisation du bien.
              </h1>
              <p className="mt-3 max-w-2xl text-pretty text-sm leading-7 text-slate-600">
                Cette étape ne s’ouvre qu’après un choix explicite du propriétaire. Elle reprend ensuite le dossier retenu, sa lecture financière, sa qualité documentaire et ses blocages réels avant compilation.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[1.55rem] border border-slate-900 bg-slate-900 px-5 py-5 text-white shadow-[0_24px_54px_-34px_rgba(15,23,42,0.45)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Desk actif</div>
                <div className="mt-3 break-words text-lg font-semibold text-white">
                  {selectionRequired
                    ? "Choix propriétaire requis avant le bail"
                    : selectedApplication?.ownerInsights?.contractReadiness?.ready
                      ? "Prêt à compiler le bail"
                      : "Bail à sécuriser avant compilation"}
                </div>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {selectionRequired
                    ? "Le bien est déverrouillé, mais aucun dossier n’a encore été retenu explicitement. Revenez à la comparaison pour choisir le locataire qui peut entrer en contractualisation."
                    : selectedApplication?.ownerInsights?.aiAudit?.summary || property?.flow?.summary || "Le bail reste aligné avec le pipeline du bien."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <QuickStat
                  label="Bien"
                  value={property?.name || "Bien en cours de chargement"}
                  caption={property?.address || "Adresse indisponible"}
                />
                <QuickStat
                  label="Étape"
                  value={selectionRequired ? "Sélection" : property?.flow?.stageLabel || "Contractualisation"}
                  caption={selectionRequired ? "Choisissez explicitement un dossier avant d’ouvrir le bail." : property?.flow?.summary || "Le bail reste aligné avec le pipeline du bien."}
                  tone="accent"
                />
              </div>
            </div>
          </div>
          <StageRail
            className="mt-6"
            activeId="contract"
            items={[
              { id: "portfolio", label: "Portefeuille" },
              { id: "selection", label: "Sélection" },
              { id: "contract", label: "Contractualisation" },
              { id: "management", label: "Gestion" },
            ]}
          />
        </PremiumSurface>

        {selectedApplication ? (
          <PremiumSurface className="mb-8 border-slate-200/90" tone="soft">
            <PremiumSectionHeader
              eyebrow="Contexte actif"
              title={tenantName || "Dossier en cours"}
              description={selectedApplication.ownerInsights?.aiAudit?.summary || property?.flow?.summary || "Le bail se prépare à partir du dossier actuellement sélectionné."}
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickStat label="Passeport" value={selectedApplication.passport?.stateLabel || "Brouillon"} />
              <QuickStat label="Solvabilité" value={selectedApplication.ownerInsights?.financial?.remainingIncomeLabel || "À confirmer"} caption={selectedApplication.ownerInsights?.financial?.effortRateLabel || "—"} />
              <QuickStat label="Garantie" value={selectedApplication.ownerInsights?.guarantee?.label || "Sans garant"} />
              <QuickStat label="Statut bail" value={selectedApplication.ownerInsights?.contractReadiness?.ready ? "Prêt" : "À sécuriser"} caption={selectedApplication.isSealed ? "Sous scellé" : "Dossier visible"} />
            </div>
          </PremiumSurface>
        ) : null}

        {selectionRequired ? (
          <PremiumSurface className="mb-8 border-amber-200">
            <EmptyState
              icon={<ShieldCheck className="h-7 w-7 text-amber-500" />}
              title="Choisissez d’abord un dossier avant de préparer le bail"
              description="Le paiement déverrouille tous les profils du bien, mais n’en retient aucun automatiquement. Revenez à la comparaison, ouvrez les dossiers et choisissez explicitement le locataire à contractualiser."
              action={
                <button
                  type="button"
                  onClick={() => router.push(comparisonHref)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la comparaison
                </button>
              }
            />
          </PremiumSurface>
        ) : null}

        {selectedApplication && contractLocked ? (
          <PremiumSurface className="mb-8 border-amber-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
                  <Lock className="h-5 w-5 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold text-slate-950">Déverrouillez ce dossier avant contractualisation</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Le bien est bien dans la phase de contractualisation, mais le dossier choisi reste sous scellé. Le bail ne doit pas être compilé tant que les informations contractuelles ne sont pas visibles.
                  </p>
                </div>
              </div>
              <ActionBar>
                <button
                  type="button"
                  onClick={() => router.push(comparisonHref)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileSearch className="h-4 w-4" />
                  Retour à la comparaison
                </button>
              </ActionBar>
            </div>
          </PremiumSurface>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            {applications.length > 0 ? (
              <PremiumSurface>
                <PremiumSectionHeader
                  eyebrow="Dossier"
                  title="Quel dossier contractualiser ?"
                  description="Le wizard reste synchronisé avec la fiche bien: même shortlist, même logique de sélection, même lecture de readiness."
                />
                <div className="mt-6 grid gap-3">
                  {applications.map((application) => (
                    <div
                      key={application.id}
                      className={`rounded-2xl border px-4 py-4 text-left ${
                        application.id === selectedApplication?.id
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="break-words text-sm font-semibold text-slate-950">
                            {application.profile?.firstName || "Candidat"} {application.profile?.lastName || ""}
                          </div>
                          <div className="mt-1 break-anywhere text-xs text-slate-500">
                            Passeport {application.passport?.stateLabel || "Brouillon"} · {application.financialSummary?.monthlyNetIncome?.toLocaleString("fr-FR") || 0} € / mois
                          </div>
                        </div>
                        <ActionBar className="gap-2">
                          {application.isSealed ? (
                            <StatusBadge tone="warning" label="Sous scellé" className="normal-case tracking-normal text-xs font-semibold" />
                          ) : null}
                          {property?.acceptedTenantId && application.id === property.acceptedTenantId ? (
                            <StatusBadge tone="dark" label="Retenu" className="normal-case tracking-normal text-xs font-semibold" />
                          ) : null}
                          <StatusBadge
                            tone={application.ownerInsights?.aiAudit?.status === "ALERT" ? "danger" : application.ownerInsights?.aiAudit?.status === "REVIEW" ? "warning" : "success"}
                            label={application.ownerInsights?.aiAudit?.status === "ALERT" ? "Alerte" : application.ownerInsights?.aiAudit?.status === "REVIEW" ? "Revue" : "Clair"}
                            className={auditBadge(application.ownerInsights?.aiAudit?.status)}
                          />
                          <button
                            type="button"
                            onClick={() => handleReturnToComparison(application.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white"
                          >
                            <FileSearch className="h-3.5 w-3.5" />
                            {property?.acceptedTenantId && application.id === property.acceptedTenantId
                              ? "Voir le dossier retenu"
                              : "Voir dans la comparaison"}
                          </button>
                        </ActionBar>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm text-slate-600">
                        {application.ownerInsights?.financial?.summary || application.ownerInsights?.aiAudit?.summary || "Aucune lecture métier disponible."}
                      </p>
                      <ActionBar className="mt-3 text-xs">
                        <StatusBadge tone="neutral" label={`Bail ${application.ownerInsights?.contractReadiness?.ready ? "prêt" : "à sécuriser"}`} className="normal-case tracking-normal text-xs font-semibold" />
                        <StatusBadge tone="neutral" label={`Garantie ${application.ownerInsights?.guarantee?.label || "Sans garant"}`} className="normal-case tracking-normal text-xs font-semibold" />
                      </ActionBar>
                    </div>
                  ))}
                </div>
              </PremiumSurface>
            ) : null}

            {selectionRequired ? (
              <EmptyState
                icon={<Crown className="h-7 w-7 text-amber-500" />}
                title="Le bail attend une sélection explicite"
                description="Tant qu’aucun dossier n’est retenu, le formulaire contractuel reste fermé. Choisissez d’abord le locataire depuis la fiche bien."
                action={
                  <button
                    type="button"
                    onClick={() => router.push(comparisonHref)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour à la comparaison
                  </button>
                }
              />
            ) : contractLocked ? (
              <EmptyState
                icon={<Lock className="h-7 w-7 text-amber-500" />}
                title="Le bail attend le déverrouillage du dossier"
                description="Revenez sur la fiche bien pour déverrouiller le profil retenu. Le formulaire contractuel réapparaîtra automatiquement ensuite."
                action={
                  <button
                    type="button"
                    onClick={() => router.push(comparisonHref)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour à la comparaison
                  </button>
                }
              />
            ) : (
            <PremiumSurface padding="md" className="border-slate-200/90 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.15)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50">
                  <Home className="h-5 w-5 text-stone-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Paramètres du bail</h2>
                  <p className="mt-1 text-sm text-slate-500">Le document se calibre ici, sans perdre la lecture métier du dossier.</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Type de bail
                  <select
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    value={formData.leaseType}
                    onChange={(event) => handleFieldChange("leaseType", event.target.value)}
                  >
                    <option value="vide">Vide</option>
                    <option value="meuble">Meublé</option>
                    <option value="mobilite">Mobilité</option>
                    <option value="garage_parking">Garage / Parking</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Date de début
                  <input
                    type="date"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    value={formData.startDate}
                    min={getTomorrowDateInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000))}
                    onChange={(event) => handleFieldChange("startDate", event.target.value)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Jour de paiement
                  <input
                    type="number"
                    min={1}
                    max={28}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    value={formData.paymentDay}
                    onChange={(event) => handleFieldChange("paymentDay", Number(event.target.value) || 5)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Durée (mois)
                  <input
                    type="number"
                    min={1}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    value={formData.durationMonths}
                    onChange={(event) => handleFieldChange("durationMonths", Number(event.target.value) || 0)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Loyer HC
                  <input
                    type="number"
                    min={0}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    value={formData.rentHC}
                    onChange={(event) => handleFieldChange("rentHC", Number(event.target.value) || 0)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Charges
                  <input
                    type="number"
                    min={0}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    value={formData.charges}
                    onChange={(event) => handleFieldChange("charges", Number(event.target.value) || 0)}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Dépôt de garantie
                  <input
                    type="number"
                    min={0}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    value={formData.deposit}
                    onChange={(event) => handleDepositChange(event.target.value)}
                  />
                  <span className="mt-2 block text-xs text-slate-500">
                    Recommandation automatique: {computeSmartDeposit(formData.leaseType, formData.rentHC).toFixed(2)} €
                  </span>
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Clauses complémentaires
                  <textarea
                    className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                    value={formData.clauses}
                    onChange={(event) => handleFieldChange("clauses", event.target.value)}
                    placeholder="Clauses particulières, équipements, précisions de paiement, etc."
                  />
                </label>
              </div>
            </PremiumSurface>
            )}

            {!contractLocked ? (
            <PremiumSurface tone="soft" className="border-slate-200/90">
              <PremiumSectionHeader eyebrow="Locataire" title="Locataire ciblé" />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InfoRow label="Nom" value={tenantName || "Non déterminé"} />
                <InfoRow label="Email" value={tenantEmail || "Non renseigné"} />
                <InfoRow label="Téléphone" value={tenantPhone || "Non renseigné"} />
                <InfoRow label="Revenus mensuels" value={`${(Number(tenantIncome) || 0).toLocaleString("fr-FR")} €`} />
              </div>

              {selectedApplication?.ownerInsights?.aiAudit?.summary ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Lecture propriétaire</div>
                  <div className="mt-2 text-sm text-slate-700">
                    {selectedApplication.ownerInsights.aiAudit.summary}
                  </div>
                </div>
              ) : null}

              {selectedApplication?.ownerInsights ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Reste à vivre</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">
                      {selectedApplication.ownerInsights.financial?.remainingIncomeLabel || "À confirmer"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Taux d'effort</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">
                      {selectedApplication.ownerInsights.financial?.effortRateLabel || "—"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Garantie</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">
                      {selectedApplication.ownerInsights.guarantee?.label || "Sans garant"}
                    </div>
                  </div>
                </div>
              ) : null}
            </PremiumSurface>
            ) : null}
          </section>

          <aside className="space-y-6">
            <PremiumSurface tone="dark" className="text-white">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-semibold">Bundle documentaire</h2>
              </div>
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Type retenu</span>
                  <span className="font-semibold text-white">{compileMeta?.leaseType || formData.leaseType}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Dépôt calculé</span>
                  <span className="font-semibold text-white">{Number(formData.deposit || 0).toFixed(2)} €</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Caution solidaire</span>
                  <span className="font-semibold text-white">{compileMeta?.hasGuarantee ? "Oui" : "Non"}</span>
                </div>
              </div>

              {selectedApplication?.ownerInsights?.financial?.summary ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                  <div className="font-semibold text-white">Lecture de solvabilité</div>
                  <div className="mt-2">{selectedApplication.ownerInsights.financial.summary}</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Reste à vivre</div>
                      <div className="mt-1 font-semibold text-white">
                        {selectedApplication.ownerInsights.financial.remainingIncomeLabel || "À confirmer"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Risque</div>
                      <div className="mt-1 font-semibold text-white">
                        {selectedApplication.ownerInsights.financial.riskBand?.label || "En audit"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
                      <span>Robustesse dossier</span>
                      <span>{selectedApplication.ownerInsights?.contractReadiness?.ready ? "Haute" : "À confirmer"}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div
                        className="h-2 rounded-full bg-emerald-400"
                        style={{ width: progressWidth(selectedApplication.ownerInsights?.contractReadiness?.ready ? 88 : 52) }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedApplication?.ownerInsights?.contractReadiness?.blockers?.length ? (
                <div className="mt-6 rounded-2xl border border-rose-400/40 bg-rose-500/12 px-4 py-4 text-sm text-rose-50">
                  <div className="font-semibold text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Points bloquants avant contractualisation
                  </div>
                  <div className="mt-2 text-rose-100">
                    {selectedApplication.ownerInsights.contractReadiness.blockers.join(" • ")}
                  </div>
                </div>
              ) : selectedApplication?.ownerInsights?.contractReadiness?.ready ? (
                <div className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-500/12 px-4 py-4 text-sm text-emerald-50">
                  <div className="font-semibold text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Dossier prêt à alimenter le bail
                  </div>
                  <div className="mt-2 text-emerald-100">
                    {selectedApplication.ownerInsights.contractReadiness.warnings?.length
                      ? selectedApplication.ownerInsights.contractReadiness.warnings.join(" • ")
                      : "Le dossier est cohérent pour générer le bundle."}
                  </div>
                </div>
              ) : null}

              {warnings.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/12 px-4 py-4 text-sm text-amber-50">
                  <div className="font-semibold text-amber-200">
                    Certaines informations recommandées par la loi ALUR sont absentes du dossier.
                  </div>
                  <div className="mt-2 text-amber-100">
                    Le bail sera généré avec des espaces à compléter manuellement.
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-amber-200/80">
                    {warnings.join(" • ")}
                  </div>
                </div>
              ) : null}

              <button
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleCompile}
                disabled={compileStatus === "loading" || contractLocked}
              >
                {compileStatus === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compilation DOCX en cours
                  </>
                ) : contractLocked ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Déverrouillage requis avant compilation
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Compiler le bundle Smart Lease
                  </>
                )}
              </button>

              {compileStatus === "error" ? (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {compileError}
                </div>
              ) : null}
            </PremiumSurface>

            <div className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Plan de contractualisation
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {selectedApplication?.ownerInsights?.contractReadiness?.ready
                    ? "Le dossier peut passer de l'analyse au bail sans friction majeure."
                    : "Le bundle reste générable, mais une relecture des alertes est recommandée avant envoi."}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-950">Documents compilés</h2>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {compiledDocuments.length} document(s)
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {compiledDocuments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Aucun document compilé pour le moment.
                  </div>
                ) : null}

                {compiledDocuments.map((document) => (
                  <div
                    key={document.fileName}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">
                          {document.kind === "lease" ? "Bail principal" : "Acte de caution solidaire"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{document.fileName}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
                          onClick={() => handleDownload(document.secureUrl, document.fileName)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          DOCX
                        </button>
                        {document.pdfUrl ? (
                          <button
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
                            onClick={() => handleDownload(document.pdfUrl, document.fileName.replace(/\.docx$/i, ".pdf"))}
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
