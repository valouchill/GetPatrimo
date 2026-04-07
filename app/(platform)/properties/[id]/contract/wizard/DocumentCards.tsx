"use client";

import { FileText, Download, CheckCircle2, Loader2, Circle } from "lucide-react";
import type { CompiledDocument } from "./types";

interface DocumentCardsProps {
  leaseType: string;
  hasGuarantor: boolean;
  compiledDocuments: CompiledDocument[];
  compileStatus: "idle" | "loading" | "success" | "error";
  onDownload: (url?: string, fileName?: string) => void;
}

function getLeaseTitle(leaseType: string): string {
  switch (leaseType) {
    case "MOBILITE": return "Bail mobilit\u00e9";
    case "GARAGE_PARKING": return "Bail de garage / parking";
    case "MEUBLE": return "Bail meubl\u00e9 \u2014 Loi ALUR";
    default: return "Bail d\u2019habitation \u2014 Loi ALUR";
  }
}

function DocumentCard({
  title,
  subtitle,
  status,
  document,
  onDownload,
}: {
  title: string;
  subtitle: string;
  status: "idle" | "loading" | "success" | "error";
  document?: CompiledDocument;
  onDownload: (url?: string, fileName?: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      {/* PDF Icon */}
      <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-emerald-50 flex items-center justify-center">
        <FileText className="h-6 w-6 text-emerald-700" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-serif text-sm font-semibold text-emerald-900 truncate">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>

        {/* Status */}
        <div className="mt-1.5 flex items-center gap-2">
          {status === "idle" && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Circle className="h-2.5 w-2.5 fill-slate-300 text-slate-300" /> \u00c0 g\u00e9n\u00e9rer
            </span>
          )}
          {status === "loading" && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <Loader2 className="h-3 w-3 animate-spin" /> G\u00e9n\u00e9ration...
            </span>
          )}
          {status === "success" && document && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> G\u00e9n\u00e9r\u00e9
              </span>
              <button
                type="button"
                onClick={() => onDownload(document.secureUrl, document.fileName)}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                <Download className="h-3 w-3" /> DOCX
              </button>
              {document.pdfUrl && (
                <button
                  type="button"
                  onClick={() => onDownload(document.pdfUrl, document.fileName.replace(/\.docx$/i, ".pdf"))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  <Download className="h-3 w-3" /> PDF
                </button>
              )}
            </div>
          )}
          {status === "error" && (
            <span className="text-xs text-red-500">Erreur de g\u00e9n\u00e9ration</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentCards({ leaseType, hasGuarantor, compiledDocuments, compileStatus, onDownload }: DocumentCardsProps) {
  const leaseDoc = compiledDocuments.find((d) => d.kind === "lease");
  const guaranteeDoc = compiledDocuments.find((d) => d.kind === "guarantee");
  const showGuarantee = hasGuarantor && leaseType !== "MOBILITE";

  return (
    <div className="space-y-3">
      <h2 className="font-serif text-lg font-semibold text-emerald-900">Liasse contractuelle</h2>
      <DocumentCard
        title={getLeaseTitle(leaseType)}
        subtitle="Contrat de bail conforme loi du 6 juillet 1989"
        status={compileStatus}
        document={leaseDoc}
        onDownload={onDownload}
      />
      {showGuarantee && (
        <DocumentCard
          title="Acte de Caution Solidaire"
          subtitle="Engagement du garant conforme loi ALUR"
          status={compileStatus}
          document={guaranteeDoc}
          onDownload={onDownload}
        />
      )}
    </div>
  );
}
