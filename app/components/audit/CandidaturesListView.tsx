'use client';

/**
 * <CandidaturesListView> — alternative « liste » à la pile Tinder
 * (<CandidaturesStackView>). Même données (StackCandidate[]) et mêmes
 * callbacks (onAccept / onReject / onOpenDetail) : permet de comparer les
 * candidats en un coup d'œil, triés par Indice de Résilience décroissant.
 */

import * as React from 'react';
import { Check, X, ChevronRight } from 'lucide-react';

import type { StackCandidate } from './CandidaturesStackView';

export interface CandidaturesListViewProps {
  candidates: StackCandidate[];
  onAccept?: (candidate: StackCandidate) => void;
  onReject?: (candidate: StackCandidate) => void;
  onOpenDetail?: (candidateId: string) => void;
}

export function CandidaturesListView({
  candidates,
  onAccept,
  onReject,
  onOpenDetail,
}: CandidaturesListViewProps): React.ReactElement {
  const sorted = React.useMemo(
    () => [...candidates].sort((a, b) => b.score - a.score),
    [candidates],
  );

  return (
    <div className="px-4 py-4 md:px-6">
      <ul className="space-y-2">
        {sorted.map((c, idx) => {
          const fullName = `${c.prenom} ${c.nom}`.trim();
          return (
            <li key={c.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpenDetail?.(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenDetail?.(c.id);
                  }
                }}
                aria-label={`Ouvrir le dossier de ${fullName}`}
                className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:p-4"
              >
                <span className="hidden w-6 shrink-0 text-center font-serif text-sm font-bold text-slate-300 sm:block">
                  {idx + 1}
                </span>

                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-900 text-white">
                  <span className="text-base font-bold leading-none tabular-nums">{c.score}</span>
                  <span className="text-[8px] uppercase tracking-wide opacity-70">/100</span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{fullName}</p>
                  <p className="truncate text-xs text-slate-500">{c.profession}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span className="tabular-nums">Revenus {c.revenus}</span>
                    <span className="tabular-nums">Effort {c.effort}</span>
                    {c.grade && (
                      <span className="font-semibold uppercase tracking-wide text-emerald-800">
                        {c.grade}
                      </span>
                    )}
                  </div>
                  {c.alerte && (
                    <p className="mt-1 truncate text-[11px] font-semibold text-rose-600">{c.alerte}</p>
                  )}
                </div>

                <div
                  className="flex shrink-0 items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onReject?.(c)}
                    aria-label={`Écarter ${fullName}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 transition-colors hover:bg-red-50"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAccept?.(c)}
                    aria-label={`Retenir ${fullName}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm transition-colors hover:bg-amber-600"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <ChevronRight
                    className="hidden h-5 w-5 text-slate-300 transition-colors group-hover:text-emerald-500 sm:block"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
