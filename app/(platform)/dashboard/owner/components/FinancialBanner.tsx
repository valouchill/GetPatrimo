'use client';

import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface FinancialData {
  totalExpected: number;
  totalReceived: number;
  lateCount: number;
  pendingReceipts: number;
  collectionRate: number;
  remaining: number;
}

export function FinancialBanner({
  data,
  onNavigate,
}: {
  data: FinancialData | null;
  onNavigate: (target: string) => void;
}) {
  if (!data || data.totalExpected === 0) return null;

  const { totalExpected, totalReceived, lateCount, collectionRate, remaining } = data;
  const barColor = collectionRate >= 80 ? 'bg-emerald-500' : collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const lateBarWidth = totalExpected > 0 ? Math.min(((totalExpected - totalReceived) / totalExpected) * 100, 100) : 0;

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-3">
            {collectionRate >= 80 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-sm font-semibold text-slate-700">Revenus du mois</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-3">
            <div>
              <span className="text-2xl font-bold text-slate-950">{totalReceived.toLocaleString('fr-FR')} €</span>
              <span className="ml-1 text-sm text-slate-500">encaissé</span>
            </div>
            <div className="text-sm text-slate-500">
              sur {totalExpected.toLocaleString('fr-FR')} € attendu
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full flex">
              <div
                className={`h-full ${barColor} transition-[width] duration-700`}
                style={{ width: `${collectionRate}%` }}
              />
              {lateCount > 0 && (
                <div
                  className="h-full bg-red-200"
                  style={{ width: `${lateBarWidth}%` }}
                />
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-slate-700">{collectionRate}%</span>
            {remaining > 0 && (
              <span className="text-slate-500">
                Reste à percevoir : {remaining.toLocaleString('fr-FR')} €
              </span>
            )}
          </div>
        </div>

        {/* Quick stats */}
        {(lateCount > 0) && (
          <button
            type="button"
            onClick={() => onNavigate('loyers')}
            className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
            {lateCount} loyer{lateCount > 1 ? 's' : ''} en retard
          </button>
        )}
      </div>
    </div>
  );
}
