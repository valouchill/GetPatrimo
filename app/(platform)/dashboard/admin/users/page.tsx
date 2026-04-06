'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UserRow {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  plan: string;
  credits: number;
  suspended?: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [suspended, setSuspended] = useState('');
  const [skip, setSkip] = useState(0);
  const limit = 50;

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (suspended) params.set('suspended', suspended);
    params.set('limit', String(limit));
    params.set('skip', String(skip));
    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, suspended, skip]);

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <p className="text-sm text-gray-600">{total} compte(s)</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Rechercher email/nom…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setSkip(0); load(); } }}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={role}
          onChange={(e) => { setSkip(0); setRole(e.target.value); }}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="">Tous rôles</option>
          <option value="owner">Owner</option>
          <option value="tenant">Tenant</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <select
          value={suspended}
          onChange={(e) => { setSkip(0); setSuspended(e.target.value); }}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="">Tous statuts</option>
          <option value="false">Actifs</option>
          <option value="true">Suspendus</option>
        </select>
        <button
          onClick={() => { setSkip(0); load(); }}
          className="bg-indigo-600 text-white rounded px-3 py-1.5 text-sm hover:bg-indigo-700"
        >
          Rechercher
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Crédits</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Créé le</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500">Chargement…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500">Aucun résultat</td></tr>
            )}
            {items.map((u) => (
              <tr key={u._id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-3 py-2">{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    u.role === 'superadmin' ? 'bg-purple-100 text-purple-800' :
                    u.role === 'admin' ? 'bg-indigo-100 text-indigo-800' :
                    u.role === 'owner' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-3 py-2">{u.plan}</td>
                <td className="px-3 py-2">{u.credits}</td>
                <td className="px-3 py-2">
                  {u.suspended
                    ? <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">suspendu</span>
                    : <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">actif</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2">
                  <Link href={`/dashboard/admin/users/${u._id}`} className="text-indigo-600 hover:underline text-xs">
                    Détails →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {skip + 1}–{Math.min(skip + limit, total)} sur {total}
        </div>
        <div className="flex gap-2">
          <button
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
            className="border border-gray-300 rounded px-3 py-1 disabled:opacity-50 hover:bg-gray-50"
          >
            Précédent
          </button>
          <button
            disabled={skip + limit >= total}
            onClick={() => setSkip(skip + limit)}
            className="border border-gray-300 rounded px-3 py-1 disabled:opacity-50 hover:bg-gray-50"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
