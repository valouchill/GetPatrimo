'use client';

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { StatCard } from './ui';

// ─── Types ──────────────────────────────────────────────────────

interface PaymentPeriod { month: number; year: number }
interface PaymentAmounts { rentHC: number; charges: number; totalTTC: number; paidAmount: number }
interface PaymentProrata { isProrata?: boolean; daysOccupied?: number; daysInMonth?: number }
interface PaymentReminder { date: string; type: string }

interface Payment {
  _id: string;
  period: PaymentPeriod;
  amounts: PaymentAmounts;
  prorata?: PaymentProrata;
  status: 'PENDING' | 'CONFIRMED' | 'PARTIAL' | 'LATE' | 'UNPAID';
  property: { _id: string; address?: string; name?: string };
  tenant: { _id: string; firstName?: string; lastName?: string; email?: string };
  lease: string;
  confirmedAt?: string;
  receiptUrl?: string;
  remindersSent?: PaymentReminder[];
  notes?: string;
}

// ─── Config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Payment['status'], { label: string; bg: string; text: string; border: string; icon: typeof CheckCircle }> = {
  CONFIRMED: { label: 'Payé', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle },
  PARTIAL:   { label: 'Partiel', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  PENDING:   { label: 'En attente', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Clock },
  LATE:      { label: 'En retard', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle },
  UNPAID:    { label: 'Impayé', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle },
};

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

function daysLate(period: PaymentPeriod): number {
  const dueDate = new Date(period.year, period.month - 1, 5); // day 5 by default
  return Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000));
}

// ─── Confirm Modal ──────────────────────────────────────────────

function ConfirmModal({ payment, onClose, onDone }: {
  payment: Payment; onClose: () => void; onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(payment.amounts.totalTTC - payment.amounts.paidAmount));
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
    } finally { setLoading(false); }
  }, [payment._id, amount, method, notes, onDone]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Confirmer le paiement</h3>
        <p className="text-sm text-slate-500 mb-4">
          {MONTHS[payment.period.month - 1]} {payment.period.year} — {payment.property?.name || payment.property?.address}
        </p>
        <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="flex justify-between text-sm"><span className="text-slate-500">Loyer HC</span><span className="font-medium">{fmt(payment.amounts.rentHC)}</span></div>
          <div className="flex justify-between text-sm mt-1"><span className="text-slate-500">Charges</span><span className="font-medium">{fmt(payment.amounts.charges)}</span></div>
          <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-slate-200"><span>Total</span><span>{fmt(payment.amounts.totalTTC)}</span></div>
          {payment.amounts.paidAmount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 mt-1"><span>Déjà reçu</span><span>{fmt(payment.amounts.paidAmount)}</span></div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Montant reçu (€)</label>
            <input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Moyen de paiement</label>
            <select className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
              value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="VIREMENT">Virement</option>
              <option value="CHEQUE">Chèque</option>
              <option value="ESPECES">Espèces</option>
              <option value="PRELEVEMENT">Prélèvement</option>
              <option value="AUTRE">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes <span className="font-normal text-slate-400">optionnel</span></label>
            <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none"
              placeholder="Ex: reçu le 03/03" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={submit} disabled={loading || !amount}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
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
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmPaymentData, setConfirmPaymentData] = useState<Payment | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAllPayments(json.data || []);
    } catch {
      setAllPayments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Filter to current month view
  const monthPayments = useMemo(() => {
    let result = allPayments.filter(
      (p) => p.period.month === viewMonth && p.period.year === viewYear
    );
    if (statusFilter) result = result.filter((p) => p.status === statusFilter);
    if (propertyFilter !== 'all') result = result.filter((p) => p.property?._id === propertyFilter);
    return result;
  }, [allPayments, viewMonth, viewYear, statusFilter, propertyFilter]);

  // Unique properties for filter
  const properties = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allPayments) {
      if (p.property?._id) {
        map.set(p.property._id, p.property.name || p.property.address || '—');
      }
    }
    return [...map.entries()];
  }, [allPayments]);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleGenerate = useCallback(async () => {
    setGenerating(true); setMessage('');
    try {
      const res = await fetch('/api/payments/generate', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        const d = json.data || json;
        setMessage(`${d.created || 0} loyer(s) généré(s), ${d.skipped || 0} déjà existant(s).`);
        fetchPayments();
      } else { setMessage(json.error || 'Erreur lors de la génération'); }
    } catch { setMessage('Erreur réseau'); }
    finally { setGenerating(false); }
  }, [fetchPayments]);

  const handleRemind = useCallback(async () => {
    setReminding(true); setMessage('');
    try {
      const res = await fetch('/api/payments/remind', { method: 'POST' });
      const json = await res.json();
      if (res.ok) { setMessage(`${json.sent || json.data?.length || 0} relance(s) envoyée(s).`); }
      else { setMessage(json.error || 'Erreur lors des relances'); }
    } catch { setMessage('Erreur réseau'); }
    finally { setReminding(false); }
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/export?format=csv');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `loyers_export_${viewYear}-${String(viewMonth).padStart(2, '0')}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }, [viewMonth, viewYear]);

  const downloadReceipt = useCallback(async (p: Payment) => {
    try {
      const res = await fetch(`/api/payments/${p._id}/receipt`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `quittance_${MONTHS[p.period.month - 1]}_${p.period.year}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch { /* silent */ }
  }, []);

  const handleConfirmDone = useCallback(() => {
    setConfirmPaymentData(null); fetchPayments();
  }, [fetchPayments]);

  // Stats for current month
  const totalDue = monthPayments.reduce((s, p) => s + p.amounts.totalTTC, 0);
  const totalPaid = monthPayments.reduce((s, p) => s + p.amounts.paidAmount, 0);
  const lateCount = monthPayments.filter((p) => p.status === 'LATE' || p.status === 'UNPAID').length;
  const pendingCount = monthPayments.filter((p) => p.status === 'PENDING').length;
  const lateAmount = monthPayments
    .filter((p) => p.status === 'LATE' || p.status === 'UNPAID')
    .reduce((s, p) => s + p.amounts.totalTTC - p.amounts.paidAmount, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-950">Loyers & Quittances</h1>
          <p className="mt-1 text-sm text-slate-500">Suivi des paiements, quittances PDF et relances</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Générer les loyers
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={<CreditCard className="h-5 w-5 text-slate-500" />} value={fmt(totalDue)} label="Attendu" bg="bg-slate-50" />
        <StatCard icon={<CheckCircle className="h-5 w-5 text-emerald-500" />} value={fmt(totalPaid)} label="Encaissé" bg="bg-emerald-50" />
        <StatCard icon={<Clock className="h-5 w-5 text-blue-500" />} value={pendingCount} label="En attente" bg="bg-blue-50" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-500" />} value={lateCount > 0 ? `${lateCount} (${fmt(lateAmount)})` : '0'} label="Impayés" bg="bg-red-50" />
      </div>

      {/* Month navigation + filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 transition-colors" aria-label="Mois précédent">
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <span className="min-w-[160px] text-center text-lg font-bold text-slate-900">
            {MONTHS[viewMonth - 1]} {viewYear}
          </span>
          <button type="button" onClick={nextMonth} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 transition-colors" aria-label="Mois suivant">
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrer par statut"
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none cursor-pointer">
              <option value="">Tous les statuts</option>
              <option value="CONFIRMED">Payé</option>
              <option value="PENDING">En attente</option>
              <option value="PARTIAL">Partiel</option>
              <option value="LATE">En retard</option>
              <option value="UNPAID">Impayé</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
          {properties.length > 1 && (
            <div className="relative">
              <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} aria-label="Filtrer par bien"
                className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 outline-none cursor-pointer">
                <option value="all">Tous les biens</option>
                {properties.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : monthPayments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100">
            <Wallet className="h-6 w-6 text-slate-400" />
          </div>
          <p className="font-medium text-slate-700">Aucun loyer pour {MONTHS[viewMonth - 1]} {viewYear}</p>
          <p className="mt-1 text-sm text-slate-500">
            Cliquez sur &quot;Générer les loyers&quot; pour créer les échéances.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <Th>Locataire</Th>
                  <Th>Bien</Th>
                  <Th className="text-right">Loyer</Th>
                  <Th className="text-right">Charges</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Statut</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {monthPayments.map((p) => {
                  const cfg = STATUS_CONFIG[p.status];
                  const Icon = cfg.icon;
                  const tenantLabel = p.tenant
                    ? `${p.tenant.firstName ?? ''} ${p.tenant.lastName ?? ''}`.trim() || p.tenant.email || '—'
                    : '—';
                  const canConfirm = p.status === 'PENDING' || p.status === 'PARTIAL' || p.status === 'LATE' || p.status === 'UNPAID';
                  const canReceipt = p.status === 'CONFIRMED';
                  const isProrata = p.prorata?.isProrata;
                  const late = (p.status === 'LATE' || p.status === 'UNPAID') ? daysLate(p.period) : 0;

                  return (
                    <tr key={p._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="text-sm font-semibold text-slate-900">{tenantLabel}</div>
                        {p.confirmedAt && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            payé le {new Date(p.confirmedAt).toLocaleDateString('fr-FR')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">
                        {p.property?.name || p.property?.address?.split(',')[0] || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-slate-700">
                        {fmt(p.amounts.rentHC)}
                        {isProrata && (
                          <div className="text-[10px] text-orange-500 font-medium">
                            ({p.prorata?.daysOccupied}j/{p.prorata?.daysInMonth}j)
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-slate-500">
                        {fmt(p.amounts.charges)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-bold text-slate-900">{fmt(p.amounts.totalTTC)}</span>
                        {p.amounts.paidAmount > 0 && p.amounts.paidAmount < p.amounts.totalTTC && (
                          <div className="text-[10px] text-emerald-600">reçu {fmt(p.amounts.paidAmount)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                        {late > 0 && (
                          <div className="text-[10px] font-semibold text-red-600 mt-0.5">+{late}j</div>
                        )}
                        {isProrata && (
                          <div className="mt-0.5">
                            <span className="rounded-md bg-orange-50 border border-orange-200 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600">Prorata</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {canConfirm && (
                            <button onClick={() => setConfirmPaymentData(p)}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-orange-600 transition-colors">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Confirmer</span>
                            </button>
                          )}
                          {canReceipt && (
                            <button onClick={() => downloadReceipt(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                              <Download className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Quittance</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold text-slate-900">
                    Total {MONTHS[viewMonth - 1]}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-700">
                    {fmt(monthPayments.reduce((s, p) => s + p.amounts.rentHC, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-500">
                    {fmt(monthPayments.reduce((s, p) => s + p.amounts.charges, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                    {fmt(totalDue)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-semibold text-emerald-600">{fmt(totalPaid)}</span>
                    <span className="text-slate-400"> encaissé</span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmPaymentData && (
          <ConfirmModal
            payment={confirmPaymentData}
            onClose={() => setConfirmPaymentData(null)}
            onDone={handleConfirmDone}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

export { LoyersPanel };
