'use client';

import { useState } from 'react';
import { MetricTile, PremiumSurface, SignalList } from '@/app/components/ui/premium';
import { AlertTriangle, CalendarClock, FileCheck, PenLine, Info } from 'lucide-react';
import type { LeaseInfo, TimelineMetrics, MonthEntry } from './types';
import { fmt, MONTHS } from './types';
import SignatureManager from './SignatureManager';

interface ReceiptDashboardProps {
  lease: LeaseInfo;
  metrics: TimelineMetrics | null;
  timeline: MonthEntry[];
  isHistorical: boolean;
}

export default function ReceiptDashboard({ lease, metrics, timeline, isHistorical }: ReceiptDashboardProps) {
  const [showSignature, setShowSignature] = useState(false);

  const overdueEntries = timeline.filter((e) => e.status === 'overdue' || e.status === 'late');

  return (
    <div className="space-y-4">
      {/* Banniere bail termine */}
      {isHistorical && (
        <PremiumSurface tone="soft" padding="md" className="rounded-2xl flex items-start gap-3">
          <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-600">
            Ce bail a pris fin{lease.endDate ? ` le ${new Date(lease.endDate).toLocaleDateString('fr-FR')}` : ''}.
            Les quittances ci-dessous correspondent a l&apos;historique de location.
          </p>
        </PremiumSurface>
      )}

      {/* Metriques */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricTile
            label="Total percu"
            value={fmt(metrics.totalPaid)}
            tone="accent"
          />
          <MetricTile
            label="Retards"
            value={metrics.overdueCount > 0 ? String(metrics.overdueCount) : '0'}
            caption={metrics.overdueCount > 0 ? 'mois impaye(s)' : 'Tout est a jour'}
            tone={metrics.overdueCount > 0 ? 'default' : 'soft'}
            valueClassName={metrics.overdueCount > 0 ? '!text-red-600' : undefined}
          />
          <MetricTile
            label="Prochaine echeance"
            value={metrics.nextDueDate || '—'}
            tone="soft"
          />
          <MetricTile
            label="Quittances envoyees"
            value={String(metrics.receiptsSentCount)}
            tone="soft"
          />
        </div>
      )}

      {/* Alertes retards */}
      {overdueEntries.length > 0 && !isHistorical && (
        <SignalList
          items={overdueEntries.slice(0, 5).map((e) => ({
            id: `${e.year}-${e.month}`,
            title: `${e.label} — ${fmt(e.totalTTC)}`,
            description: e.daysOverdue
              ? `${e.daysOverdue} jour${e.daysOverdue > 1 ? 's' : ''} de retard`
              : 'Paiement non confirme',
            tone: 'danger' as const,
          }))}
        />
      )}

      {/* Signature */}
      {!isHistorical && (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
          <PenLine className="h-4 w-4 text-slate-400 shrink-0" />
          <p className="flex-1 text-sm text-slate-500">
            Votre signature apparaitra sur les quittances generees.
          </p>
          <button
            onClick={() => setShowSignature(true)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors whitespace-nowrap"
          >
            Configurer
          </button>
        </div>
      )}

      {showSignature && (
        <SignatureManager onClose={() => setShowSignature(false)} />
      )}
    </div>
  );
}
