"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Lock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { PremiumSurface } from "@/app/components/ui/premium";
import type { ApplicationRecord, CompileMeta, LeaseFormData } from "./types";

function progressWidth(value?: number | null, max = 100) {
  const width = Math.max(4, Math.min(100, ((Number(value || 0) / max) * 100)));
  return `${width}%`;
}

type StepDiagnosticsProps = {
  selectedApplication: ApplicationRecord | null;
  formData: LeaseFormData;
  compileMeta: CompileMeta | null;
  warnings: string[];
  compileStatus: "idle" | "loading" | "success" | "error";
  compileError: string;
  contractLocked: boolean;
  onCompile: () => void;
};

export function StepDiagnostics({
  selectedApplication,
  formData,
  compileMeta,
  warnings,
  compileStatus,
  compileError,
  contractLocked,
  onCompile,
}: StepDiagnosticsProps) {
  return (
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
        onClick={onCompile}
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
  );
}
