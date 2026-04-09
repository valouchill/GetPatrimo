'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LeaseInfo, PaymentRecord, MonthEntry, MonthStatus, TimelineMetrics } from './types';
import { MONTHS } from './types';

const TERMINAL_STATUSES = ['EXPIRED', 'TERMINATED'];

function buildTimeline(lease: LeaseInfo, payments: PaymentRecord[]): MonthEntry[] {
  const start = new Date(lease.startDate);
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const isHistorical = lease.leaseStatus ? TERMINAL_STATUSES.includes(lease.leaseStatus) : false;

  let m = start.getMonth() + 1;
  let y = start.getFullYear();
  const total = lease.rentAmount + lease.chargesAmount;

  const paymentMap = new Map<string, PaymentRecord>();
  for (const p of payments) {
    paymentMap.set(`${p.period.year}-${p.period.month}`, p);
  }

  const entries: MonthEntry[] = [];

  // Determine upper bound
  let limitMonth: number;
  let limitYear: number;

  if (isHistorical && lease.endDate) {
    const end = new Date(lease.endDate);
    limitMonth = end.getMonth() + 1;
    limitYear = end.getFullYear();
  } else {
    limitMonth = currentMonth + 2;
    limitYear = currentYear;
    if (limitMonth > 12) {
      limitMonth -= 12;
      limitYear++;
    }
  }

  while (true) {
    // Stop past upper bound
    if (y > limitYear || (y === limitYear && m > limitMonth)) break;

    const key = `${y}-${m}`;
    const payment = paymentMap.get(key);
    const isPast = y < currentYear || (y === currentYear && m < currentMonth);
    const isCurrent = y === currentYear && m === currentMonth;
    const isFuture = y > currentYear || (y === currentYear && m > currentMonth);

    let status: MonthStatus;
    if (payment) {
      if (payment.status === 'CONFIRMED' && payment.receiptUrl) {
        status = 'sent';
      } else if (payment.status === 'PARTIAL') {
        status = 'partial';
      } else if (payment.status === 'LATE' || payment.status === 'UNPAID') {
        status = 'late';
      } else if (isPast) {
        status = 'overdue';
      } else if (isFuture) {
        status = 'upcoming';
      } else {
        status = 'to_generate';
      }
    } else {
      if (isPast) {
        status = 'overdue';
      } else if (isFuture) {
        status = 'upcoming';
      } else {
        status = 'to_generate';
      }
    }

    // Compute days overdue
    let daysOverdue: number | undefined;
    if (status === 'overdue' || status === 'late') {
      const endOfMonth = new Date(y, m, 0); // last day of the month
      daysOverdue = Math.floor((now.getTime() - endOfMonth.getTime()) / (1000 * 60 * 60 * 24));
    }

    entries.push({
      month: m,
      year: y,
      label: `${MONTHS[m - 1]} ${y}`,
      totalTTC: payment?.amounts.totalTTC ?? total,
      status,
      payment,
      daysOverdue,
    });

    m++;
    if (m > 12) { m = 1; y++; }
  }

  return entries.reverse(); // Most recent first
}

export interface UseReceiptTimelineResult {
  lease: LeaseInfo | null;
  timeline: MonthEntry[];
  metrics: TimelineMetrics | null;
  loading: boolean;
  error: string;
  refetch: () => void;
  isHistorical: boolean;
}

export function useReceiptTimeline(propertyId: string): UseReceiptTimelineResult {
  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [metrics, setMetrics] = useState<TimelineMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/receipts/timeline?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json();
      setLease(data.data.lease);
      setPayments(data.data.payments || []);
      setMetrics(data.data.metrics || null);
    } catch {
      setError('Impossible de charger les quittances');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  const isHistorical = lease?.leaseStatus
    ? TERMINAL_STATUSES.includes(lease.leaseStatus)
    : false;

  const timeline = lease ? buildTimeline(lease, payments) : [];

  return { lease, timeline, metrics, loading, error, refetch: fetchTimeline, isHistorical };
}
