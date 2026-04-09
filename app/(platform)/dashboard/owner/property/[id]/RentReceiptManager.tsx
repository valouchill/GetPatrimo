'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumSurface, StatusBadge } from '@/app/components/ui/premium';
import { Receipt, Download, Send, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

interface LeaseInfo {
  _id: string;
  startDate: string;
  endDate?: string;
  rentAmount: number;
  chargesAmount: number;
  tenantFirstName: string;
  tenantLastName: string;
  tenantEmail: string;
  leaseStatus?: string;
}

interface PaymentRecord {
  _id: string;
  period: { month: number; year: number };
  amounts: { rentHC: number; charges: number; totalTTC: number; paidAmount: number };
  status: 'PENDING' | 'CONFIRMED' | 'PARTIAL' | 'LATE' | 'UNPAID';
  receiptUrl?: string;
  receiptSentAt?: string;
  receiptSentTo?: string;
}

type MonthStatus = 'sent' | 'to_generate' | 'upcoming' | 'partial';

interface MonthEntry {
  month: number;
  year: number;
  label: string;
  totalTTC: number;
  status: MonthStatus;
  payment?: PaymentRecord;
}

// ─── Helpers ────────────────────────────────────────────────────

const MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';

function buildTimeline(lease: LeaseInfo, payments: PaymentRecord[]): MonthEntry[] {
  const start = new Date(lease.startDate);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  let m = start.getMonth() + 1;
  let y = start.getFullYear();
  const total = lease.rentAmount + lease.chargesAmount;

  const paymentMap = new Map<string, PaymentRecord>();
  for (const p of payments) {
    paymentMap.set(`${p.period.year}-${p.period.month}`, p);
  }

  const entries: MonthEntry[] = [];

  // Generate up to current month + 2 months ahead
  const limitYear = currentYear + 1;
  while (y < limitYear || (y === limitYear && m <= 2)) {
    const key = `${y}-${m}`;
    const payment = paymentMap.get(key);

    const isFuture = y > currentYear || (y === currentYear && m > currentMonth);

    let status: MonthStatus;
    if (payment) {
      if (payment.status === 'CONFIRMED' && payment.receiptUrl) {
        status = 'sent';
      } else if (payment.status === 'PARTIAL') {
        status = 'partial';
      } else {
        status = isFuture ? 'upcoming' : 'to_generate';
      }
    } else {
      status = isFuture ? 'upcoming' : 'to_generate';
    }

    entries.push({
      month: m,
      year: y,
      label: `${MONTHS[m - 1]} ${y}`,
      totalTTC: payment?.amounts.totalTTC ?? total,
      status,
      payment,
    });

    m++;
    if (m > 12) { m = 1; y++; }

    // Stop 2 months after current
    if (y > currentYear || (y === currentYear && m > currentMonth + 2)) break;
  }

  return entries.reverse(); // Most recent first
}

// ─── Confirm Dialog ─────────────────────────────────────────────

function ConfirmDialog({
  entry,
  tenantName,
  leaseId,
  onClose,
  onDone,
}: {
  entry: MonthEntry;
  tenantName: string;
  leaseId: string;
  onClose: () => void;
  onDone: () => void;
}) {
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

// ─── Row Actions (for sent receipts) ────────────────────────────

function RowActions({ payment }: { payment: PaymentRecord }) {
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(!!payment.receiptSentAt);

  const download = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/payments/${payment._id}/receipt`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quittance_${payment.period.month}_${payment.period.year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [payment]);

  const resend = useCallback(async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/payments/${payment._id}/send-receipt`, { method: 'POST' });
      if (res.ok) setSent(true);
    } finally {
      setSending(false);
    }
  }, [payment]);

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={download}
        disabled={downloading}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        title="Telecharger"
      >
        {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={resend}
        disabled={sending}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        title={sent ? 'Renvoyer' : 'Envoyer'}
      >
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {sent && <span className="text-emerald-600">Envoye</span>}
      </button>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function RentReceiptManager({ propertyId }: { propertyId: string }) {
  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmEntry, setConfirmEntry] = useState<MonthEntry | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/receipts/timeline?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json();
      setLease(data.data.lease);
      setPayments(data.data.payments);
    } catch {
      setError('Impossible de charger les quittances');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

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
    // No lease for this property — hide the section entirely
    return null;
  }

  const tenantName = `${lease.tenantFirstName || ''} ${lease.tenantLastName || ''}`.trim() || lease.tenantEmail || 'Locataire';
  const timeline = buildTimeline(lease, payments);

  const statusBadge = (entry: MonthEntry) => {
    switch (entry.status) {
      case 'sent':
        return <StatusBadge label="Envoyee" tone="success" />;
      case 'partial':
        return <StatusBadge label="Partiel" tone="warning" />;
      case 'to_generate':
        return <StatusBadge label="A generer" tone="warning" />;
      case 'upcoming':
        return <StatusBadge label="A venir" tone="neutral" />;
    }
  };

  return (
    <>
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
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {timeline.map((entry) => (
            <div
              key={`${entry.year}-${entry.month}`}
              className="flex items-center gap-3 py-3 hover:bg-slate-50/60 transition-colors -mx-2 px-2 rounded-lg"
            >
              {/* Month label */}
              <div className="min-w-[120px] sm:min-w-[140px]">
                <span className="font-serif font-medium text-emerald-900 text-sm">
                  {entry.label}
                </span>
              </div>

              {/* Amount */}
              <div className="hidden sm:block text-sm text-slate-400 tabular-nums min-w-[90px]">
                {fmt(entry.totalTTC)}
              </div>

              {/* Badge */}
              <div className="flex-1 flex justify-end sm:justify-start">
                {statusBadge(entry)}
              </div>

              {/* Actions */}
              <div className="shrink-0">
                {entry.status === 'to_generate' && (
                  <button
                    onClick={() => setConfirmEntry(entry)}
                    className="rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
                  >
                    Valider le paiement
                  </button>
                )}
                {entry.status === 'sent' && entry.payment && (
                  <RowActions payment={entry.payment} />
                )}
                {entry.status === 'partial' && entry.payment && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-600 tabular-nums">{fmt(entry.payment.amounts.paidAmount)}</span>
                    <RowActions payment={entry.payment} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {timeline.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">
            Aucune periode de location trouvee
          </p>
        )}
      </PremiumSurface>

      <AnimatePresence>
        {confirmEntry && (
          <ConfirmDialog
            entry={confirmEntry}
            tenantName={tenantName}
            leaseId={lease._id}
            onClose={() => setConfirmEntry(null)}
            onDone={() => { setConfirmEntry(null); fetchTimeline(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
