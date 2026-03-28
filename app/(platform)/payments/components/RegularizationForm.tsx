'use client';

import React, { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Loader2, CheckCircle, ArrowDown, ArrowUp } from 'lucide-react';

interface RegularizationFormProps {
  leaseId: string;
  onSuccess: () => void;
}

interface RegularizationResult {
  provisions: number;
  realCharges: number;
  adjustment: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const RegularizationForm = memo(function RegularizationForm({
  leaseId,
  onSuccess,
}: RegularizationFormProps) {
  const [realCharges, setRealCharges] = useState('');
  const [year, setYear] = useState(currentYear - 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RegularizationResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setResult(null);

      const charges = parseFloat(realCharges);
      if (isNaN(charges) || charges < 0) {
        setError('Veuillez saisir un montant de charges valide.');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/payments/regularize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leaseId, realCharges: charges, year }),
        });

        if (!res.ok) {
          const data: { error?: string } = await res.json();
          throw new Error(data.error || 'Erreur lors de la r\u00e9gularisation.');
        }

        const json: { success: boolean; data: RegularizationResult } =
          await res.json();
        setResult(json.data);
        setSubmitted(true);
        onSuccess();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Une erreur inattendue est survenue.'
        );
      } finally {
        setLoading(false);
      }
    },
    [realCharges, year, leaseId, onSuccess]
  );

  const adjustmentSign = useMemo(() => {
    if (!result) return null;
    if (result.adjustment > 0) return 'positive';
    if (result.adjustment < 0) return 'negative';
    return 'zero';
  }, [result]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#0f172a]">
        <Calculator className="h-5 w-5 text-[#2563eb]" />
        R\u00e9gularisation des charges
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="regYear"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Ann\u00e9e de r\u00e9gularisation
          </label>
          <select
            id="regYear"
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setResult(null);
              setSubmitted(false);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="realCharges"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Charges r\u00e9elles (\u20ac)
          </label>
          <input
            id="realCharges"
            type="number"
            step="0.01"
            min="0"
            value={realCharges}
            onChange={(e) => {
              setRealCharges(e.target.value);
              setResult(null);
              setSubmitted(false);
            }}
            placeholder="Ex : 1 200,00"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200"
            required
          />
        </div>

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
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <h4 className="mb-3 text-sm font-semibold text-[#0f172a]">
                R\u00e9sultat du calcul
              </h4>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Provisions vers\u00e9es</span>
                  <span className="font-medium text-[#0f172a]">
                    {formatCurrency(result.provisions)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Charges r\u00e9elles</span>
                  <span className="font-medium text-[#0f172a]">
                    {formatCurrency(result.realCharges)}
                  </span>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    {adjustmentSign === 'positive' && (
                      <ArrowDown className="h-4 w-4 text-[#10b981]" />
                    )}
                    {adjustmentSign === 'negative' && (
                      <ArrowUp className="h-4 w-4 text-[#ef4444]" />
                    )}
                    Ajustement
                  </span>
                  <span
                    className={
                      adjustmentSign === 'positive'
                        ? 'text-[#10b981]'
                        : adjustmentSign === 'negative'
                          ? 'text-[#ef4444]'
                          : 'text-[#0f172a]'
                    }
                  >
                    {result.adjustment > 0 ? '+' : ''}
                    {formatCurrency(result.adjustment)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {adjustmentSign === 'positive'
                    ? 'Trop-per\u00e7u : le locataire sera rembours\u00e9.'
                    : adjustmentSign === 'negative'
                      ? 'Compl\u00e9ment d\u00fb par le locataire.'
                      : 'Aucun ajustement n\u00e9cessaire.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading || submitted}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Calcul en cours\u2026
            </>
          ) : submitted ? (
            <>
              <CheckCircle className="h-4 w-4" />
              R\u00e9gularisation appliqu\u00e9e
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4" />
              Calculer la r\u00e9gularisation
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
});

export default RegularizationForm;
