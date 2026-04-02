'use client';

import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export default function WizardShell({
  title,
  currentStep,
  totalSteps,
  saving,
  onBack,
  onPrev,
  onNext,
  isLastStep,
  children,
}: {
  title: string;
  currentStep: number;
  totalSteps: number;
  saving: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  isLastStep: boolean;
  children: React.ReactNode;
}) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            Étape {currentStep + 1} / {totalSteps}
            {saving && <span className="ml-2 text-orange-500">Sauvegarde...</span>}
          </p>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
        {children}
      </div>

      {/* ── Bottom nav ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/95 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentStep === 0}
            className="flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </button>

          {/* Progress dots */}
          <div className="flex flex-1 items-center justify-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? 'w-4 bg-orange-500' : i < currentStep ? 'w-1.5 bg-orange-300' : 'w-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={saving}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isLastStep ? (
              'Terminer'
            ) : (
              <>
                Suivant
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
