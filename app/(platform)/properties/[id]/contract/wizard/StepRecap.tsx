"use client";

import { Download, TrendingUp } from "lucide-react";
import type { ApplicationRecord, CompiledDocument } from "./types";

type StepRecapProps = {
  compiledDocuments: CompiledDocument[];
  selectedApplication: ApplicationRecord | null;
  onDownload: (url?: string, fileName?: string) => void;
};

export function StepRecap({ compiledDocuments, selectedApplication, onDownload }: StepRecapProps) {
  return (
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
                  onClick={() => onDownload(document.secureUrl, document.fileName)}
                >
                  <Download className="h-3.5 w-3.5" />
                  DOCX
                </button>
                {document.pdfUrl ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600"
                    onClick={() => onDownload(document.pdfUrl, document.fileName.replace(/\.docx$/i, ".pdf"))}
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
  );
}
