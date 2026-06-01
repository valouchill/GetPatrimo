"use client";

import * as React from "react";
import { RefreshCw, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Button, Modal } from "@/app/components/ui";
import { formatPrice } from "@/lib/product-lexicon";

export interface ReanalyzeResult {
  analyzed: number;
  skipped: number;
  skippedReasons?: Array<{ id: string; reason: string }>;
  documentsUpdated?: Array<{ id: string; type: string; status: string; monthlyNet: number | null }>;
  financialSummary?: {
    totalMonthlyIncome?: number;
    certifiedIncome?: boolean;
    payslipsBreakdown?: Array<unknown>;
    monthlyIncomeMean?: number | null;
    monthlyIncomeMedian?: number | null;
    monthlyIncomeMethod?: "mean" | "median" | "none" | null;
    varianceHigh?: boolean;
  };
}

export interface ReanalyzeButtonProps {
  applicationId: string;
  documentsCount?: number;
  variant?: "primary" | "outline" | "ghost" | "secondary";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  onSuccess?: (result: ReanalyzeResult) => void;
  /**
   * V7.13 — Ré-analyse déjà effectuée pour ce dossier (limite : 1 fois).
   * Si true, le bouton est rendu désactivé avec le libellé "Déjà ré-analysé".
   */
  alreadyReanalyzed?: boolean;
  className?: string;
}

/**
 * Bouton de ré-analyse IA des documents d'un candidat (côté propriétaire).
 *
 * Workflow :
 *  - Clic → modale de confirmation avec coût/durée estimés
 *  - Confirmation → POST /api/owner/applications/{id}/reanalyze
 *  - Pendant : spinner + texte "Analyse en cours…"
 *  - Succès : toast inline + callback onSuccess (pour refetch)
 *  - Erreur : message inline + bouton réessayer
 */
export function ReanalyzeButton({
  applicationId,
  documentsCount = 0,
  variant = "outline",
  size = "sm",
  fullWidth = false,
  onSuccess,
  alreadyReanalyzed = false,
  className = "",
}: ReanalyzeButtonProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [state, setState] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ReanalyzeResult | null>(null);
  // V7.13 — La ré-analyse est limitée à 1 fois. `done` devient true soit
  // depuis la prop serveur (alreadyReanalyzed), soit après un succès local.
  const [doneLocally, setDoneLocally] = React.useState(false);
  const isDone = alreadyReanalyzed || doneLocally;

  const docsLabel = documentsCount > 0
    ? `${documentsCount} document${documentsCount > 1 ? "s" : ""}`
    : "tous les documents";

  const handleConfirm = async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/owner/applications/${applicationId}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // V7.13 — Déjà ré-analysé côté serveur : on bascule en état "done"
        // au lieu d'afficher une erreur bloquante.
        if (res.status === 409 && data?.code === "ALREADY_REANALYZED") {
          setDoneLocally(true);
          setConfirmOpen(false);
          return;
        }
        throw new Error(data?.error || `Erreur ${res.status}`);
      }
      setResult(data as ReanalyzeResult);
      setState("success");
      setDoneLocally(true); // limite atteinte après ce succès
      onSuccess?.(data as ReanalyzeResult);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(msg);
      setState("error");
    }
  };

  const handleClose = () => {
    setConfirmOpen(false);
    setTimeout(() => {
      setState("idle");
      setError(null);
      setResult(null);
    }, 200);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={() => setConfirmOpen(true)}
        iconLeft={<RefreshCw className="h-3.5 w-3.5" />}
        className={className}
        disabled={state === "loading" || isDone}
        title={isDone ? "La ré-analyse est limitée à une fois par dossier." : undefined}
      >
        {isDone ? "Déjà ré-analysé" : "Ré-analyser"}
      </Button>

      <Modal
        open={confirmOpen}
        onClose={state === "loading" ? () => {} : handleClose}
        title="Ré-analyser le dossier"
        description={
          state === "idle"
            ? `Cette opération relance l'analyse IA sur ${docsLabel} du candidat. Utile si l'extraction initiale a échoué.`
            : undefined
        }
        size="lg"
        closeOnBackdrop={state !== "loading"}
      >
        {state === "idle" && (
          <div className="space-y-4">
            <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold">Quand utiliser cette action ?</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-800">
                    <li>Revenu net non extrait ou à 0 €</li>
                    <li>Documents marqués « À réviser » par erreur</li>
                    <li>Mise à jour de l'algorithme d'extraction (V1.4+)</li>
                  </ul>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-slate-100 rounded-card border border-slate-200">
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <dt className="text-slate-500">Durée estimée</dt>
                <dd className="font-semibold text-slate-900">30 à 60 secondes</dd>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <dt className="text-slate-500">Documents concernés</dt>
                <dd className="font-semibold text-slate-900">{docsLabel}</dd>
              </div>
            </dl>
            {/* V7.13 — Rappel : la ré-analyse n'est possible qu'une seule fois */}
            <p className="text-xs text-slate-400">
              Cette action n&apos;est disponible qu&apos;une seule fois par dossier.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="md" onClick={handleClose}>
                Annuler
              </Button>
              <Button variant="primary" size="md" onClick={handleConfirm}>
                Confirmer la ré-analyse
              </Button>
            </div>
          </div>
        )}

        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-amber-600" aria-hidden="true" />
            <p className="mt-4 font-serif text-lg font-bold text-slate-900">Analyse en cours…</p>
            <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
              L'IA examine chaque document et extrait le revenu net. Ne fermez pas cette fenêtre.
            </p>
          </div>
        )}

        {state === "success" && result && (
          <div className="space-y-4">
            <div className="rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <p className="font-serif text-base font-bold text-emerald-900">
                    {result.analyzed} document{result.analyzed > 1 ? "s" : ""} ré-analysé{result.analyzed > 1 ? "s" : ""}
                  </p>
                  {typeof result.financialSummary?.totalMonthlyIncome === "number" && result.financialSummary.totalMonthlyIncome > 0 && (
                    <p className="mt-1 text-sm text-emerald-800">
                      Revenu net mis à jour :{" "}
                      <strong>{formatPrice(result.financialSummary.totalMonthlyIncome)}/mois</strong>
                      {result.financialSummary.certifiedIncome ? " · certifié" : " · déclaré"}
                      {result.financialSummary.monthlyIncomeMethod === "median" && " (médiane retenue)"}
                    </p>
                  )}
                  {result.financialSummary?.varianceHigh && (
                    <p className="mt-1 text-xs text-amber-700">
                      ⚠ Variance élevée entre bulletins — la médiane a été utilisée.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {result.documentsUpdated && result.documentsUpdated.length > 0 && (
              <div className="rounded-card border border-slate-200 bg-white">
                <p className="border-b border-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Détail des documents
                </p>
                <ul className="divide-y divide-slate-100">
                  {result.documentsUpdated.map((d) => (
                    <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="truncate text-slate-700">{d.type}</span>
                      <div className="flex items-center gap-3">
                        {d.monthlyNet ? (
                          <span className="font-semibold text-emerald-700">{formatPrice(d.monthlyNet)}</span>
                        ) : null}
                        <span
                          className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                            d.status === "CERTIFIED"
                              ? "bg-emerald-100 text-emerald-700"
                              : d.status === "NEEDS_REVIEW"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.skipped > 0 && (
              <p className="text-xs text-slate-500">
                {result.skipped} document{result.skipped > 1 ? "s" : ""} ignoré{result.skipped > 1 ? "s" : ""} (fichier introuvable ou erreur).
              </p>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="md" onClick={handleClose}>
                Fermer
              </Button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <div className="rounded-card border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-red-900">La ré-analyse a échoué</p>
                  <p className="mt-1 text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="md" onClick={handleClose}>
                Annuler
              </Button>
              <Button variant="primary" size="md" onClick={handleConfirm}>
                Réessayer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
