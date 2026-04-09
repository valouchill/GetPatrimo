'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { PremiumSurface, EmptyState } from '@/app/components/ui/premium';
import { Receipt, Loader2 } from 'lucide-react';
import { useReceiptTimeline } from './useReceiptTimeline';
import ReceiptDashboard from './ReceiptDashboard';
import ReceiptTimeline from './ReceiptTimeline';
import ReceiptConfirmDialog from './ReceiptConfirmDialog';
import type { MonthEntry } from './types';
import { fmt } from './types';

export default function RentReceiptManager({ propertyId }: { propertyId: string }) {
  const { lease, timeline, metrics, loading, error, refetch, isHistorical } = useReceiptTimeline(propertyId);
  const [confirmEntry, setConfirmEntry] = useState<MonthEntry | null>(null);

  if (loading) {
    return (
      <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </PremiumSurface>
    );
  }

  if (error || !lease) {
    return (
      <EmptyState
        icon={<Receipt className="h-7 w-7 text-slate-400" />}
        title="Aucun bail associe"
        description="Les quittances de loyer apparaitront ici une fois un bail cree ou importe pour ce bien."
      />
    );
  }

  const tenantName = `${lease.tenantFirstName || ''} ${lease.tenantLastName || ''}`.trim() || lease.tenantEmail || 'Locataire';

  return (
    <>
      {/* Section header */}
      <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
            <Receipt className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Quittances de loyer
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {tenantName} &mdash; {fmt(lease.rentAmount + lease.chargesAmount)}/mois
              {isHistorical && (
                <span className="ml-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Historique
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard metriques */}
        <ReceiptDashboard
          lease={lease}
          metrics={metrics}
          timeline={timeline}
          isHistorical={isHistorical}
        />
      </PremiumSurface>

      {/* Timeline */}
      <div className="mt-4">
        <ReceiptTimeline
          timeline={timeline}
          isHistorical={isHistorical}
          onConfirm={setConfirmEntry}
        />
      </div>

      {/* Confirm dialog */}
      <AnimatePresence>
        {confirmEntry && (
          <ReceiptConfirmDialog
            entry={confirmEntry}
            tenantName={tenantName}
            leaseId={lease._id}
            onClose={() => setConfirmEntry(null)}
            onDone={() => { setConfirmEntry(null); refetch(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
