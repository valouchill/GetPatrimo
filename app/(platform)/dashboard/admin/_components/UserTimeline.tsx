'use client';

import { useEffect, useState } from 'react';

interface Entry {
  type: string;
  at: string;
  label: string;
  meta?: Record<string, any>;
}

const ICONS: Record<string, string> = {
  admin: '🛡️',
  event: '📌',
  payment: '💶',
  application: '📥',
  lease: '📄',
};

const COLORS: Record<string, string> = {
  admin: 'border-indigo-300 bg-indigo-50',
  event: 'border-gray-200 bg-gray-50',
  payment: 'border-green-200 bg-green-50',
  application: 'border-amber-200 bg-amber-50',
  lease: 'border-blue-200 bg-blue-50',
};

export default function UserTimeline({ userId }: { userId: string }) {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/timeline`);
        if (res.ok) {
          const j = await res.json();
          setItems(j.timeline || []);
        }
      } finally { setLoading(false); }
    })();
  }, [userId]);

  if (loading) return <div className="text-sm text-gray-500">Chargement…</div>;
  if (items.length === 0) return <div className="text-sm text-gray-500">Aucune activité.</div>;

  return (
    <ul className="space-y-1">
      {items.map((e, i) => (
        <li key={i} className={`border-l-4 ${COLORS[e.type] || 'border-gray-200'} px-3 py-2 rounded-r`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-sm">
                <span className="mr-1">{ICONS[e.type] || '•'}</span>
                {e.label}
              </div>
              {expanded === i && e.meta && (
                <pre className="text-[10px] mt-1 p-2 bg-white/70 rounded font-mono overflow-x-auto">
                  {JSON.stringify(e.meta, null, 2)}
                </pre>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 whitespace-nowrap">{new Date(e.at).toLocaleString('fr-FR')}</span>
              {e.meta && (
                <button onClick={() => setExpanded(expanded === i ? null : i)} className="text-[11px] text-indigo-600 hover:underline">
                  {expanded === i ? '▲' : '▼'}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
