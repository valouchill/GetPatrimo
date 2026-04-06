'use client';

import { useState } from 'react';
import SimpleTable from '../_components/SimpleTable';

interface Row {
  _id: string;
  name: string;
  address: string;
  city?: string;
  status: string;
  archived?: boolean;
  rentAmount: number;
  user?: { email?: string } | null;
  applyToken?: string;
}

export default function AdminPropertiesPage() {
  const [status, setStatus] = useState('');
  const [archived, setArchived] = useState('');

  const query: Record<string, string> = {};
  if (status) query.status = status;
  if (archived) query.archived = archived;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Biens</h1>
      </header>
      <SimpleTable<Row>
        endpoint="/api/admin/properties"
        initialQuery={query}
        filtersDep={[status, archived]}
        filters={
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">Tous statuts</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="CANDIDATE_SELECTION">CANDIDATE_SELECTION</option>
              <option value="LEASE_IN_PROGRESS">LEASE_IN_PROGRESS</option>
              <option value="OCCUPIED">OCCUPIED</option>
              <option value="VACANT">VACANT</option>
            </select>
            <select value={archived} onChange={(e) => setArchived(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">Tous</option>
              <option value="false">Actifs</option>
              <option value="true">Archivés</option>
            </select>
          </div>
        }
        columns={[
          { key: 'name', label: 'Nom', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'address', label: 'Adresse', render: (r) => <span className="text-xs">{r.address} {r.city}</span> },
          { key: 'owner', label: 'Propriétaire', render: (r) => <span className="text-xs">{r.user?.email || '—'}</span> },
          { key: 'rent', label: 'Loyer', render: (r) => <span>{r.rentAmount} €</span> },
          { key: 'status', label: 'Statut', render: (r) => <span className="text-xs">{r.status}</span> },
          { key: 'archived', label: 'Archivé', render: (r) => r.archived ? <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">oui</span> : '—' },
          { key: 'token', label: 'Code', render: (r) => <span className="text-xs font-mono">{r.applyToken || '—'}</span> },
          { key: 'actions', label: '', render: (r) => (
            <div className="flex gap-2">
              <a href={`/dashboard/admin/properties/${r._id}`} className="text-xs text-indigo-600 hover:underline">Éditer</a>
              <PropertyActions id={r._id} archived={Boolean(r.archived)} />
            </div>
          ) },
        ]}
      />
    </div>
  );
}

function PropertyActions({ id, archived }: { id: string; archived: boolean }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!confirm(archived ? 'Réactiver ce bien ?' : 'Archiver ce bien ?')) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/properties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !archived }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={toggle} disabled={busy} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
      {archived ? 'Réactiver' : 'Archiver'}
    </button>
  );
}
