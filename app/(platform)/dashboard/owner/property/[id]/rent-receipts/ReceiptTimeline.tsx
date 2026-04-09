'use client';

import { useState, useMemo } from 'react';
import { StatusBadge, PremiumSurface } from '@/app/components/ui/premium';
import { QuittanceActions } from '@/app/(platform)/dashboard/owner/components/QuittanceActions';
import { ChevronDown } from 'lucide-react';
import type { MonthEntry } from './types';
import { fmt } from './types';

interface ReceiptTimelineProps {
  timeline: MonthEntry[];
  isHistorical: boolean;
  onConfirm: (entry: MonthEntry) => void;
}

const STATUS_BADGE: Record<string, { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' | 'danger' }> = {
  sent: { label: 'Envoyee', tone: 'success' },
  partial: { label: 'Partiel', tone: 'warning' },
  to_generate: { label: 'A generer', tone: 'info' },
  upcoming: { label: 'A venir', tone: 'neutral' },
  overdue: { label: 'En retard', tone: 'danger' },
  late: { label: 'Impaye', tone: 'danger' },
};

export default function ReceiptTimeline({ timeline, isHistorical, onConfirm }: ReceiptTimelineProps) {
  const [showAllYears, setShowAllYears] = useState(false);

  // Group by year
  const grouped = useMemo(() => {
    const map = new Map<number, MonthEntry[]>();
    for (const entry of timeline) {
      const arr = map.get(entry.year) || [];
      arr.push(entry);
      map.set(entry.year, arr);
    }
    // Sort years descending
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [timeline]);

  const currentYear = new Date().getFullYear();
  const visibleGroups = showAllYears ? grouped : grouped.filter(([y]) => y >= currentYear);
  const hiddenCount = grouped.length - visibleGroups.length;

  return (
    <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
      <div className="divide-y divide-slate-100">
        {visibleGroups.map(([year, entries]) => (
          <div key={year}>
            {/* Year header */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm -mx-2 px-2 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                {year}
              </span>
            </div>

            {entries.map((entry) => {
              const badge = STATUS_BADGE[entry.status];
              const canGenerate = !isHistorical && (entry.status === 'to_generate' || entry.status === 'overdue');
              const hasSentReceipt = (entry.status === 'sent' || entry.status === 'partial') && entry.payment;

              return (
                <div
                  key={`${entry.year}-${entry.month}`}
                  className="flex items-center gap-3 py-3 hover:bg-slate-50/60 transition-colors -mx-2 px-2 rounded-lg"
                >
                  {/* Month label */}
                  <div className="min-w-[120px] sm:min-w-[140px]">
                    <span className="font-serif font-medium text-emerald-900 text-sm">
                      {entry.label}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="hidden sm:block text-sm text-slate-400 tabular-nums min-w-[90px]">
                    {fmt(entry.totalTTC)}
                  </div>

                  {/* Badge */}
                  <div className="flex-1 flex items-center gap-2 justify-end sm:justify-start">
                    <StatusBadge label={badge.label} tone={badge.tone} />
                    {entry.daysOverdue && (entry.status === 'overdue' || entry.status === 'late') ? (
                      <span className="text-[10px] font-semibold text-red-500 tabular-nums whitespace-nowrap">
                        {entry.daysOverdue}j
                      </span>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0">
                    {canGenerate && (
                      <button
                        onClick={() => onConfirm(entry)}
                        className="rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
                      >
                        Valider le paiement
                      </button>
                    )}
                    {hasSentReceipt && entry.payment && (
                      <div className="flex items-center gap-2">
                        {entry.status === 'partial' && (
                          <span className="text-xs text-amber-600 tabular-nums">{fmt(entry.payment.amounts.paidAmount)}</span>
                        )}
                        <QuittanceActions
                          paymentId={entry.payment._id}
                          period={entry.payment.period}
                          variant="row"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Show older years */}
      {hiddenCount > 0 && !showAllYears && (
        <button
          onClick={() => setShowAllYears(true)}
          className="mt-3 flex items-center gap-1.5 mx-auto text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Voir les annees precedentes ({hiddenCount})
        </button>
      )}

      {timeline.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">
          Aucune periode de location trouvee
        </p>
      )}
    </PremiumSurface>
  );
}
