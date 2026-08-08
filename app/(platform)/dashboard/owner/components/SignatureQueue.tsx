'use client';

/**
 * <SignatureQueue> — suivi en direct de la campagne de signature d'un bail
 * (affiché sous la carte du bail dans BauxPanel).
 *
 * Le bailleur voit ENFIN qui bloque : file des signataires avec statut
 * (invité → a consulté → a signé), alerte si l'email d'invitation a échoué,
 * bouton « Renvoyer le lien » (régénère un token frais, ressuscite un lien
 * expiré), et téléchargement du bail signé une fois la campagne complète.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Download, Eye, Loader2, Mail, RefreshCw } from 'lucide-react';

interface SignerRow {
  _id: string;
  role: 'OWNER' | 'TENANT' | 'COTENANT' | 'GUARANTOR';
  fullName?: string;
  email: string;
  status: 'PENDING' | 'VIEWED' | 'SIGNED' | 'DECLINED' | 'EXPIRED';
  signedAt?: string | null;
  viewedAt?: string | null;
  inviteSentAt?: string | null;
  inviteError?: string;
  remindersSentAt?: string[];
}

const ROLE_LABEL: Record<SignerRow['role'], string> = {
  OWNER: 'Bailleur',
  TENANT: 'Locataire',
  COTENANT: 'Colocataire',
  GUARANTOR: 'Garant',
};

function daysAgo(iso?: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  return `il y a ${days} j`;
}

export function SignatureQueue({ leaseId }: { leaseId: string }) {
  const [signers, setSigners] = useState<SignerRow[] | null>(null);
  const [signedPdfPath, setSignedPdfPath] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leases/${leaseId}/signature`);
      if (!res.ok) return;
      const data = await res.json();
      setSigners(data.signatures || []);
      setSignedPdfPath(data.signedPdfPath || null);
    } catch { /* silent */ }
  }, [leaseId]);

  useEffect(() => { load(); }, [load]);

  async function resend() {
    setResending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/leases/${leaseId}/signature/remind`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Renvoi impossible.');
      setFeedback(`Lien renvoyé à ${data.sentTo}`);
      await load();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setResending(false);
    }
  }

  if (!signers) return null;

  // Campagne complète → un seul CTA : télécharger le document final.
  if (signedPdfPath) {
    return (
      <a
        href={`/api/leases/${leaseId}/signature/document`}
        className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        Télécharger le bail signé (PDF + certificat)
      </a>
    );
  }

  if (signers.length === 0) return null;

  const current = signers.find((s) => s.status !== 'SIGNED' && s.status !== 'DECLINED');

  return (
    <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <ul className="space-y-1.5">
        {signers.map((s) => (
          <li key={s._id} className="flex items-center gap-2 text-xs">
            {s.status === 'SIGNED' ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : s.status === 'VIEWED' ? (
              <Eye className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            ) : (
              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )}
            <span className="min-w-0 flex-1 truncate">
              <strong className="text-slate-800">{s.fullName || s.email}</strong>
              <span className="text-slate-400"> · {ROLE_LABEL[s.role]}</span>
            </span>
            <span className={
              s.status === 'SIGNED' ? 'text-emerald-600 font-medium' :
              s.status === 'VIEWED' ? 'text-amber-600' :
              s.status === 'EXPIRED' ? 'text-red-500' : 'text-slate-500'
            }>
              {s.status === 'SIGNED' ? `Signé ${daysAgo(s.signedAt)}` :
               s.status === 'VIEWED' ? `A consulté ${daysAgo(s.viewedAt)}` :
               s.status === 'EXPIRED' ? 'Lien expiré' :
               s.inviteError ? 'Email non délivré' :
               s.inviteSentAt ? `Invité ${daysAgo(s.inviteSentAt)}` : 'En file'}
            </span>
          </li>
        ))}
      </ul>

      {current?.inviteError && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 ring-1 ring-red-200">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          L&apos;email n&apos;a pas pu être envoyé à {current.email} — vérifiez l&apos;adresse puis renvoyez.
        </p>
      )}

      {current && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Renvoyer le lien à {current.fullName?.split(' ')[0] || ROLE_LABEL[current.role].toLowerCase()}
          </button>
          {feedback && <span className="text-[11px] text-slate-500">{feedback}</span>}
        </div>
      )}
    </div>
  );
}
