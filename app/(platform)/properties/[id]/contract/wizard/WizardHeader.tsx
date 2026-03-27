"use client";

import { ArrowLeft, FileSearch, Lock, ShieldCheck } from "lucide-react";
import {
  ActionBar,
  EmptyState,
  PremiumSectionHeader,
  PremiumSurface,
  QuickStat,
  StageRail,
} from "@/app/components/ui/premium";
import type { ApplicationRecord, PropertyRecord } from "./types";

type WizardHeaderProps = {
  property: PropertyRecord | null;
  selectedApplication: ApplicationRecord | null;
  selectionRequired: boolean;
  contractLocked: boolean;
  tenantName: string;
  backHref: string;
  comparisonHref: string;
  onNavigate: (href: string) => void;
};

export function WizardHeader({
  property,
  selectedApplication,
  selectionRequired,
  contractLocked,
  tenantName,
  backHref,
  comparisonHref,
  onNavigate,
}: WizardHeaderProps) {
  return (
    <>
      <PremiumSurface tone="hero" padding="lg" className="mb-8 border-stone-200/90">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:items-end">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onNavigate(backHref)}
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
              Cette étape ne s'ouvre qu'après un choix explicite du propriétaire. Elle reprend ensuite le dossier retenu, sa lecture financière, sa qualité documentaire et ses blocages réels avant compilation.
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
                  ? "Le bien est déverrouillé, mais aucun dossier n'a encore été retenu explicitement. Revenez à la comparaison pour choisir le locataire qui peut entrer en contractualisation."
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
                caption={selectionRequired ? "Choisissez explicitement un dossier avant d'ouvrir le bail." : property?.flow?.summary || "Le bail reste aligné avec le pipeline du bien."}
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
            title="Choisissez d'abord un dossier avant de préparer le bail"
            description="Le paiement déverrouille tous les profils du bien, mais n'en retient aucun automatiquement. Revenez à la comparaison, ouvrez les dossiers et choisissez explicitement le locataire à contractualiser."
            action={
              <button
                type="button"
                onClick={() => onNavigate(comparisonHref)}
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
                onClick={() => onNavigate(comparisonHref)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <FileSearch className="h-4 w-4" />
                Retour à la comparaison
              </button>
            </ActionBar>
          </div>
        </PremiumSurface>
      ) : null}
    </>
  );
}
