"use client";

import { useState } from "react";
import { Download, FileCheck, Loader2, Save, CheckCircle2, AlertTriangle, ChevronUp, X, Send } from "lucide-react";
import type { CompiledDocument } from "./types";
import type { MissingField } from "./useFormCompletion";

interface ActionFooterProps {
  filledCount: number;
  totalCount: number;
  warningsCount: number;
  compileStatus: "idle" | "loading" | "success" | "error";
  compileError: string;
  saveStatus: "idle" | "loading" | "success" | "error";
  saveError: string;
  compiledDocuments: CompiledDocument[];
  canCompile: boolean;
  missingRequired?: MissingField[];
  leaseId?: string;
  signatureStatus: "idle" | "loading" | "success" | "error";
  onCompile: () => void;
  onSave: () => void;
  onDownload: (url?: string, fileName?: string) => void;
  onLaunchSignature?: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  financier: "Conditions financières",
  duree: "Durée",
  paiement: "Paiement",
  caracteristiques: "Caractéristiques",
  mobilite: "Mobilité",
  equipements: "Équipements",
  revision: "Révision",
  mandataire: "Mandataire",
  clauses: "Clauses",
  garant: "Garant",
  bien: "Bien",
  locataire: "Locataire",
};

export function ActionFooter({
  filledCount,
  totalCount,
  warningsCount,
  compileStatus,
  compileError,
  saveStatus,
  saveError,
  compiledDocuments,
  canCompile,
  missingRequired = [],
  leaseId,
  signatureStatus,
  onCompile,
  onSave,
  onDownload,
  onLaunchSignature,
}: ActionFooterProps) {
  const [showMissing, setShowMissing] = useState(false);

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white">
      {/* Missing fields panel */}
      {showMissing && missingRequired.length > 0 && (
        <div className="border-b border-slate-100 bg-amber-50 px-4 py-3 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-amber-800">
              {missingRequired.length} champ{missingRequired.length > 1 ? "s" : ""} obligatoire{missingRequired.length > 1 ? "s" : ""} manquant{missingRequired.length > 1 ? "s" : ""}
            </h4>
            <button type="button" onClick={() => setShowMissing(false)} className="text-amber-600 hover:text-amber-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {missingRequired.map((m) => (
              <li key={`${m.section}-${m.field}`} className="text-xs text-amber-700">
                <span className="font-medium">{SECTION_LABELS[m.section] || m.section}</span> — {m.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        {/* Left: progress info */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{filledCount}</span>/{totalCount} champs
          </span>

          {missingRequired.length > 0 && (
            <button
              type="button"
              onClick={() => setShowMissing((p) => !p)}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="h-3 w-3" />
              {missingRequired.length} manquant{missingRequired.length > 1 ? "s" : ""}
              <ChevronUp className={`h-3 w-3 transition-transform ${showMissing ? "rotate-180" : ""}`} />
            </button>
          )}

          {warningsCount > 0 && missingRequired.length === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {warningsCount} avert.
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {compiledDocuments.map((doc) => (
            <div key={doc.fileName} className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDownload(doc.secureUrl, doc.fileName)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                DOCX
              </button>
              {doc.pdfUrl && (
                <button
                  type="button"
                  onClick={() => onDownload(doc.pdfUrl, doc.fileName.replace(/\.docx$/i, ".pdf"))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={onCompile}
            disabled={compileStatus === "loading" || !canCompile}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {compileStatus === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Génération...</span>
              </>
            ) : (
              <>
                <FileCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Générer le bail</span>
              </>
            )}
          </button>

          {compiledDocuments.length > 0 && saveStatus !== "success" && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === "loading"}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {saveStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Enregistrer</span>
            </button>
          )}

          {saveStatus === "success" && signatureStatus !== "success" && (
            <>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Enregistré
              </span>
              {leaseId && onLaunchSignature && (
                <button
                  type="button"
                  onClick={onLaunchSignature}
                  disabled={signatureStatus === "loading"}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {signatureStatus === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Envoyer pour signature</span>
                </button>
              )}
            </>
          )}

          {signatureStatus === "success" && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
              <CheckCircle2 className="h-4 w-4" />
              Invitation envoyée
            </span>
          )}
        </div>
      </div>

      {compileStatus === "error" && compileError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{compileError}</div>
      )}
      {saveStatus === "error" && saveError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{saveError}</div>
      )}
    </footer>
  );
}
