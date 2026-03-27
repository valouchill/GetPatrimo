"use client";

import {
  ArrowLeft,
  Crown,
  FileSearch,
  Lock,
} from "lucide-react";
import {
  ActionBar,
  EmptyState,
  InfoRow,
  PremiumSectionHeader,
  PremiumSurface,
  StatusBadge,
} from "@/app/components/ui/premium";
import type { ApplicationRecord, CandidatureRecord, PropertyRecord } from "./types";

function auditBadge(status?: string) {
  if (status === "ALERT") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

type StepLocataireProps = {
  applications: ApplicationRecord[];
  selectedApplication: ApplicationRecord | null;
  legacyCandidature: CandidatureRecord | null;
  property: PropertyRecord | null;
  selectionRequired: boolean;
  contractLocked: boolean;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantIncome: number;
  onReturnToComparison: (applicationId?: string) => void;
  onReturnToComparisonHref: string;
  onNavigate: (href: string) => void;
};

export function StepLocataire({
  applications,
  selectedApplication,
  legacyCandidature,
  property,
  selectionRequired,
  contractLocked,
  tenantName,
  tenantEmail,
  tenantPhone,
  tenantIncome,
  onReturnToComparison,
  onReturnToComparisonHref,
  onNavigate,
}: StepLocataireProps) {
  return (
    <>
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
                role="region"
                aria-label={`Candidature de ${application.profile?.firstName || "Candidat"} ${application.profile?.lastName || ""}`}
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
                      onClick={() => onReturnToComparison(application.id)}
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
          description="Tant qu'aucun dossier n'est retenu, le formulaire contractuel reste fermé. Choisissez d'abord le locataire depuis la fiche bien."
          action={
            <button
              type="button"
              onClick={() => onNavigate(onReturnToComparisonHref)}
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
              onClick={() => onNavigate(onReturnToComparisonHref)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la comparaison
            </button>
          }
        />
      ) : null}

      {!contractLocked && (selectedApplication || legacyCandidature) ? (
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
    </>
  );
}
