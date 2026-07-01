'use client';

import * as React from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { AnalysisV2Panel } from './AnalysisV2Panel';

type Variant = 'clean' | 'fraud';

const TABS: Array<{
  id: Variant;
  label: string;
  hint: string;
  Icon: typeof ShieldCheck;
}> = [
  {
    id: 'clean',
    label: 'Dossier fiable',
    hint: 'Bon candidat, pièces authentiques',
    Icon: ShieldCheck,
  },
  {
    id: 'fraud',
    label: 'Dossier frauduleux',
    hint: 'Bulletin retouché + revenus incohérents',
    Icon: ShieldAlert,
  },
];

/**
 * SampleDossierDemo — « Tester avec un dossier exemple ».
 *
 * Deux dossiers pré-remplis (fiable / frauduleux) passés dans le VRAI pipeline
 * d'analyse via POST /api/owner/demo-analysis. Réutilise AnalysisV2Panel pour
 * un rendu 100 % identique au produit. Aucun locataire réel, aucun quota, aucun
 * appel Didit. Sert le « aha moment » dès l'inscription (Sprint 1.A / Tâche 1).
 */
export function SampleDossierDemo({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  const [variant, setVariant] = React.useState<Variant>('clean');

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row">
        {TABS.map((t) => {
          const active = t.id === variant;
          const Icon = t.Icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setVariant(t.id)}
              aria-pressed={active}
              className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{t.label}</span>
                <span
                  className={`block text-[11px] ${
                    active ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {t.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {/* key=variant → remonte le panel (état « Lancer l'analyse ») à chaque bascule */}
      <AnalysisV2Panel
        key={variant}
        applicationId={`demo-${variant}`}
        endpoint={`/api/owner/demo-analysis?variant=${variant}`}
        autoCache={false}
        diditVerified={variant === 'clean'}
      />
    </div>
  );
}
