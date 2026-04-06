'use client';

import { useState } from 'react';
import SimpleTable from '../_components/SimpleTable';

interface Row {
  _id: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantEmail: string;
  startDate: string;
  endDate?: string;
  rentAmount: number;
  leaseStatus: string;
  user?: { email?: string };
  property?: { name?: string; city?: string };
}

const STATUSES = ['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'TERMINATED'];

export default function AdminLeasesPage() {
  const [leaseStatus, setLeaseStatus] = useState('');
  const query: Record<string, string> = {};
  if (leaseStatus) query.leaseStatus = leaseStatus;

  return (
    <div>
      <header className="mb-4"><h1 className="text-2xl font-bold text-gray-900">Baux</h1></header>
      <SimpleTable<Row>
        endpoint="/api/admin/leases"
        initialQuery={query}
        filtersDep={[leaseStatus]}
        filters={
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex gap-2">
            <select value={leaseStatus} onChange={(e) => setLeaseStatus(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">Tous statuts</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        }
        columns={[
          { key: 'tenant', label: 'Locataire', render: (r) => <div><div className="font-medium">{r.tenantFirstName} {r.tenantLastName}</div><div className="text-xs text-gray-500 font-mono">{r.tenantEmail}</div></div> },
          { key: 'owner', label: 'Propriétaire', render: (r) => <span className="text-xs">{r.user?.email || '—'}</span> },
          { key: 'property', label: 'Bien', render: (r) => <span className="text-xs">{r.property?.name || '—'} · {r.property?.city || ''}</span> },
          { key: 'period', label: 'Période', render: (r) => <span className="text-xs">{new Date(r.startDate).toLocaleDateString('fr-FR')} → {r.endDate ? new Date(r.endDate).toLocaleDateString('fr-FR') : '—'}</span> },
          { key: 'rent', label: 'Loyer', render: (r) => <span>{r.rentAmount} €</span> },
          { key: 'status', label: 'Statut', render: (r) => <LeaseStatusControl id={r._id} current={r.leaseStatus} /> },
          { key: 'actions', label: '', render: (r) => <a href={`/dashboard/admin/leases/${r._id}`} className="text-xs text-indigo-600 hover:underline">Éditer</a> },
        ]}
      />
    </div>
  );
}

function LeaseStatusControl({ id, current }: { id: string; current: string }) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  async function apply(newVal: string) {
    if (newVal === current) return;
    if (!confirm(`Forcer le statut du bail à "${newVal}" ?`)) { setValue(current); return; }
    setBusy(true);
    try {
      await fetch(`/api/admin/leases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaseStatus: newVal }),
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
