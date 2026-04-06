'use client';

import { useState } from 'react';
import SimpleTable from '../_components/SimpleTable';

interface Row {
  _id: string;
  period: { month: number; year: number };
  amounts: { totalTTC: number; paidAmount: number };
  status: string;
  tenant?: { email?: string; firstName?: string; lastName?: string };
  owner?: { email?: string };
  property?: { name?: string };
}

const STATUSES = ['PENDING', 'CONFIRMED', 'PARTIAL', 'LATE', 'UNPAID'];

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState('');
  const query: Record<string, string> = {};
  if (status) query.status = status;
  return (
    <div>
      <header className="mb-4"><h1 className="text-2xl font-bold text-gray-900">Paiements</h1></header>
      <SimpleTable<Row>
        endpoint="/api/admin/payments"
        initialQuery={query}
        filtersDep={[status]}
        filters={
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">Tous statuts</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }
        columns={[
          { key: 'period', label: 'Période', render: (r) => <span className="font-mono text-xs">{String(r.period.month).padStart(2, '0')}/{r.period.year}</span> },
          { key: 'tenant', label: 'Locataire', render: (r) => <span className="text-xs">{r.tenant?.email || '—'}</span> },
          { key: 'owner', label: 'Propriétaire', render: (r) => <span className="text-xs">{r.owner?.email || '—'}</span> },
          { key: 'property', label: 'Bien', render: (r) => <span className="text-xs">{r.property?.name || '—'}</span> },
          { key: 'total', label: 'TTC', render: (r) => <span>{r.amounts.totalTTC} €</span> },
          { key: 'paid', label: 'Payé', render: (r) => <span>{r.amounts.paidAmount} €</span> },
          { key: 'status', label: 'Statut', render: (r) => <PaymentStatusControl id={r._id} current={r.status} /> },
          { key: 'actions', label: '', render: (r) => <a href={`/dashboard/admin/payments/${r._id}`} className="text-xs text-indigo-600 hover:underline">Éditer</a> },
        ]}
      />
    </div>
  );
}

function PaymentStatusControl({ id, current }: { id: string; current: string }) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  async function apply(newVal: string) {
    if (newVal === current) return;
    if (!confirm(`Forcer le statut du paiement à "${newVal}" ?`)) { setValue(current); return; }
    setBusy(true);
    try {
      await fetch(`/api/admin/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newVal }),
      });
      setValue(newVal);
    } finally { setBusy(false); }
  }
  return (
    <select value={value} onChange={(e) => apply(e.target.value)} disabled={busy} className="text-xs border border-gray-300 rounded px-1 py-0.5">
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
