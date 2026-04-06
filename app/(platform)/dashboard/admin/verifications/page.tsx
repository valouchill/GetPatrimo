'use client';

import { useState } from 'react';
import SimpleTable from '../_components/SimpleTable';

interface Row {
  _id: string;
  sessionId: string;
  applyToken?: string;
  status: string;
  identityStatus: string;
  firstName?: string;
  lastName?: string;
  humanVerified?: boolean;
  verifiedAt?: string;
  createdAt: string;
}

export default function AdminVerificationsPage() {
  const [identityStatus, setIdentityStatus] = useState('');
  const query: Record<string, string> = {};
  if (identityStatus) query.identityStatus = identityStatus;
  return (
    <div>
      <header className="mb-4"><h1 className="text-2xl font-bold text-gray-900">KYC Didit</h1></header>
      <SimpleTable<Row>
        endpoint="/api/admin/verifications"
        initialQuery={query}
        filtersDep={[identityStatus]}
        filters={
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex gap-2">
            <select value={identityStatus} onChange={(e) => setIdentityStatus(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="">Tous statuts</option>
              <option value="PENDING">PENDING</option>
              <option value="CERTIFIEE">CERTIFIEE</option>
            </select>
          </div>
        }
        columns={[
          { key: 'name', label: 'Nom', render: (r) => <span>{r.firstName} {r.lastName}</span> },
          { key: 'session', label: 'Session', render: (r) => <span className="text-xs font-mono">{r.sessionId}</span> },
          { key: 'token', label: 'Code', render: (r) => <span className="text-xs font-mono">{r.applyToken || '—'}</span> },
          { key: 'status', label: 'Statut Didit', render: (r) => <span className="text-xs">{r.status}</span> },
          { key: 'identity', label: 'Identité', render: (r) => <span className={`text-xs px-1.5 py-0.5 rounded ${r.identityStatus === 'CERTIFIEE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{r.identityStatus}</span> },
          { key: 'human', label: 'Vérif. humaine', render: (r) => r.humanVerified ? '✓' : '—' },
          { key: 'verified', label: 'Le', render: (r) => <span className="text-xs text-gray-500">{r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString('fr-FR') : '—'}</span> },
        ]}
      />
    </div>
  );
}
