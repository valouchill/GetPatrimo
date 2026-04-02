'use client';

import { Download, FileCheck, Loader2, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { CompiledDocument } from './types';

interface ActionFooterProps {
  filledCount: number;
  totalCount: number;
  warningsCount: number;
  compileStatus: 'idle' | 'loading' | 'success' | 'error';
  compileError: string;
  saveStatus: 'idle' | 'loading' | 'success' | 'error';
  saveError: string;
  compiledDocuments: CompiledDocument[];
  canCompile: boolean;
  onCompile: () => void;
  onSave: () => void;
  onDownload: (url?: string, fileName?: string) => void;
}

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
  onCompile,
  onSave,
  onDownload,
}: ActionFooterProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        {/* Left: progress info */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{filledCount}</span>/{totalCount} champs remplis
          </span>
          {warningsCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {warningsCount} avertissement{warningsCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Download buttons after compilation */}
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
                  onClick={() => onDownload(doc.pdfUrl, doc.fileName.replace(/\.docx$/i, '.pdf'))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </button>
              )}
            </div>
          ))}

          {/* Generate button */}
          <button
            type="button"
            onClick={onCompile}
            disabled={compileStatus === 'loading' || !canCompile}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {compileStatus === 'loading' ? (
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

          {/* Save button (only after compilation) */}
          {compiledDocuments.length > 0 && saveStatus !== 'success' && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === 'loading'}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {saveStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Enregistrer</span>
            </button>
          )}

          {saveStatus === 'success' && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Enregistré
            </span>
          )}
        </div>
      </div>

      {/* Error messages */}
      {compileStatus === 'error' && compileError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{compileError}</div>
      )}
      {saveStatus === 'error' && saveError && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{saveError}</div>
      )}
    </footer>
  );
}
