'use client';

import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Download,
  FileText,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  CircleDot,
} from 'lucide-react';
import type { Payment } from './PaymentRow';

interface PaymentHistoryProps {
  leaseId: string;
}

type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'PARTIAL' | 'LATE' | 'UNPAID';

const STATUS_ICON: Record<PaymentStatus, React.ReactNode> = {
  CONFIRMED: <CheckCircle className="h-4 w-4 text-[#10b981]" />,
  PARTIAL: <CircleDot className="h-4 w-4 text-[#f59e0b]" />,
  PENDING: <Clock className="h-4 w-4 text-[#2563eb]" />,
  LATE: <AlertTriangle className="h-4 w-4 text-[#ef4444]" />,
  UNPAID: <AlertTriangle className="h-4 w-4 text-[#ef4444]" />,
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  CONFIRMED: 'Confirm\u00e9',
  PARTIAL: 'Partiel',
  PENDING: 'En attente',
  LATE: 'En retard',
  UNPAID: 'Impay\u00e9',
};

const STATUS_COLOR: Record<PaymentStatus, string> = {
  CONFIRMED: 'border-[#10b981]',
  PARTIAL: 'border-[#f59e0b]',
  PENDING: 'border-[#2563eb]',
  LATE: 'border-[#ef4444]',
  UNPAID: 'border-[#ef4444]',
};

const MONTH_NAMES = [
  'Janvier', 'F\u00e9vrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Ao\u00fbt', 'Septembre', 'Octobre', 'Novembre', 'D\u00e9cembre',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

const PaymentHistory = memo(function PaymentHistory({
  leaseId,
}: PaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/payments?leaseId=${encodeURIComponent(leaseId)}`);
      if (!res.ok) throw new Error('Impossible de charger l\u2019historique.');
      const json: { success: boolean; data: Payment[] } = await res.json();
      setPayments(json.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur de chargement.'
      );
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleExport = useCallback(
    async (format: 'csv' | 'pdf') => {
      const res = await fetch(
        `/api/payments/export?format=${format}&leaseId=${encodeURIComponent(leaseId)}`
      );
      if (!res.ok) return;

      if (format === 'csv') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historique_paiements.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const json: { success: boolean; data: { url: string } } = await res.json();
        window.open(json.data.url, '_blank');
      }
    },
    [leaseId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#2563eb]" />
        <span className="ml-2 text-sm text-slate-500">Chargement\u2026</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 p-4 text-sm text-[#ef4444]" role="alert">
        {error}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-[#0f172a]">
          <Calendar className="h-5 w-5 text-[#2563eb]" />
          Historique des paiements
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            aria-label="Exporter en CSV"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            aria-label="Exporter en PDF"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Aucun paiement enregistr\u00e9 pour ce bail.
        </p>
      ) : (
        <div className="relative ml-4 border-l-2 border-slate-200 pl-6">
          <AnimatePresence>
            {payments.map((p, i) => (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative mb-6 last:mb-0"
              >
                {/* Timeline dot */}
                <div
                  className={`absolute -left-[calc(1.5rem+0.5625rem)] top-1 h-3 w-3 rounded-full border-2 bg-white ${STATUS_COLOR[p.status]}`}
                />

                <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-[#0f172a]">
                        {MONTH_NAMES[p.period.month - 1]} {p.period.year}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatCurrency(p.amounts.paidAmount)} /{' '}
                        {formatCurrency(p.amounts.totalTTC)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      {STATUS_ICON[p.status]}
                      <span className="text-slate-600">
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>
                  </div>
                  {p.notes && (
                    <p className="mt-2 text-xs text-slate-400 italic">{p.notes}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
});

export default PaymentHistory;
