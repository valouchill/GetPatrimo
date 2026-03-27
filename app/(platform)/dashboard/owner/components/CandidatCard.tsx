'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { ScorePill, Tag, GuaranteeBadge, Btn, Avatar, Bar } from './ui';
import type { LocalDossier, LocalBien, TagType } from './ui';

// ── Candidat card ─────────────────────────────────────────────────────────────

export function CandidatCard({ c, bien, onSelect, onDetail, compareMode, inCompare, onToggleCompare }: {
  c: LocalDossier; bien: LocalBien;
  onSelect: (c: LocalDossier) => void; onDetail: (c: LocalDossier) => void;
  compareMode: boolean; inCompare: boolean; onToggleCompare: (id: string) => void;
}) {
  if (c.isSealed) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-400">{c.sealedLabel || 'Candidat scellé'}</div>
            <div className="mt-1 text-xs text-slate-400">Déverrouillez pour voir le dossier</div>
          </div>
        </div>
      </div>
    );
  }

  const ratio = bien.loyer > 0 ? c.revenus / bien.loyer : 0;
  const ratioColor = ratio >= 3 ? 'text-emerald-600' : ratio >= 2 ? 'text-amber-600' : 'text-red-600';
  const auditPct = c.auditStatus === 'CLEAR' ? 100 : c.auditStatus === 'ALERT' ? 20 : 60;
  const auditColor = c.auditStatus === 'CLEAR' ? 'bg-emerald-500' : c.auditStatus === 'ALERT' ? 'bg-red-500' : 'bg-amber-500';
  const metrics: [string, number, string][] = [
    ['Solvabilité', Math.min((ratio / 3) * 100, 100), ratio >= 3 ? 'bg-emerald-500' : ratio >= 2 ? 'bg-amber-500' : 'bg-red-500'],
    ['Stabilité', c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 100 : c.contrat === 'CDD' ? 55 : 35,
      c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 'bg-emerald-500' : 'bg-amber-500'],
    ['Qualité', c.qualityScore ?? 50, (c.qualityScore ?? 0) >= 70 ? 'bg-emerald-500' : 'bg-amber-500'],
    ['Audit IA', auditPct, auditColor],
  ];
  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 bg-white p-5 transition-all ${
      inCompare ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
    }`}>
      {inCompare && <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />}
      <div className="mb-4 flex items-start gap-3">
        <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900">{c.prenom} {c.nom}</span>
            <ScorePill score={c.score} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{c.contrat}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag type={c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>{c.contrat}</Tag>
            <GuaranteeBadge mode={c.guaranteeMode} short />
            {c.contractReady && <Tag type="green">✓ Prêt à signer</Tag>}
            {c.isTop3 && c.guaranteeMode !== 'VISALE' && c.guaranteeMode !== 'PHYSICAL' ? (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                Recommandé ⚠
              </span>
            ) : c.isTop3 ? (
              <Tag type="green">Recommandé</Tag>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-emerald-700">{c.revenus.toLocaleString()} €</div>
          <div className="text-[10px] text-slate-400">nets/mois</div>
          <div className={`mt-1 text-xs font-bold ${ratioColor}`}>{ratio.toFixed(1)}× loyer</div>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {metrics.map(([label, val, color]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-[11px] font-semibold">
              <span className="text-slate-500">{label}</span>
              <span className="text-slate-700">{Math.round(val)}%</span>
            </div>
            <Bar value={val} color={color} />
          </div>
        ))}
      </div>
      {c.auditSummary && <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{c.auditSummary}</p>}
      <div className="flex gap-2">
        {compareMode ? (
          <button type="button" onClick={() => onToggleCompare(c.id)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
              inCompare ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
            {inCompare ? '✓ Sélectionné' : 'Ajouter'}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onDetail(c)} className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Voir le dossier
            </button>
            <button type="button" onClick={() => onSelect(c)} className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400">
              Sélectionner →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Compare view ──────────────────────────────────────────────────────────────

export function CompareView({ ids, candidats, bien, onSelect }: {
  ids: string[]; candidats: LocalDossier[]; bien: LocalBien; onSelect: (c: LocalDossier) => void;
}) {
  const cs = candidats.filter((c) => ids.includes(c.id));
  const rows: { label: string; fn: (c: LocalDossier) => React.ReactNode }[] = [
    { label: 'Score IA',      fn: (c) => <ScorePill score={c.score} /> },
    { label: 'Grade',         fn: (c) => <Tag type="indigo">Grade {c.grade}</Tag> },
    { label: 'Revenus',       fn: (c) => <b className="text-emerald-700">{c.revenus.toLocaleString()} €</b> },
    { label: 'Ratio',         fn: (c) => { const r = c.revenus / (bien.loyer || 1); return <span className={`font-bold ${r >= 3 ? 'text-emerald-600' : r >= 2 ? 'text-amber-600' : 'text-red-600'}`}>{r.toFixed(1)}×</span>; } },
    { label: 'Contrat',       fn: (c) => <Tag type={c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>{c.contrat}</Tag> },
    { label: 'Reste à vivre', fn: (c) => <span className="text-xs">{c.remainingIncomeLabel || '—'}</span> },
    { label: 'Effort locatif',fn: (c) => <span className="text-xs">{c.effortRateLabel || '—'}</span> },
    { label: 'Garantie',      fn: (c) => <GuaranteeBadge mode={c.guaranteeMode} /> },
    { label: 'Qualité',       fn: (c) => <span className={(c.qualityScore ?? 0) >= 70 ? 'font-semibold text-emerald-600' : 'text-amber-600'}>{c.qualityScore ?? '—'}/100</span> },
    { label: 'Audit IA',      fn: (c) => <Tag type={c.auditStatus === 'CLEAR' ? 'green' : c.auditStatus === 'ALERT' ? 'red' : 'amber'}>{c.auditStatus === 'CLEAR' ? 'Validé' : c.auditStatus === 'ALERT' ? 'Alerte' : 'En cours'}</Tag> },
    { label: 'Prêt à signer', fn: (c) => <span className={c.contractReady ? 'font-semibold text-emerald-600' : 'text-slate-400'}>{c.contractReady ? '✓ Oui' : '—'}</span> },
  ];
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[500px] border-collapse">
        <thead>
          <tr>
            <th className="w-36 bg-slate-50 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Critères</th>
            {cs.map((c) => (
              <th key={c.id} className="border-l border-slate-100 bg-emerald-50 px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} size="sm" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{c.prenom} {c.nom}</div>
                    <div className="text-xs text-slate-500">{c.contrat}</div>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, ri) => (
            <tr key={row.label} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-4 py-3 text-sm font-medium text-slate-600">{row.label}</td>
              {cs.map((c) => <td key={c.id} className="border-l border-slate-100 px-4 py-3 text-center text-sm">{row.fn(c)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-4 py-3" />
            {cs.map((c) => (
              <td key={c.id} className="border-l border-slate-100 px-3 py-3">
                <button type="button" onClick={() => onSelect(c)} className="w-full rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400">
                  Choisir {c.prenom} →
                </button>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
