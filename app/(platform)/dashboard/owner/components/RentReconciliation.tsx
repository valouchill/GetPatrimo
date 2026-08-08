'use client';

/**
 * <RentReconciliation> — rapprochement bancaire assisté (module Loyers).
 *
 * Le bailleur dépose le relevé exporté de sa banque (CSV/OFX) ; le moteur
 * propose « ce virement = loyer de mars de M. Dupont » avec un indice de
 * confiance ; un clic confirme → la quittance est générée ET envoyée au
 * locataire automatiquement.
 *
 * Aucune donnée bancaire n'est conservée : le relevé est analysé en mémoire
 * côté serveur, seules les confirmations sont écrites.
 */

import { useRef, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react';

interface Proposal {
  paymentId: string;
  period: string;
  tenantName: string;
  expectedAmount: number;
  transaction: { date: string; amount: number; label: string };
  score: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
}

const CONFIDENCE_STYLE: Record<string, { cls: string; label: string }> = {
  HIGH: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Correspondance sûre' },
  MEDIUM: { cls: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'À vérifier' },
  LOW: { cls: 'bg-slate-100 text-slate-600 ring-slate-200', label: 'Incertain' },
};

export function RentReconciliation({ onDone }: { onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [stats, setStats] = useState<{ parsedCount: number; unmatchedCount: number; pendingCount: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmedCount, setConfirmedCount] = useState(0);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setProposals(null);
    setConfirmedCount(0);
    try {
      const text = await file.text();
      const res = await fetch('/api/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statement: text, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Analyse impossible');
      setProposals(data.proposals || []);
      setStats({
        parsedCount: data.parsedCount || 0,
        unmatchedCount: data.unmatchedCount || 0,
        pendingCount: data.pendingCount || 0,
      });
      // Les correspondances sûres sont pré-cochées (gain de temps).
      setSelected(new Set((data.proposals || []).filter((p: Proposal) => p.confidence === 'HIGH').map((p: Proposal) => p.paymentId)));
      if (!data.proposals?.length && data.hint) setError(data.hint);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!proposals || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const confirm = proposals
        .filter((p) => selected.has(p.paymentId))
        .map((p) => ({
          paymentId: p.paymentId,
          amount: p.transaction.amount,
          label: p.transaction.label,
          date: p.transaction.date,
        }));
      const res = await fetch('/api/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Confirmation impossible');
      setConfirmedCount(data.confirmed || 0);
      setProposals(null);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-amber-400">
          <BadgeCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-semibold text-emerald-950">
            Vérifier les loyers reçus
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">
            Déposez le relevé exporté de votre banque (CSV ou OFX) : on retrouve les virements
            de vos locataires, et la quittance part automatiquement.
          </p>
        </div>
      </div>

      {confirmedCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          {confirmedCount} loyer{confirmedCount > 1 ? 's' : ''} confirmé{confirmedCount > 1 ? 's' : ''} —
          quittance{confirmedCount > 1 ? 's' : ''} envoyée{confirmedCount > 1 ? 's' : ''} au{confirmedCount > 1 ? 'x' : ''} locataire{confirmedCount > 1 ? 's' : ''}.
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          {error}
        </p>
      )}

      {!proposals && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.ofx,.qfx,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-emerald-700" />}
            {busy ? 'Analyse du relevé…' : 'Déposer mon relevé bancaire'}
          </button>
          <p className="mt-2 text-[11px] text-slate-500">
            Aucune connexion à votre banque, aucune donnée bancaire conservée : le fichier est
            analysé puis oublié. Seules vos confirmations sont enregistrées.
          </p>
        </>
      )}

      {proposals && (
        <div className="mt-4">
          {stats && (
            <p className="text-xs text-slate-500">
              {stats.parsedCount} encaissement{stats.parsedCount > 1 ? 's' : ''} lu
              {stats.parsedCount > 1 ? 's' : ''} · {proposals.length} rapprochement
              {proposals.length > 1 ? 's' : ''} proposé{proposals.length > 1 ? 's' : ''} sur{' '}
              {stats.pendingCount} loyer{stats.pendingCount > 1 ? 's' : ''} en attente
            </p>
          )}

          {proposals.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Aucun virement ne correspond à un loyer en attente. Vérifiez la période du relevé,
              ou confirmez le paiement à la main depuis le tableau des loyers.
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {proposals.map((p) => {
                  const style = CONFIDENCE_STYLE[p.confidence];
                  const checked = selected.has(p.paymentId);
                  return (
                    <li key={p.paymentId}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                          checked ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(p.paymentId)}
                          className="mt-1 h-4 w-4 accent-emerald-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <strong className="text-sm text-slate-900">{p.tenantName || 'Locataire'}</strong>
                            <span className="text-xs text-slate-500">· {p.period}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${style.cls}`}>
                              {style.label}
                            </span>
                          </span>
                          <span className="mt-1 block truncate font-mono text-[11px] text-slate-500">
                            {new Date(p.transaction.date).toLocaleDateString('fr-FR')} ·{' '}
                            {p.transaction.amount.toLocaleString('fr-FR')} € · {p.transaction.label}
                          </span>
                          <span className="mt-1 block text-[11px] text-emerald-700">
                            <Sparkles className="mr-1 inline h-3 w-3" />
                            {p.reasons.join(' · ')}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={busy || selected.size === 0}
                  className="flex-1 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? 'Confirmation…' : `Confirmer ${selected.size} loyer${selected.size > 1 ? 's' : ''} + envoyer la quittance`}
                </button>
                <button
                  type="button"
                  onClick={() => { setProposals(null); setError(null); }}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
                >
                  Annuler
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
