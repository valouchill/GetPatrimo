'use client';

/**
 * /dashboard/admin/pilots — Pilotes B2B (superadmin).
 * Octroi en 2 champs (email + nb d'audits, défaut 10) et suivi commercial :
 * date d'octroi, 1er audit, dernier audit, consommation — les signaux qui
 * pilotent la relance J+2 et le débrief/closing J+7.
 */

import { useCallback, useEffect, useState } from 'react';

interface PilotRow {
  userId: string;
  email: string;
  grants: number;
  totalAudits: number;
  grantedAt: string;
  lastGrantAt: string;
  properties: number;
  quota: number;
  consumed: number;
  auditedApplications: number;
  firstAuditAt: string | null;
  lastAuditAt: string | null;
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPilotsPage() {
  const [pilots, setPilots] = useState<PilotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [audits, setAudits] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pilots');
      const data = await res.json();
      setPilots(data.pilots || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(audits, 10);
    if (!email.trim() || !Number.isFinite(n) || n < 1) return;
    if (!window.confirm(`Octroyer ${n} audits offerts à ${email.trim()} (tous ses biens) ?`)) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/pilots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), audits: n }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          ok: true,
          msg: `✅ ${data.audits} audits octroyés à ${data.email} (${data.properties} bien${data.properties > 1 ? 's' : ''} équipé${data.properties > 1 ? 's' : ''}).`,
        });
        setEmail('');
        setAudits('10');
        await load();
      } else {
        setFeedback({ ok: false, msg: data.error || 'Erreur lors de l’octroi.' });
      }
    } catch {
      setFeedback({ ok: false, msg: 'Erreur réseau.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">🤝 Pilotes B2B</h1>
      <p className="mt-1 text-sm text-gray-500">
        Octroyez des audits offerts à une agence (pilote gratuit), puis suivez la consommation —
        le débrief/closing se cale sur le « dernier audit », pas sur le calendrier seul.
      </p>

      {/* Formulaire d'octroi */}
      <form
        onSubmit={grant}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="min-w-64 flex-1">
          <label htmlFor="pilot-email" className="block text-xs font-semibold text-gray-600">
            Email du compte agence
          </label>
          <input
            id="pilot-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="gerant@agence.fr"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="pilot-audits" className="block text-xs font-semibold text-gray-600">
            Audits offerts
          </label>
          <input
            id="pilot-audits"
            type="number"
            min={1}
            max={500}
            required
            value={audits}
            onChange={(e) => setAudits(e.target.value)}
            className="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {submitting ? 'Octroi…' : 'Octroyer le pilote'}
        </button>
        <p className="w-full text-xs text-gray-400">
          Le compte doit exister et avoir au moins un bien. L’octroi ajoute les audits au quota de
          chaque bien, passe l’offre à PREMIUM minimum et débloque la comparaison. Une relance du
          formulaire sur le même email = extension (cumul).
        </p>
      </form>

      {feedback && (
        <div
          className={`mt-3 rounded-lg px-4 py-2.5 text-sm ${
            feedback.ok
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Tableau de suivi */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Agence</th>
              <th className="px-4 py-3">Audits offerts</th>
              <th className="px-4 py-3">Octroi</th>
              <th className="px-4 py-3">1ᵉʳ audit</th>
              <th className="px-4 py-3">Dernier audit</th>
              <th className="px-4 py-3">Consommation</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && pilots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Aucun pilote pour l’instant — octroyez le premier ci-dessus.
                </td>
              </tr>
            )}
            {!loading &&
              pilots.map((p) => (
                <tr key={p.userId} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.email}</div>
                    <div className="text-xs text-gray-400">
                      {p.properties} bien{p.properties > 1 ? 's' : ''}
                      {p.grants > 1 ? ` · ${p.grants} octrois` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{p.totalAudits}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {fmtDate(p.grantedAt)}
                    {p.grants > 1 && (
                      <div className="text-xs text-gray-400">ext. {fmtDate(p.lastGrantAt)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(p.firstAuditAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(p.lastAuditAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.consumed === 0
                          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}
                    >
                      {p.consumed}/{p.quota} audit{p.quota > 1 ? 's' : ''}
                    </span>
                    {p.consumed === 0 && (
                      <div className="mt-1 text-xs text-amber-600">à relancer (activation)</div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
