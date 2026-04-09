'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import type { MonthEntry } from './types';
import { fmt } from './types';

interface ReceiptConfirmDialogProps {
  entry: MonthEntry;
  tenantName: string;
  leaseId: string;
  onClose: () => void;
  onDone: () => void;
}

export default function ReceiptConfirmDialog({
  entry,
  tenantName,
  leaseId,
  onClose,
  onDone,
}: ReceiptConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [editAmount, setEditAmount] = useState(false);
  const [amount, setAmount] = useState(String(entry.totalTTC));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isPartial = Number(amount) < entry.totalTTC && Number(amount) > 0;

  const submit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/receipts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaseId,
          month: entry.month,
          year: entry.year,
          ...(editAmount ? { paidAmount: Number(amount) } : {}),
        }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur lors de la generation');
      }
    } catch {
      setError('Erreur reseau');
    } finally {
      setLoading(false);
    }
  }, [leaseId, entry, editAmount, amount]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {isPartial ? 'Recu de paiement' : 'Generer la quittance'}
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-slate-600 mb-1">
                <span className="font-serif font-medium text-emerald-900">{entry.label}</span>
                {entry.daysOverdue ? (
                  <span className="ml-2 text-xs text-red-500 font-semibold">
                    {entry.daysOverdue}j de retard
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-slate-500 mb-5">
                Vous confirmez avoir recu le paiement
                {isPartial ? ' partiel' : ' integral'} de{' '}
                <span className="font-semibold text-slate-800">{fmt(Number(amount))}</span>{' '}
                de la part de <span className="font-semibold text-slate-800">{tenantName}</span> ?
              </p>

              {editAmount ? (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Montant recu (EUR)</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 outline-none"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  {isPartial && (
                    <p className="mt-1 text-xs text-amber-600">
                      Paiement partiel — un recu sera genere (et non une quittance).
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setEditAmount(true)}
                  className="mb-4 text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                >
                  Modifier le montant recu
                </button>
              )}

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={submit}
                  disabled={loading || !amount || Number(amount) <= 0}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Oui, generer
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-2">
              <div className="mb-3 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">
                {isPartial ? 'Recu genere' : 'Quittance generee'}
              </h3>
              <p className="text-sm text-slate-500 mb-5">
                Le document a ete genere et envoye a <span className="font-medium text-slate-700">{tenantName}</span>.
              </p>
              <button
                onClick={onDone}
                className="rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
              >
                Fermer
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
