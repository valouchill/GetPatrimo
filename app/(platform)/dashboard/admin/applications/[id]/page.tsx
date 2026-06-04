'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Document {
  id: string;
  category?: string;
  subjectType?: string;
  type?: string;
  fileName?: string;
  fileUrl?: string;
  status: string;
  uploadedAt?: string;
  aiAnalysis?: {
    documentType?: string;
    confidence?: number;
    flags?: string[];
    summary?: string;
    fraudScore?: number;
  };
}

interface FullDossier {
  application: any;
  property: any;
  candidate: any;
  guarantors: any[];
  auditTrail: any[];
}

const DOC_STATUSES = ['PENDING', 'ANALYZING', 'CERTIFIED', 'FLAGGED', 'REJECTED', 'ILLEGIBLE', 'NEEDS_REVIEW'];

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FullDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profil' | 'docs' | 'scoring' | 'garants' | 'didit' | 'audit'>('profil');
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/applications/${id}/full`);
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées (chargement au montage / sur changement ciblé)
  useEffect(() => { load();   }, [id]);

  async function accept() {
    if (!confirm('Accepter cette candidature ?\n(Le bien passera en LEASE_IN_PROGRESS)')) return;
    const res = await fetch(`/api/admin/applications/${id}/accept`, { method: 'POST' });
    if (res.ok) { setActionInfo('✓ Acceptée'); await load(); }
    else setActionInfo('❌ Erreur');
    setTimeout(() => setActionInfo(null), 3000);
  }
  async function reject() {
    const reason = prompt('Motif de refus ?') || '';
    const res = await fetch(`/api/admin/applications/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) { setActionInfo('✓ Refusée'); await load(); }
    else setActionInfo('❌ Erreur');
    setTimeout(() => setActionInfo(null), 3000);
  }

  if (loading || !data) return <div className="text-gray-500">Chargement…</div>;
  const app = data.application;
  const profile = app.profile || {};
  const score = app.patrimometer || {};

  return (
    <div>
      <Link href="/dashboard/admin/applications" className="text-sm text-indigo-600 hover:underline">← Candidatures</Link>
      <header className="my-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.firstName} {profile.lastName}</h1>
          <p className="text-sm text-gray-600">
            {data.candidate?.email && <span className="font-mono">{data.candidate.email}</span>}
            {' · Bien '}<span className="font-mono">{app.applyToken || '—'}</span>
            {data.property?.name && <> · {data.property.name}</>}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Statut : <span className={`font-semibold ${app.status === 'ACCEPTED' ? 'text-green-700' : app.status === 'REJECTED' ? 'text-red-700' : 'text-gray-700'}`}>{app.status}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {actionInfo && <span className={`text-sm ${actionInfo.startsWith('❌') ? 'text-red-600' : 'text-green-600'}`}>{actionInfo}</span>}
          <div className="flex gap-2">
            <button onClick={accept} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">✓ Accepter</button>
            <button onClick={reject} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700">✗ Refuser</button>
          </div>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-gray-200 mb-4">
        {(['profil','docs','scoring','garants','didit','audit'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 ${tab === t ? 'border-indigo-600 text-indigo-700 font-medium' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t === 'profil' ? 'Profil' : t === 'docs' ? `Documents (${app.documents?.length || 0})` :
             t === 'scoring' ? 'Scoring' : t === 'garants' ? 'Garants' :
             t === 'didit' ? 'KYC Didit' : 'Audit'}
          </button>
        ))}
      </nav>

      {tab === 'profil' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Profil candidat</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Prénom / Nom</dt><dd>{profile.firstName} {profile.lastName}</dd>
            <dt className="text-gray-500">Téléphone</dt><dd>{profile.phone || '—'}</dd>
            <dt className="text-gray-500">Date de naissance</dt><dd>{profile.birthDate || '—'}</dd>
            <dt className="text-gray-500">Statut</dt><dd>{profile.status || '—'}</dd>
            <dt className="text-gray-500">Email candidature</dt><dd className="font-mono">{app.userEmail || '—'}</dd>
            <dt className="text-gray-500">Revenu mensuel</dt><dd>{app.financialSummary?.totalMonthlyIncome ?? '—'} €</dd>
            <dt className="text-gray-500">Source revenus</dt><dd>{app.financialSummary?.incomeSource || '—'}</dd>
            <dt className="text-gray-500">Revenus certifiés</dt><dd>{app.financialSummary?.certifiedIncome ? 'Oui' : 'Non'}</dd>
            <dt className="text-gray-500">Passport slug</dt><dd className="font-mono">{app.passportSlug || '—'}</dd>
            <dt className="text-gray-500">Vues passport</dt><dd>{app.passportViewCount ?? 0}</dd>
          </dl>
        </section>
      )}

      {tab === 'docs' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Documents ({app.documents?.length || 0})</h2>
          {(!app.documents || app.documents.length === 0) ? (
            <div className="text-sm text-gray-500">Aucun document déposé.</div>
          ) : (
            <div className="space-y-2">
              {app.documents.map((doc: Document) => (
                <DocumentRow key={doc.id} doc={doc} applicationId={id} onRefresh={load} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'scoring' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Indice de Résilience</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-bold">{score.score ?? '—'}</div>
            <div>
              <div className="text-2xl font-semibold">{score.grade || '—'}</div>
              <div className="text-xs text-gray-500">{score.lastCalculatedAt ? `Calculé le ${new Date(score.lastCalculatedAt).toLocaleString('fr-FR')}` : 'Jamais calculé'}</div>
            </div>
          </div>
          {score.warnings && score.warnings.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-amber-900 mb-1">⚠️ Warnings</div>
              <ul className="text-xs text-amber-800 list-disc pl-5">
                {score.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
          {score.breakdown && (
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-1">Breakdown</div>
              <pre className="text-xs bg-gray-50 p-2 rounded font-mono overflow-x-auto">{JSON.stringify(score.breakdown, null, 2)}</pre>
            </div>
          )}
        </section>
      )}

      {tab === 'garants' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Garants</h2>
          <div className="text-sm mb-3">
            <strong>Has guarantor :</strong> {app.guarantor?.hasGuarantor ? 'Oui' : 'Non'} ·{' '}
            <strong>Statut :</strong> {app.guarantor?.status || '—'}
          </div>
          {app.guarantee && (
            <div className="text-sm mb-3">
              <strong>Garantie :</strong> {app.guarantee.type} · {app.guarantee.provider} · Visale : <span className="font-mono">{app.guarantee.visaleNumber || '—'}</span>
            </div>
          )}
          {data.guarantors.length > 0 ? (
            <ul className="text-sm divide-y divide-gray-100">
              {data.guarantors.map((g) => (
                <li key={g._id} className="py-2">
                  <div className="font-medium">{g.firstName} {g.lastName}</div>
                  <div className="text-xs text-gray-500 font-mono">{g.email}</div>
                  <div className="text-xs">Statut : {g.status || '—'} · Didit : {g.diditSessionId || '—'}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-500">Aucun garant lié.</div>
          )}
        </section>
      )}

      {tab === 'didit' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Vérification Didit</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Statut</dt><dd>{app.didit?.status || '—'}</dd>
            <dt className="text-gray-500">Session ID</dt><dd className="font-mono">{app.didit?.sessionId || '—'}</dd>
            <dt className="text-gray-500">Vérifié le</dt><dd>{app.didit?.verifiedAt ? new Date(app.didit.verifiedAt).toLocaleString('fr-FR') : '—'}</dd>
          </dl>
          {app.didit?.identityData && (
            <pre className="text-xs bg-gray-50 p-2 rounded font-mono overflow-x-auto mt-3">{JSON.stringify(app.didit.identityData, null, 2)}</pre>
          )}
        </section>
      )}

      {tab === 'audit' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-3">Historique admin ({data.auditTrail.length})</h2>
          {data.auditTrail.length === 0 ? (
            <div className="text-sm text-gray-500">Aucune action admin enregistrée.</div>
          ) : (
            <ul className="text-sm divide-y divide-gray-100">
              {data.auditTrail.map((e) => (
                <li key={e._id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded mr-2">{e.action}</span>
                    <span className="text-gray-500">{e.actorEmail}</span>
                  </div>
                  <span className="text-gray-400">{new Date(e.createdAt).toLocaleString('fr-FR')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function DocumentRow({ doc, applicationId, onRefresh }: { doc: Document; applicationId: string; onRefresh: () => void }) {
  const [status, setStatus] = useState(doc.status);
  const [busy, setBusy] = useState(false);
  const fraudScore = doc.aiAnalysis?.fraudScore;
  const fraudClass =
    fraudScore == null ? 'bg-gray-100 text-gray-600' :
    fraudScore > 0.7 ? 'bg-red-100 text-red-700' :
    fraudScore > 0.4 ? 'bg-amber-100 text-amber-700' :
    'bg-green-100 text-green-700';

  async function updateStatus(newStatus: string) {
    if (newStatus === status) return;
    const reason = (newStatus === 'FLAGGED' || newStatus === 'REJECTED') ? (prompt('Raison ?') || '') : '';
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/applications/${applicationId}/documents/${doc.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, flaggedReason: reason }),
      });
      if (res.ok) {
        setStatus(newStatus);
        onRefresh();
      } else {
        alert('Erreur');
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-start gap-3 p-3 border border-gray-200 rounded">
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{doc.type || doc.category || 'Document'}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100">{doc.subjectType || 'TENANT'}</span>
          {fraudScore != null && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${fraudClass}`}>fraude {(fraudScore * 100).toFixed(0)}%</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{doc.fileName || '—'}</div>
        {doc.aiAnalysis?.flags && doc.aiAnalysis.flags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {doc.aiAnalysis.flags.map((f, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">{f}</span>
            ))}
          </div>
        )}
        {doc.aiAnalysis?.summary && (
          <div className="text-xs text-gray-600 mt-1">{doc.aiAnalysis.summary}</div>
        )}
      </div>
      <div className="flex flex-col gap-1 items-end">
        <a href={`/api/admin/applications/${applicationId}/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer"
          className="text-xs text-indigo-600 hover:underline">📥 Télécharger</a>
        <select value={status} onChange={(e) => updateStatus(e.target.value)} disabled={busy}
          className="text-xs border border-gray-300 rounded px-1 py-0.5">
          {DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
