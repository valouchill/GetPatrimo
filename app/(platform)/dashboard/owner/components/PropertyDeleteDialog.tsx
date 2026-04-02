'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, X } from 'lucide-react';
import type { LocalBien } from './ui';

export function PropertyDeleteDialog({
  bien,
  onClose,
  onDeleted,
}: {
  bien: LocalBien;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/properties/${bien.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Erreur lors de l\'archivage');
        return;
      }
      onDeleted();
    } catch {
      setError('Erreur réseau — veuillez réessayer');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[201] flex items-end md:items-center justify-center md:p-4"
        onClick={onClose}
      >
        <div
          className="w-full md:max-w-md overflow-hidden rounded-t-3xl md:rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-property-title"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
              <Archive className="h-6 w-6 text-red-500" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            <h2 id="delete-property-title" className="text-lg font-bold text-slate-900">
              Archiver ce bien ?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Le bien <strong className="text-slate-900">«&nbsp;{bien.label}&nbsp;»</strong> sera masqué de votre portefeuille.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Vos données sont conservées : candidatures, baux et états des lieux restent accessibles. Cette action est réversible en contactant le support.
            </p>

            {error && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Archivage…' : 'Confirmer l\'archivage'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
