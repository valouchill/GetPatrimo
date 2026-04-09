export interface LeaseInfo {
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

export interface PaymentRecord {
  _id: string;
  period: { month: number; year: number };
  amounts: { rentHC: number; charges: number; totalTTC: number; paidAmount: number };
  status: 'PENDING' | 'CONFIRMED' | 'PARTIAL' | 'LATE' | 'UNPAID';
  receiptUrl?: string;
  receiptSentAt?: string;
  receiptSentTo?: string;
  confirmedAt?: string;
}

export type MonthStatus = 'sent' | 'to_generate' | 'upcoming' | 'partial' | 'overdue' | 'late';

export interface MonthEntry {
  month: number;
  year: number;
  label: string;
  totalTTC: number;
  status: MonthStatus;
  payment?: PaymentRecord;
  daysOverdue?: number;
}

export interface TimelineMetrics {
  totalPaid: number;
  totalDue: number;
  overdueCount: number;
  nextDueDate: string | null;
  receiptsSentCount: number;
}

export const MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

export const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
