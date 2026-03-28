'use client';

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle } from 'lucide-react';
import type { Payment } from './PaymentRow';

interface ConfirmPaymentModalProps {
  payment: Payment;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

const ConfirmPaymentModal = memo(function ConfirmPaymentModal({
  payment,
  isOpen,
  onClose,
  onConfirm,
}: ConfirmPaymentModalProps) {
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPaidAmount(String(payment.amounts.totalTTC));
      setNotes('');
      setError('');
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, payment.amounts.totalTTC]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      const amount = parseFloat(paidAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Veuillez saisir un montant valide sup\u00e9rieur \u00e0 0.');
        return;
      }
      if (amount > payment.amounts.totalTTC) {
        setError(
          `Le montant ne peut pas d\u00e9passer le total TTC (${payment.amounts.totalTTC.toFixed(2)} \u20ac).`
        );
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/payments/${payment._id}/confirm`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paidAmount: amount, notes }),
        });

        if (!res.ok) {
          const data: { error?: string } = await res.json();
          throw new Error(data.error || 'Erreur lors de la confirmation.');
        }

        onConfirm();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Une erreur inattendue est survenue.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [paidAmount, notes, payment._id, payment.amounts.totalTTC, onConfirm]
  );

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmer le paiement"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'spring', duration: 0.35 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[#0f172a]">
                Confirmer le paiement
              </h2>
              <button
                onClick={onClose}
                aria-label="Fermer la fen\u00eatre"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p>
                Total TTC :{' '}
                <span className="font-semibold text-[#0f172a]">
                  {formatCurrency(payment.amounts.totalTTC)}
                </span>
              </p>
              <p>
                D\u00e9j\u00e0 pay\u00e9 :{' '}
                <span className="font-semibold">
                  {formatCurrency(payment.amounts.paidAmount)}
                </span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="paidAmount"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Montant re\u00e7u (\u20ac)
                </label>
                <input
                  ref={inputRef}
                  id="paidAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payment.amounts.totalTTC}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Notes (optionnel)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200 resize-none"
                  placeholder="Pr\u00e9cisez le mode de r\u00e8glement, r\u00e9f\u00e9rence\u2026"
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#ef4444]"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {loading ? 'Confirmation\u2026' : 'Confirmer le paiement'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default ConfirmPaymentModal;
