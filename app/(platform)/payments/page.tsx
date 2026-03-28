'use client';

import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Download, RefreshCw, Loader2, Filter, Search } from 'lucide-react';
import PaymentRow from './components/PaymentRow';
import type { Payment } from './components/PaymentRow';

interface PropertyOption { _id: string; address?: string; name?: string }

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirm\u00e9' },
  { value: 'PARTIAL', label: 'Partiel' },
  { value: 'LATE', label: 'En retard' },
  { value: 'UNPAID', label: 'Impay\u00e9' },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: '', label: 'Toutes les ann\u00e9es' },
  ...Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) })),
];

const selectCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-200';
const thCls = 'px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 md:px-4';

const PaymentsPage = memo(function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [genMessage, setGenMessage] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (yearFilter) params.set('year', yearFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('Impossible de charger les paiements.');
      const json: { success: boolean; data: Payment[] } = await res.json();
      setPayments(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally { setLoading(false); }
  }, [yearFilter, statusFilter]);

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/properties');
      if (!res.ok) return;
      const json: { properties?: PropertyOption[] } = await res.json();
      if (json.properties) setProperties(json.properties);
    } catch { /* filter won't populate */ }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const filteredPayments = useMemo(() => {
    if (!propertyFilter) return payments;
    return payments.filter((p) => p.property?._id === propertyFilter);
  }, [payments, propertyFilter]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true); setGenMessage('');
    try {
      const res = await fetch('/api/payments/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        throw new Error(data.error || 'Erreur lors de la g\u00e9n\u00e9ration.');
      }
      const json: { success: boolean; data: { created: number; skipped: number; errors: string[] } } = await res.json();
      const { created, skipped } = json.data;
      setGenMessage(`${created} paiement${created > 1 ? 's' : ''} g\u00e9n\u00e9r\u00e9${created > 1 ? 's' : ''}, ${skipped} ignor\u00e9${skipped > 1 ? 's' : ''}.`);
      fetchPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la g\u00e9n\u00e9ration.');
    } finally { setGenerating(false); }
  }, [fetchPayments]);

  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/payments/export?format=csv');
      if (!res.ok) throw new Error('Erreur lors de l\u2019export.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `paiements_${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\u2019export.');
    } finally { setExporting(false); }
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[#0f172a] sm:text-2xl">
            <CreditCard className="h-6 w-6 text-[#2563eb]" />
            Gestion des paiements
          </h1>
          <p className="mt-1 text-sm text-slate-500">Suivez et confirmez les loyers de vos locataires.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleGenerate} disabled={generating} aria-label="G\u00e9n\u00e9rer les paiements du mois" className="inline-flex items-center gap-2 rounded-lg bg-[#10b981] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            G\u00e9n\u00e9rer les paiements du mois
          </button>
          <button onClick={handleExportCSV} disabled={exporting} aria-label="Exporter en CSV" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter CSV
          </button>
        </div>
      </div>

      <AnimatePresence>
        {genMessage && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 overflow-hidden rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {genMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Filter className="h-4 w-4" />Filtres
        </div>
        <div className="flex-1">
          <label htmlFor="filterProperty" className="sr-only">Bien</label>
          <select id="filterProperty" value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className={selectCls}>
            <option value="">Tous les biens</option>
            {properties.map((p) => <option key={p._id} value={p._id}>{p.address || p.name || p._id}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="filterStatus" className="sr-only">Statut</label>
          <select id="filterStatus" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="filterYear" className="sr-only">Ann\u00e9e</label>
          <select id="filterYear" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className={selectCls}>
            {YEAR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-[#ef4444]" role="alert">
          {error}
        </motion.div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className={thCls}>P\u00e9riode</th>
                <th className={`hidden md:table-cell ${thCls}`}>Bien</th>
                <th className={`hidden lg:table-cell ${thCls}`}>Locataire</th>
                <th className={thCls}>Total TTC</th>
                <th className={`hidden sm:table-cell ${thCls}`}>Pay\u00e9</th>
                <th className={thCls}>Statut</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2563eb]" />
                    <p className="mt-2 text-sm text-slate-400">Chargement des paiements\u2026</p>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Search className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-400">Aucun paiement trouv\u00e9.</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <PaymentRow key={payment._id} payment={payment} onPaymentUpdated={fetchPayments} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filteredPayments.length > 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-right text-xs text-slate-400">
          {filteredPayments.length} paiement{filteredPayments.length > 1 ? 's' : ''} affich\u00e9{filteredPayments.length > 1 ? 's' : ''}
        </motion.p>
      )}
    </motion.div>
  );
});

export default PaymentsPage;
