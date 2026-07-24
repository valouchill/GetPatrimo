'use client';

/**
 * /dashboard/admin/pilots — Pilotes B2B (superadmin).
 * Octroi en 2 champs (email + nb d'audits, défaut 10) et suivi commercial :
 * date d'octroi, 1er audit, dernier audit, consommation — les signaux qui
 * pilotent la relance J+2 et le débrief/closing J+7.
 */

import { useCallback, useEffect, useState } from 'react';

interface PilotRow {
  userId: string | null;
  email: string;
  status: 'INVITED' | 'PENDING_PROPERTY' | 'ACTIVE';
  accountType: 'B2C' | 'B2B' | null;
  kinds: Array<'PILOT' | 'CREDIT'>;
  pendingAudits: number;
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
  const [kind, setKind] = useState<'PILOT' | 'CREDIT'>('PILOT');
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
    const kindLabel = kind === 'PILOT' ? 'pilote B2B (offre Pro + comparaison)' : 'geste commercial (audits seuls)';
    if (!window.confirm(`Octroyer ${n} audits offerts à ${email.trim()} — ${kindLabel} ?`)) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/pilots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), audits: n, kind }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          ok: true,
          msg: data.pending
            ? `⏳ ${data.message}`
            : `✅ ${data.audits} audits octroyés à ${data.email} (${data.properties} bien${data.properties > 1 ? 's' : ''} équipé${data.properties > 1 ? 's' : ''}).`,
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
      <h1 className="font-serif text-2xl font-bold text-emerald-950">🤝 Pilotes &amp; crédits</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pilote B2B (offre Pro + comparaison débloquées) ou geste commercial (audits offerts, B2C
        comme B2B) — puis suivez la consommation : le closing se cale sur le « dernier audit ».
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
          <label htmlFor="pilot-kind" className="block text-xs font-semibold text-gray-600">
            Type d&rsquo;octroi
          </label>
          <select
            id="pilot-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'PILOT' | 'CREDIT')}
            className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="PILOT">🤝 Pilote B2B</option>
            <option value="CREDIT">🎁 Geste commercial</option>
          </select>
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
          <strong>Pilote B2B</strong> : quota +X sur chaque bien + offre PREMIUM + comparaison
          débloquée. <strong>Geste commercial</strong> : audits seuls — client déjà payant : rien
          d&rsquo;autre ne change ; compte encore gratuit : mini-déblocage Essentiel (sinon les
          audits seraient inutilisables). Sans compte ou sans bien → invitation email + application
          automatique au premier bien. Relancer sur le même email = extension (cumul).
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
                <tr key={p.email} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{p.email}</span>
                      {p.userId && (
                        <button
                          type="button"
                          title="Basculer B2C / B2B (B2B = onglet « Mon offre Pro », jamais d'offres grand public)"
                          onClick={async () => {
                            const next = p.accountType === 'B2B' ? 'B2C' : 'B2B';
                            if (!window.confirm(`Basculer ${p.email} en ${next} ?`)) return;
                            const res = await fetch(`/api/admin/users/${p.userId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ accountType: next }),
                            });
                            if (res.ok) { await load(); }
                            else { setFeedback({ ok: false, msg: 'Échec du changement de type de compte.' }); }
                          }}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 transition-colors ${
                            p.accountType === 'B2B'
                              ? 'bg-emerald-900 text-amber-300 ring-emerald-900 hover:bg-emerald-800'
                              : 'bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {p.accountType === 'B2B' ? 'B2B' : 'B2C'}
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.properties} bien{p.properties > 1 ? 's' : ''}
                      {p.grants > 1 ? ` · ${p.grants} octrois` : ''}
                      {p.kinds?.includes('CREDIT') && (
                        <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                          🎁 geste commercial
                        </span>
                      )}
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
                    {p.status === 'INVITED' && (
                      <>
                        <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                          ✉️ Invitation envoyée
                        </span>
                        <div className="mt-1 text-xs text-sky-600">en attente d’inscription</div>
                      </>
                    )}
                    {p.status === 'PENDING_PROPERTY' && (
                      <>
                        <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
                          Compte créé
                        </span>
                        <div className="mt-1 text-xs text-violet-600">en attente du 1ᵉʳ bien</div>
                      </>
                    )}
                    {p.status === 'ACTIVE' && (
                      <>
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
                      </>
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
