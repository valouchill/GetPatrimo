'use client';

import { useEffect, useState, ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  endpoint: string;
  columns: Column<T>[];
  initialQuery?: Record<string, string>;
  filters?: ReactNode;
  filtersDep?: any[];
  emptyLabel?: string;
}

export default function SimpleTable<T extends { _id: string }>({
  endpoint,
  columns,
  initialQuery = {},
  filters,
  filtersDep = [],
  emptyLabel = 'Aucun résultat',
}: Props<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const limit = 50;

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ ...initialQuery });
    params.set('limit', String(limit));
    params.set('skip', String(skip));
    try {
      const res = await fetch(`${endpoint}?${params.toString()}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [skip, ...filtersDep]);
  useEffect(() => { setSkip(0); /* eslint-disable-next-line */ }, filtersDep);

  return (
    <>
      {filters}
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 ${c.className || ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <tr><td colSpan={columns.length} className="px-3 py-4 text-center text-gray-500">Chargement…</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-4 text-center text-gray-500">{emptyLabel}</td></tr>}
            {items.map((row) => (
              <tr key={row._id} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.className || ''}`}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {total === 0 ? '0' : `${skip + 1}–${Math.min(skip + limit, total)}`} sur {total}
        </div>
        <div className="flex gap-2">
          <button disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))} className="border border-gray-300 rounded px-3 py-1 disabled:opacity-50 hover:bg-gray-50">Précédent</button>
          <button disabled={skip + limit >= total} onClick={() => setSkip(skip + limit)} className="border border-gray-300 rounded px-3 py-1 disabled:opacity-50 hover:bg-gray-50">Suivant</button>
        </div>
      </div>
    </>
  );
}
