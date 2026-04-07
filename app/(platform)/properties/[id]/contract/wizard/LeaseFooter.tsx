"use client";

import { Loader2, Save, CheckCircle2, Send, Download, Lock } from "lucide-react";
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
  onCompile: () => void;
  onSave: () => void;
  onDownload: (url?: string, fileName?: string) => void;
  onLaunchSignature?: () => void;
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
  onCompile,
  onSave,
  onDownload,
  onLaunchSignature,
}: LeaseFooterProps) {
  const blockingCount = missingRequired.filter((m) => m.blocking).length;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white">
      <div className="px-6 py-4">
        {/* Phase 1: Generate */}
        {compileStatus !== "success" && saveStatus !== "success" && (
          <div>
            {blockingCount > 0 && !canCompile && (
              <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {blockingCount} champ{blockingCount > 1 ? "s" : ""} obligatoire{blockingCount > 1 ? "s" : ""} manquant{blockingCount > 1 ? "s" : ""}
              </p>
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
          <div className="flex items-center justify-center gap-2 py-2">
            <CheckCircle2 className="h-5 w-5 text-indigo-600" />
            <span className="text-sm font-semibold text-indigo-600">Invitation envoy\u00e9e</span>
          </div>
        )}
      </div>

      {/* Errors */}
      {compileStatus === "error" && compileError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{compileError}</div>
      )}
      {saveStatus === "error" && saveError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{saveError}</div>
      )}
    </footer>
  );
}
