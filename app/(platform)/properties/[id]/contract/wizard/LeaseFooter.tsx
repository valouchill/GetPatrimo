"use client";

import { Loader2, Save, CheckCircle2, Send, Download, Lock, AlertTriangle, ArrowRight, Mail } from "lucide-react";
import type { CompiledDocument } from "./types";
import type { MissingField } from "./useFormCompletion";

interface LeaseFooterProps {
  canCompile: boolean;
  compileStatus: "idle" | "loading" | "success" | "error";
  compileError: string;
  saveStatus: "idle" | "loading" | "success" | "error";
  saveError: string;
  compiledDocuments: CompiledDocument[];
  missingRequired: MissingField[];
  leaseId?: string;
  signatureStatus: "idle" | "loading" | "success" | "error";
  signatureError?: string;
  signatureResult?: { signers?: number; firstSentTo?: string | null; inviteSent?: boolean } | null;
  tenantEmail?: string;
  onCompile: () => void;
  onSave: () => void;
  onDownload: (url?: string, fileName?: string) => void;
  onLaunchSignature?: () => void;
  onGoToBaux?: () => void;
}

/** Les erreurs serveur brutes (ENOENT, soffice…) ne parlent pas au bailleur. */
function humanizeCompileError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('enoent') || m.includes('template')) {
    return 'Le modèle de bail est momentanément indisponible. Réessayez, puis contactez le support si le problème persiste.';
  }
  if (m.includes('soffice') || m.includes('libreoffice') || m.includes('pdf')) {
    return 'La conversion en PDF a échoué — réessayez dans quelques secondes.';
  }
  if (m.includes('timeout') || m.includes('econn') || m.includes('fetch')) {
    return 'Le serveur a mis trop de temps à répondre. Vérifiez votre connexion et réessayez.';
  }
  return message;
}

export function LeaseFooter({
  canCompile,
  compileStatus,
  compileError,
  saveStatus,
  saveError,
  compiledDocuments,
  missingRequired,
  leaseId,
  signatureStatus,
  signatureError,
  signatureResult,
  tenantEmail,
  onCompile,
  onSave,
  onDownload,
  onLaunchSignature,
  onGoToBaux,
}: LeaseFooterProps) {
  const blockingCount = missingRequired.filter((m) => m.blocking).length;

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="px-6 py-4">
        {/* Phase 1: Generate */}
        {compileStatus !== "success" && saveStatus !== "success" && (
          <div>
            {blockingCount > 0 && !canCompile && (
              <details className="mb-2">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                  <Lock className="h-3 w-3" />
                  {blockingCount} champ{blockingCount > 1 ? "s" : ""} obligatoire{blockingCount > 1 ? "s" : ""} manquant{blockingCount > 1 ? "s" : ""} — voir la liste
                </summary>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {missingRequired.filter((m) => m.blocking).map((m) => (
                    <li key={m.field} className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700 ring-1 ring-red-200">
                      {m.label}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <button
              type="button"
              onClick={onCompile}
              disabled={compileStatus === "loading" || !canCompile}
              className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium py-3.5 rounded-xl shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {compileStatus === "loading" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Scellement juridique en cours...
                </>
              ) : (
                "G\u00e9n\u00e9rer la liasse certifi\u00e9e"
              )}
            </button>
          </div>
        )}

        {/* Phase 2: Save + Download */}
        {compileStatus === "success" && saveStatus !== "success" && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === "loading"}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {saveStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </button>
            {compiledDocuments.map((doc) => (
              <button
                key={doc.fileName}
                type="button"
                onClick={() => onDownload(doc.pdfUrl || doc.secureUrl, doc.fileName)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
            ))}
          </div>
        )}

        {/* Phase 3: Signature */}
        {saveStatus === "success" && signatureStatus !== "success" && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Enregistr\u00e9
            </span>
            {leaseId && onLaunchSignature && (
              <button
                type="button"
                onClick={onLaunchSignature}
                disabled={signatureStatus === "loading"}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                {signatureStatus === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Envoyer pour signature
              </button>
            )}
          </div>
        )}

        {signatureStatus === "success" && (
          <div className="py-1">
            {signatureResult?.inviteSent === false ? (
              <p className="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Campagne créée, mais l&apos;email n&apos;a pas pu être envoyé
                {signatureResult?.firstSentTo ? ` à ${signatureResult.firstSentTo}` : ""}. Vérifiez
                l&apos;adresse puis utilisez « Renvoyer le lien » dans l&apos;onglet Baux.
              </p>
            ) : (
              <p className="mb-2 flex items-start gap-2 text-xs text-slate-600">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
                <span>
                  <strong className="text-slate-800">
                    Lien de signature envoyé à {signatureResult?.firstSentTo || tenantEmail || "la première partie"}
                  </strong>
                  {signatureResult?.signers ? ` — ${signatureResult.signers} signataires au total, chacun recevra son lien personnel à son tour.` : "."}
                  {" "}Relances automatiques à J+2 et J+5.
                </span>
              </p>
            )}
            <button
              type="button"
              onClick={onGoToBaux}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Suivre la signature
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Errors */}
      {compileStatus === "error" && compileError && (
        <div className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-800">La génération a échoué</p>
            <p className="text-xs text-red-700">{humanizeCompileError(compileError)}</p>
          </div>
          <button
            type="button"
            onClick={onCompile}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}
      {saveStatus === "error" && saveError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{saveError}</div>
      )}
      {signatureStatus === "error" && (
        <div className="flex items-center gap-2 border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {signatureError || "Impossible de lancer la signature."}
          {onLaunchSignature && (
            <button type="button" onClick={onLaunchSignature} className="ml-auto text-xs font-semibold underline">
              Réessayer
            </button>
          )}
        </div>
      )}
    </footer>
  );
}
