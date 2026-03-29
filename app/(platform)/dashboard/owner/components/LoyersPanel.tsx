'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Bell,
  Loader2,
  FileText,
  Clock,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface PaymentPeriod { month: number; year: number }
interface PaymentAmounts { rentHC: number; charges: number; totalTTC: number; paidAmount: number }

interface Payment {
  _id: string;
  period: PaymentPeriod;
  amounts: PaymentAmounts;
  status: 'PENDING' | 'CONFIRMED' | 'PARTIAL' | 'LATE' | 'UNPAID';
  property: { _id: string; address?: string; name?: string };
  tenant: { _id: string; firstName?: string; lastName?: string; email?: string };
  lease: string;
  confirmedAt?: string;
  receiptUrl?: string;
  notes?: string;
}

// ─── Config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Payment['status'], { label: string; bg: string; text: string; icon: typeof CheckCircle }> = {
  CONFIRMED: { label: 'Confirmé', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  PARTIAL:   { label: 'Partiel',  bg: 'bg-amber-100',   text: 'text-amber-700',   icon: Clock },
  PENDING:   { label: 'En attente', bg: 'bg-blue-100',  text: 'text-blue-700',    icon: Clock },
  LATE:      { label: 'En retard',  bg: 'bg-red-100',   text: 'text-red-700',     icon: AlertTriangle },
  UNPAID:    { label: 'Impayé',     bg: 'bg-red-100',   text: 'text-red-700',     icon: AlertTriangle },
};

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

// ─── Confirm Modal (inline) ─────────────────────────────────────

function ConfirmModal({ payment, onClose, onDone }: {
  payment: Payment; onClose: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(payment.amounts.totalTTC));
  const [method, setMethod] = useState('VIREMENT');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${payment._id}/confirm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAmount: Number(amount), paymentMethod: method, notes }),
      });
      if (res.ok) onDone();
    } finally {
      setLoading(false);
    }
  }, [payment._id, amount, method, notes, onDone]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Confirmer le paiement</h3>
        <p className="text-sm text-slate-500 mb-4">
          {MONTHS[payment.period.month - 1]} {payment.period.year} — {payment.property?.name || payment.property?.address}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Montant reçu</label>
            <input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Moyen de paiement</label>
            <select className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="VIREMENT">Virement</option>
              <option value="CHEQUE">Chèque</option>
              <option value="ESPECES">Espèces</option>
              <option value="PRELEVEMENT">Prélèvement</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
            <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
              placeholder="Optionnel" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={submit} disabled={loading || !amount}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────

const LoyersPanel = memo(function LoyersPanel() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmPayment, setConfirmPayment] = useState<Payment | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setPayments(json.data || []);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch('/api/payments/generate', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setMessage(`${json.totalCreated || 0} loyer(s) généré(s), ${json.totalSkipped || 0} déjà existant(s).`);
        fetchPayments();
      } else {
        setMessage(json.error || 'Erreur lors de la génération');
      }
    } catch {
      setMessage('Erreur réseau');
    } finally {
      setGenerating(false);
    }
  }, [fetchPayments]);

  const handleRemind = useCallback(async () => {
    setReminding(true);
    setMessage('');
    try {
      const res = await fetch('/api/payments/remind', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setMessage(`${json.sent || 0} relance(s) envoyée(s).`);
      } else {
        setMessage(json.error || 'Erreur lors des relances');
      }
    } catch {
      setMessage('Erreur réseau');
    } finally {
      setReminding(false);
    }
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/export?format=csv');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loyers_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }, []);

  const downloadReceipt = useCallback(async (p: Payment) => {
    try {
      const res = await fetch(`/api/payments/${p._id}/receipt`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quittance_${MONTHS[p.period.month - 1]}_${p.period.year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }, []);

  const handleConfirmDone = useCallback(() => {
    setConfirmPayment(null);
    fetchPayments();
  }, [fetchPayments]);

  // Stats
  const totalDue = payments.reduce((s, p) => s + p.amounts.totalTTC, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amounts.paidAmount, 0);
  const lateCount = payments.filter((p) => p.status === 'LATE' || p.status === 'UNPAID').length;
  const confirmedCount = payments.filter((p) => p.status === 'CONFIRMED').length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-950">Loyers & Quittances</h1>
          <p className="mt-1 text-sm text-slate-500">Suivi des paiements, quittances PDF et relances</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={handleRemind} disabled={reminding || lateCount === 0}
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 transition-colors">
            {reminding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Relancer ({lateCount})
          </button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Générer les loyers
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <CreditCard className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase">Attendu</span>
          </div>
          <div className="text-xl font-bold text-slate-900">{fmt(totalDue)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase">Encaissé</span>
          </div>
          <div className="text-xl font-bold text-emerald-700">{fmt(totalPaid)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase">Confirmés</span>
          </div>
          <div className="text-xl font-bold text-blue-700">{confirmedCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-red-400 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase">Impayés</span>
          </div>
          <div className="text-xl font-bold text-red-700">{lateCount}</div>
        </div>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter */}
      <div className="mb-4 flex gap-3">
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="CONFIRMED">Confirmés</option>
          <option value="PARTIAL">Partiels</option>
          <option value="LATE">En retard</option>
          <option value="UNPAID">Impayés</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="mb-3 text-4xl">💰</div>
          <p className="font-medium text-slate-700">Aucun loyer enregistré</p>
          <p className="mt-1 text-sm text-slate-500">
            Cliquez sur "Générer les loyers" pour créer les échéances du mois en cours.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Période</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Bien</th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 md:table-cell">Locataire</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Montant</th>
                <th className="hidden px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:table-cell">Reçu</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const cfg = STATUS_CONFIG[p.status];
                const Icon = cfg.icon;
                const tenantLabel = p.tenant
                  ? `${p.tenant.firstName ?? ''} ${p.tenant.lastName ?? ''}`.trim() || p.tenant.email || '—'
                  : '—';
                const canConfirm = p.status === 'PENDING' || p.status === 'PARTIAL';
                const canReceipt = p.status === 'CONFIRMED';

                return (
                  <motion.tr
                    key={p._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-900">
                      {MONTHS[p.period.month - 1]} {p.period.year}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      {p.property?.name || p.property?.address || '—'}
                    </td>
                    <td className="hidden px-4 py-3.5 text-sm text-slate-600 md:table-cell">
                      {tenantLabel}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-900">
                      {fmt(p.amounts.totalTTC)}
                    </td>
                    <td className="hidden px-4 py-3.5 text-sm text-slate-600 sm:table-cell">
                      {fmt(p.amounts.paidAmount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {canConfirm && (
                          <button
                            onClick={() => setConfirmPayment(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                            aria-label="Confirmer le paiement"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Confirmer</span>
                          </button>
                        )}
                        {canReceipt && (
                          <button
                            onClick={() => downloadReceipt(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                            aria-label="Télécharger la quittance"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Quittance</span>
                          </button>
                        )}
                        {(p.status === 'LATE' || p.status === 'UNPAID') && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">Impayé</span>
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmPayment && (
          <ConfirmModal
            payment={confirmPayment}
            onClose={() => setConfirmPayment(null)}
            onDone={handleConfirmDone}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export { LoyersPanel };
