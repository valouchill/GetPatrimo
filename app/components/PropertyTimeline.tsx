'use client';

import { Megaphone, Brain, FileSignature, ClipboardCheck } from 'lucide-react';

const STEPS = [
  { id: 'rayonnement', label: 'Rayonnement', sub: 'Collecte des dossiers', icon: Megaphone },
  { id: 'audit', label: 'Audit & Sélection', sub: 'Tri par l\'IA', icon: Brain },
  { id: 'contrat', label: 'Scellement', sub: 'Signature du bail', icon: FileSignature },
  { id: 'gestion', label: 'Gestion', sub: 'État des lieux & Quittances', icon: ClipboardCheck },
] as const;

interface PropertyTimelineProps {
  /** Index de l'étape active (0-based). Par défaut 0 = Rayonnement */
  activeStep?: number;
}

export default function PropertyTimeline({ activeStep = 0 }: PropertyTimelineProps) {
  return (
    <div className="flex items-start justify-between max-w-3xl mx-auto mt-6 mb-8">
      {STEPS.map((step, index) => {
        const isActive = index === activeStep;
        const isDone = index < activeStep;
        const Icon = step.icon;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center text-center min-w-[72px]">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-300'
                      : 'border-2 border-slate-200 text-slate-400 bg-white'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
              </div>
              <span
                className={`mt-2 text-xs font-medium leading-tight ${
                  isActive ? 'text-emerald-800' : isDone ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 hidden sm:block">{step.sub}</span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-[2px] flex-1 mx-2 mt-5 ${
                  index < activeStep ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
