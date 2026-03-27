'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import {
  ScorePill,
  Tag,
  GuaranteeBadge,
  Btn,
  Bar,
  Avatar,
} from './ui';
import type { TagType, LocalDossier, LocalBien } from './ui';

// ── Stage labels (local copy) ─────────────────────────────────────────────────

const STAGE_FR: Record<string, string> = {
  search:     'Recherche',
  analysis:   'Analyse',
  selection:  'Sélection',
  contract:   'Contrat',
  management: 'Gestion',
};

// ── StagePill ─────────────────────────────────────────────────────────────────

export function StagePill({ stage, stageLabel }: { stage?: string; stageLabel?: string }) {
  const label = stageLabel || STAGE_FR[stage || ''] || stage || 'Inconnu';
  const type: TagType = stage === 'management' ? 'green' : stage === 'contract' ? 'indigo' : stage === 'selection' ? 'amber' : 'slate';
  return <Tag type={type}>{label}</Tag>;
}

// ── CandidateDetailDrawer ─────────────────────────────────────────────────────

export function CandidateDetailDrawer({ c, bien, onClose, onSelect }: {
  c: LocalDossier; bien: LocalBien; onClose: () => void; onSelect: (c: LocalDossier) => void;
}) {
  const ratio = bien.loyer > 0 ? c.revenus / bien.loyer : 0;
  const ratioColor = ratio >= 3 ? 'text-emerald-600' : ratio >= 2 ? 'text-amber-600' : 'text-red-600';

  const pillars = c.pillars || [
    { id: 'identity', label: 'Identité', score: c.score >= 70 ? 36 : c.score >= 45 ? 28 : 16, max: 40, status: c.auditStatus === 'CLEAR' ? 'verified' : 'review', summary: '' },
    { id: 'income', label: 'Revenus', score: Math.min(Math.round((ratio / 3) * 20), 20), max: 20, status: ratio >= 3 ? 'strong' : 'weak', summary: '' },
    { id: 'activity', label: 'Activité', score: c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 10 : 5, max: 10, status: 'ok', summary: '' },
    { id: 'receipts', label: 'Quittances', score: 0, max: 5, status: 'neutral', summary: '' },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-[201] flex h-screen flex-col bg-white shadow-2xl"
        style={{ width: 'min(520px, 90vw)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-drawer-title"
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} />
            <div>
              <div id="candidate-drawer-title" className="font-bold text-slate-950">{c.prenom} {c.nom}</div>
              <div className="mt-0.5 text-xs text-slate-500">{c.contrat} · {bien.label}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ScorePill score={c.score} />
            <button type="button" onClick={onClose} aria-label="Fermer le panneau candidat" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Guarantee section */}
          <div className={`mb-5 rounded-2xl border px-4 py-3 ${
            c.guaranteeMode === 'NONE' || !c.guaranteeMode
              ? 'border-orange-200 bg-orange-50'
              : 'border-emerald-200 bg-emerald-50'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Garantie</span>
              <GuaranteeBadge mode={c.guaranteeMode} />
            </div>
            {(!c.guaranteeMode || c.guaranteeMode === 'NONE') && (
              <p className="mt-2 text-xs text-orange-700">
                Ce candidat n'a pas de garant. Il est recommandé de privilégier les profils couverts par Visale ou un garant physique.
              </p>
            )}
          </div>

          {/* Decision headline */}
          {c.decisionHeadline && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{c.decisionHeadline}</p>
            </div>
          )}

          {/* PatrimoScore breakdown */}
          <div className="mb-5">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">PatrimoScore™ — {c.score}/100</div>
            <div className="space-y-3">
              {pillars.map((p) => {
                const pct = p.max > 0 ? (p.score / p.max) * 100 : 0;
                const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
                return (
                  <div key={p.id}>
                    <div className="mb-1 flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">{p.label}</span>
                      <span className="text-slate-700">{p.score}/{p.max}</span>
                    </div>
                    <Bar value={pct} color={barColor} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial summary */}
          <div className="mb-5">
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Synthèse financière</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Revenus', `${c.revenus.toLocaleString()} €`, 'text-emerald-700'],
                ['Ratio loyer', `${ratio.toFixed(1)}×`, ratioColor],
                ['Reste à vivre', c.remainingIncomeLabel || '—', 'text-slate-700'],
                ['Effort locatif', c.effortRateLabel || '—', 'text-slate-700'],
              ].map(([label, val, color]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className={`text-base font-bold ${color}`}>{val}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Key info rows */}
          <div className="mb-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {([
              ['Contrat', c.contrat],
              ['Grade', `Grade ${c.grade}`],
              ['Qualité dossier', c.qualityScore ? `${c.qualityScore}/100` : '—'],
              ['Audit IA', c.auditStatus === 'CLEAR' ? '✓ Validé' : c.auditStatus === 'ALERT' ? '⚠ Alerte' : 'En revue'],
              ['Prêt à signer', c.contractReady ? '✓ Oui' : 'Non'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold text-slate-900">{v}</span>
              </div>
            ))}
          </div>

          {/* Strengths & watchouts */}
          {c.strengths && c.strengths.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-600">Points forts</div>
              <ul className="space-y-1">
                {c.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.watchouts && c.watchouts.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-600">Points d'attention</div>
              <ul className="space-y-1">
                {c.watchouts.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Audit summary */}
          {c.auditSummary && (
            <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-xs italic leading-5 text-slate-600">{c.auditSummary}</div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-6 py-4">
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={onClose} className="flex-1">Fermer</Btn>
            <Btn variant="amber" onClick={() => { onSelect(c); onClose(); }} className="flex-[2]">
              Sélectionner {c.prenom} →
            </Btn>
          </div>
        </div>
      </motion.div>
    </>
  );
}
