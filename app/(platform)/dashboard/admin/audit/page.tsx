'use client';

import { useState } from 'react';
import SimpleTable from '../_components/SimpleTable';

interface Row {
  _id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string;
  ip?: string;
  createdAt: string;
}

export default function AdminAuditPage() {
  const [targetType, setTargetType] = useState('');
  const [action, setAction] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const query: Record<string, string> = {};
  if (targetType) query.targetType = targetType;
  if (action) query.action = action;
  if (actorEmail) query.actorEmail = actorEmail;

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-600">Historique des actions admin (read-only)</p>
      </header>
      <SimpleTable<Row>
        endpoint="/api/admin/audit-log"
        initialQuery={query}
        filtersDep={[targetType, action, actorEmail]}
        filters={
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-2">
            <input placeholder="Action (ex: user.suspend)" value={action} onChange={(e) => setAction(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input placeholder="Type cible (User/Payment…)" value={targetType} onChange={(e) => setTargetType(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
            <input placeholder="Email acteur" value={actorEmail} onChange={(e) => setActorEmail(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
        }
        columns={[
          { key: 'when', label: 'Quand', render: (r) => <span className="text-xs">{new Date(r.createdAt).toLocaleString('fr-FR')}</span> },
          { key: 'actor', label: 'Acteur', render: (r) => <div><div className="text-xs font-mono">{r.actorEmail}</div><div className="text-[10px] text-gray-500 uppercase">{r.actorRole}</div></div> },
          { key: 'action', label: 'Action', render: (r) => <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.action}</span> },
          { key: 'target', label: 'Cible', render: (r) => <span className="text-xs">{r.targetType} {r.targetId && <span className="font-mono text-gray-500">· {String(r.targetId).slice(-8)}</span>}</span> },
          { key: 'ip', label: 'IP', render: (r) => <span className="text-xs font-mono text-gray-500">{r.ip || '—'}</span> },
        ]}
      />
    </div>
  );
}
