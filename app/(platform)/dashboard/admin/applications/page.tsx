'use client';

import { useState } from 'react';
import SimpleTable from '../_components/SimpleTable';

interface Row {
  _id: string;
  profile?: { firstName?: string; lastName?: string; email?: string };
  status: string;
  score?: number;
  grade?: string;
  applyToken?: string;
  createdAt: string;
}

export default function AdminApplicationsPage() {
  const [status, setStatus] = useState('');
  const query: Record<string, string> = {};
  if (status) query.status = status;
  return (
    <div>
      <header className="mb-4"><h1 className="text-2xl font-bold text-gray-900">Candidatures</h1></header>
      <SimpleTable<Row>
        endpoint="/api/admin/applications"
        initialQuery={query}
        filtersDep={[status]}
        filters={
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex gap-2">
            <input placeholder="Statut (ex: SUBMITTED)" value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
        }
        columns={[
          { key: 'name', label: 'Candidat', render: (r) => <span>{r.profile?.firstName} {r.profile?.lastName}</span> },
          { key: 'email', label: 'Email', render: (r) => <span className="text-xs font-mono">{r.profile?.email || '—'}</span> },
          { key: 'status', label: 'Statut', render: (r) => <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">{r.status}</span> },
          { key: 'score', label: 'Score', render: (r) => <span>{r.score ?? '—'} {r.grade && `(${r.grade})`}</span> },
          { key: 'token', label: 'Code', render: (r) => <span className="text-xs font-mono">{r.applyToken || '—'}</span> },
          { key: 'created', label: 'Reçue le', render: (r) => <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span> },
          { key: 'actions', label: '', render: (r) => <a href={`/dashboard/admin/applications/${r._id}`} className="text-xs text-indigo-600 hover:underline">Dossier →</a> },
        ]}
      />
    </div>
  );
}
