'use client';

import React, { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Download,
  Clock,
  AlertTriangle,
  CircleDollarSign,
} from 'lucide-react';
import ConfirmPaymentModal from './ConfirmPaymentModal';

type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'PARTIAL' | 'LATE' | 'UNPAID';

interface PaymentPeriod {
  month: number;
  year: number;
}

interface PaymentAmounts {
  rentHC: number;
  charges: number;
  totalTTC: number;
  paidAmount: number;
}

interface PaymentProperty {
  _id: string;
  address?: string;
  name?: string;
}

interface PaymentTenant {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface Payment {
  _id: string;
  period: PaymentPeriod;
  amounts: PaymentAmounts;
  status: PaymentStatus;
  property: PaymentProperty;
  tenant: PaymentTenant;
  lease: string;
  notes?: string;
  confirmedAt?: string;
  receiptUrl?: string;
}

interface PaymentRowProps {
  payment: Payment;
  onPaymentUpdated: () => void;
}

const STATUS_CONFIG: Record<
  PaymentStatus,
  { label: string; bg: string; text: string }
> = {
  CONFIRMED: { label: 'Confirm\u00e9', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  PARTIAL: { label: 'Partiel', bg: 'bg-amber-100', text: 'text-amber-700' },
  PENDING: { label: 'En attente', bg: 'bg-blue-100', text: 'text-blue-700' },
  LATE: { label: 'En retard', bg: 'bg-red-100', text: 'text-red-700' },
  UNPAID: { label: 'Impay\u00e9', bg: 'bg-red-100', text: 'text-red-700' },
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

const PaymentRow = memo(function PaymentRow({
  payment,
  onPaymentUpdated,
}: PaymentRowProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const statusCfg = STATUS_CONFIG[payment.status];

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const handleConfirm = useCallback(() => {
    setModalOpen(false);
    onPaymentUpdated();
  }, [onPaymentUpdated]);

  const handleDownloadReceipt = useCallback(async () => {
    const res = await fetch(`/api/payments/${payment._id}/receipt`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quittance_${payment.period.month}_${payment.period.year}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [payment._id, payment.period.month, payment.period.year]);

  const propertyLabel =
    payment.property?.address || payment.property?.name || '\u2014';
  const tenantLabel =
    payment.tenant
      ? `${payment.tenant.firstName ?? ''} ${payment.tenant.lastName ?? ''}`.trim() ||
        payment.tenant.email ||
        '\u2014'
      : '\u2014';
  const periodLabel = `${MONTH_NAMES[payment.period.month - 1]} ${payment.period.year}`;
  const canConfirm =
    payment.status === 'PENDING' || payment.status === 'PARTIAL';

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
      >
        <td className="px-3 py-3 text-sm text-slate-700 md:px-4">
          {periodLabel}
        </td>
        <td className="hidden px-3 py-3 text-sm text-slate-700 md:table-cell md:px-4">
          {propertyLabel}
        </td>
        <td className="hidden px-3 py-3 text-sm text-slate-700 lg:table-cell lg:px-4">
          {tenantLabel}
        </td>
        <td className="px-3 py-3 text-sm font-medium text-[#0f172a] md:px-4">
          {formatCurrency(payment.amounts.totalTTC)}
        </td>
        <td className="hidden px-3 py-3 text-sm text-slate-700 sm:table-cell md:px-4">
          {formatCurrency(payment.amounts.paidAmount)}
        </td>
        <td className="px-3 py-3 md:px-4">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}
          >
            {statusCfg.label}
          </span>
        </td>
        <td className="px-3 py-3 md:px-4">
          <div className="flex items-center gap-2">
            {canConfirm && (
              <button
                onClick={openModal}
                aria-label="Confirmer le paiement"
                className="inline-flex items-center gap-1 rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Confirmer</span>
              </button>
            )}
            {payment.status === 'CONFIRMED' && (
              <button
                onClick={handleDownloadReceipt}
                aria-label="T\u00e9l\u00e9charger la quittance"
                className="inline-flex items-center gap-1 rounded-lg bg-[#10b981] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Quittance</span>
              </button>
            )}
            {(payment.status === 'LATE' || payment.status === 'UNPAID') && (
              <span className="inline-flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </td>
      </motion.tr>

      <ConfirmPaymentModal
        payment={payment}
        isOpen={modalOpen}
        onClose={closeModal}
        onConfirm={handleConfirm}
      />
    </>
  );
});

export default PaymentRow;
