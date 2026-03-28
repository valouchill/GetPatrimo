'use client';

import React, { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Loader2,
  CheckCircle,
  ArrowRight,
  Info,
} from 'lucide-react';

interface RevisionPanelProps {
  leaseId: string;
  currentRent: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

const RevisionPanel = memo(function RevisionPanel({
  leaseId,
  currentRent,
}: RevisionPanelProps) {
  const [oldIRL, setOldIRL] = useState('');
  const [newIRL, setNewIRL] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<{
    oldRent: number;
    newRent: number;
  } | null>(null);

  const calculatedRent = useMemo(() => {
    const oldVal = parseFloat(oldIRL);
    const newVal = parseFloat(newIRL);
    if (isNaN(oldVal) || isNaN(newVal) || oldVal <= 0 || newVal <= 0) {
      return null;
    }
    return (currentRent * newVal) / oldVal;
  }, [oldIRL, newIRL, currentRent]);

  const rentDiff = useMemo(() => {
    if (calculatedRent === null) return null;
    return calculatedRent - currentRent;
  }, [calculatedRent, currentRent]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccessData(null);

      const oldVal = parseFloat(oldIRL);
      const newVal = parseFloat(newIRL);

      if (isNaN(oldVal) || oldVal <= 0) {
        setError('Veuillez saisir un ancien indice IRL valide.');
        return;
      }
      if (isNaN(newVal) || newVal <= 0) {
        setError('Veuillez saisir un nouvel indice IRL valide.');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/payments/revise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaseId,
            oldIRLIndex: oldVal,
            newIRLIndex: newVal,
          }),
        });

        if (!res.ok) {
          const data: { error?: string } = await res.json();
          throw new Error(data.error || 'Erreur lors de la r\u00e9vision.');
        }

        const json: {
          success: boolean;
          data: { previousRent: number; newRent: number };
        } = await res.json();

        setSuccessData({
          oldRent: json.data.previousRent,
          newRent: json.data.newRent,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Une erreur inattendue est survenue.'
        );
      } finally {
        setLoading(false);
      }
    },
    [oldIRL, newIRL, leaseId]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#0f172a]">
        <TrendingUp className="h-5 w-5 text-[#2563eb]" />
        R\u00e9vision du loyer (IRL)
      </h3>

      <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-slate-600">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2563eb]" />
          <span>
            Loyer actuel :{' '}
            <span className="font-semibold text-[#0f172a]">
              {formatCurrency(currentRent)}
            </span>
            <br />
            <span className="text-xs text-slate-400">
              Formule : ancien loyer \u00d7 nouvel IRL \u00f7 ancien IRL
            </span>
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="oldIRL"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Ancien indice IRL
            </label>
            <input
              id="oldIRL"
              type="number"
              step="0.01"
              min="0.01"
              value={oldIRL}
              onChange={(e) => {
                setOldIRL(e.target.value);
                setSuccessData(null);
              }}
              placeholder="Ex : 138,61"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200"
              required
            />
          </div>
          <div>
            <label
              htmlFor="newIRL"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Nouvel indice IRL
            </label>
            <input
              id="newIRL"
              type="number"
              step="0.01"
              min="0.01"
              value={newIRL}
              onChange={(e) => {
                setNewIRL(e.target.value);
                setSuccessData(null);
              }}
              placeholder="Ex : 142,06"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200"
              required
            />
          </div>
        </div>

        <AnimatePresence>
          {calculatedRent !== null && !successData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <p className="text-sm text-slate-600">
                Nouveau loyer calcul\u00e9 :{' '}
                <span className="text-base font-semibold text-[#0f172a]">
                  {formatCurrency(calculatedRent)}
                </span>
              </p>
              {rentDiff !== null && (
                <p
                  className={`mt-1 text-xs font-medium ${
                    rentDiff >= 0 ? 'text-[#f59e0b]' : 'text-[#10b981]'
                  }`}
                >
                  {rentDiff >= 0 ? '+' : ''}
                  {formatCurrency(rentDiff)} / mois
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#ef4444]"
            role="alert"
          >
            {error}
          </motion.p>
        )}

        <AnimatePresence>
          {successData && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-[#10b981]" />
                <span className="text-sm font-semibold text-[#0f172a]">
                  R\u00e9vision appliqu\u00e9e avec succ\u00e8s
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-medium">
                  {formatCurrency(successData.oldRent)}
                </span>
                <ArrowRight className="h-4 w-4 text-[#10b981]" />
                <span className="font-semibold text-[#10b981]">
                  {formatCurrency(successData.newRent)}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading || successData !== null}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Application en cours\u2026
            </>
          ) : successData ? (
            <>
              <CheckCircle className="h-4 w-4" />
              R\u00e9vision appliqu\u00e9e
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4" />
              Appliquer la r\u00e9vision
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
});

export default RevisionPanel;
