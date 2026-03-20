'use client';

import { Fragment, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Crown,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  LayoutDashboard,
  Lock,
  PenLine,
  Plus,
  ScrollText,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useOwner } from './OwnerContext';
import type { Candidature as RealCandidature, PropertyWithCandidatures } from './OwnerContext';

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  'from-emerald-500 to-teal-600',
  'from-teal-500 to-cyan-600',
  'from-cyan-500 to-blue-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-emerald-600',
  'from-slate-500 to-slate-700',
];
const palette = (id: string | number) => {
  const n = typeof id === 'string'
    ? id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    : id;
  return AVATAR_PALETTE[Math.abs(n) % AVATAR_PALETTE.length];
};

function Avatar({ name, id = 0, size = 'md' }: { name: string; id?: string | number; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const ini = (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const cls = {
    xs: 'h-7 w-7 rounded-lg text-[10px]',
    sm: 'h-9 w-9 rounded-xl text-xs',
    md: 'h-11 w-11 rounded-xl text-sm',
    lg: 'h-14 w-14 rounded-2xl text-base',
  }[size];
  return (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white ${cls} bg-gradient-to-br ${palette(id)}`}>
      {ini}
    </div>
  );
}

// ── Score pill ────────────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const cls = score >= 70
    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : score >= 45
    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
    : 'bg-red-50 text-red-700 ring-1 ring-red-200';
  const dot = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {score}/100
    </span>
  );
}

// ── Tag ───────────────────────────────────────────────────────────────────────

type TagType = 'slate' | 'green' | 'amber' | 'red' | 'indigo' | 'violet';
const TAG_CLS: Record<TagType, string> = {
  slate:  'bg-slate-100 text-slate-700',
  green:  'bg-emerald-50 text-emerald-700',
  amber:  'bg-amber-50 text-amber-700',
  red:    'bg-red-50 text-red-700',
  indigo: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-teal-50 text-teal-700',
};
function Tag({ children, type = 'slate' }: { children: React.ReactNode; type?: TagType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_CLS[type] || TAG_CLS.slate}`}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'amber';
const BTN_CLS: Record<BtnVariant, string> = {
  primary:   'bg-slate-950 text-white hover:bg-slate-800',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  ghost:     'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  success:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  danger:    'bg-red-50 text-red-700 border border-red-200',
  amber:     'bg-amber-500 text-slate-950 hover:bg-amber-400',
};
function Btn({
  children, variant = 'primary', onClick, disabled, className = '',
}: { children: React.ReactNode; variant?: BtnVariant; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${BTN_CLS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, bg = 'bg-emerald-50' }: { icon: string; value: string | number; label: string; bg?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg ${bg}`}>{icon}</div>
      <div className="text-[1.75rem] font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function Bar({ value, color = 'bg-emerald-500' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ── Tunnel step bar ───────────────────────────────────────────────────────────

function StepBar({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => (
        <Fragment key={label}>
          <div className="flex flex-col items-center gap-1.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              i < step ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/30'
              : i === step ? 'border-2 border-emerald-500 bg-white text-emerald-600 ring-4 ring-emerald-50'
              : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-[10px] font-semibold whitespace-nowrap ${
              i === step ? 'text-slate-900' : i < step ? 'text-emerald-700' : 'text-slate-400'
            }`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mb-5 mx-2 h-px flex-1 rounded-full transition-colors ${i < step ? 'bg-emerald-300' : 'bg-slate-200'}`} />
          )}
        </Fragment>
      ))}
    </div>
  );
}

// ── Types & mapping ───────────────────────────────────────────────────────────

type LocalBien = {
  id: string;
  label: string;
  adresse: string;
  loyer: number;
  surface: number;
  applyToken?: string;
  isRented?: boolean;
  flowStage?: string;
  flowProgress?: number;
  totalCandidates?: number;
  tenantLabel?: string;
  leaseStatusLabel?: string;
  nextMilestone?: string;
};

type LocalDossier = {
  id: string;
  prenom: string;
  nom: string;
  bien_id: string;
  loyer: number;
  revenus: number;
  contrat: string;
  score: number;
  grade: string;
  statut: 'en_attente' | 'selectionne' | 'refuse';
  isSealed: boolean;
  sealedLabel?: string;
  garantie?: string;
  auditStatus?: string;
  auditSummary?: string;
  effortRateLabel?: string;
  remainingIncomeLabel?: string;
  qualityScore?: number;
  contractReady?: boolean;
  submittedAt?: string;
};

function toBien(e: PropertyWithCandidatures): LocalBien {
  const p = e.property;
  const ms = e.flow?.managementSummary;
  return {
    id: p.id,
    label: p.title || p.address?.split(',')[0]?.trim() || 'Bien',
    adresse: p.address || '',
    loyer: p.rent || 0,
    surface: p.surfaceM2 || 0,
    applyToken: p.applyToken,
    isRented: p.isRented,
    flowStage: e.flow?.stage,
    flowProgress: e.flow?.progress,
    totalCandidates: e.flow?.totalCandidates || e.candidatures.length,
    tenantLabel: ms?.tenantLabel,
    leaseStatusLabel: ms?.leaseStatusLabel,
    nextMilestone: ms?.nextMilestone,
  };
}

function toDossier(c: RealCandidature, bienId: string, loyer: number): LocalDossier {
  const ins = c.ownerInsights;
  return {
    id: c.id,
    prenom: c.profile.firstName,
    nom: c.profile.lastName,
    bien_id: bienId,
    loyer,
    revenus: ins?.financial?.monthlyIncome || c.financialSummary?.monthlyNetIncome || 0,
    contrat: c.financialSummary?.contractType || 'N/A',
    score: c.patrimometer.score,
    grade: c.patrimometer.grade,
    statut: c.isOwnerSelected ? 'selectionne' : 'en_attente',
    isSealed: c.isSealed,
    sealedLabel: c.sealedLabel,
    garantie: ins?.guarantee?.label,
    auditStatus: ins?.aiAudit?.status,
    auditSummary: ins?.aiAudit?.summary,
    effortRateLabel: ins?.financial?.effortRateLabel ?? undefined,
    remainingIncomeLabel: ins?.financial?.remainingIncomeLabel ?? undefined,
    qualityScore: ins?.quality?.score,
    contractReady: ins?.contractReadiness?.ready,
    submittedAt: c.submittedAt,
  };
}

// ── Candidat card (tunnel sélection) ─────────────────────────────────────────

function CandidatCard({
  c, bien, onSelect, onDetail, compareMode, inCompare, onToggleCompare,
}: {
  c: LocalDossier;
  bien: LocalBien;
  onSelect: (c: LocalDossier) => void;
  onDetail: (c: LocalDossier) => void;
  compareMode: boolean;
  inCompare: boolean;
  onToggleCompare: (id: string) => void;
}) {
  const ratio = bien.loyer > 0 ? c.revenus / bien.loyer : 0;
  const ratioColor = ratio >= 3 ? 'text-emerald-600' : ratio >= 2 ? 'text-amber-600' : 'text-red-600';
  const auditPct = c.auditStatus === 'CLEAR' ? 100 : c.auditStatus === 'ALERT' ? 20 : 60;
  const auditColor = c.auditStatus === 'CLEAR' ? 'bg-emerald-500' : c.auditStatus === 'ALERT' ? 'bg-red-500' : 'bg-amber-500';
  const metrics: [string, number, string][] = [
    ['Solvabilité', Math.min((ratio / 3) * 100, 100), ratio >= 3 ? 'bg-emerald-500' : ratio >= 2 ? 'bg-amber-500' : 'bg-red-500'],
    ['Stabilité pro', c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 100 : c.contrat === 'CDD' ? 55 : 35,
      c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 'bg-emerald-500' : 'bg-amber-500'],
    ['Qualité dossier', c.qualityScore ?? 50, (c.qualityScore ?? 0) >= 70 ? 'bg-emerald-500' : 'bg-amber-500'],
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
            {c.grade && <Tag type="indigo">Grade {c.grade}</Tag>}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{c.contrat}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag type={c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>{c.contrat}</Tag>
            {c.garantie && c.garantie !== 'Aucune garantie' && <Tag type="indigo">{c.garantie}</Tag>}
            {c.contractReady && <Tag type="green">Prêt à contracter</Tag>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold text-emerald-700">{c.revenus.toLocaleString()} €</div>
          <div className="text-[10px] text-slate-400">nets/mois</div>
          <div className={`mt-1 text-xs font-bold ${ratioColor}`}>Ratio {ratio.toFixed(1)}x</div>
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
      {c.auditSummary && (
        <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{c.auditSummary}</p>
      )}
      <div className="flex gap-2">
        {compareMode ? (
          <button
            type="button"
            onClick={() => onToggleCompare(c.id)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
              inCompare ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {inCompare ? '✓ Sélectionné' : 'Ajouter à la comparaison'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onDetail(c)}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voir le dossier
            </button>
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
            >
              Sélectionner →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Compare view ──────────────────────────────────────────────────────────────

function CompareView({ ids, candidats, bien, onSelect }: {
  ids: string[];
  candidats: LocalDossier[];
  bien: LocalBien;
  onSelect: (c: LocalDossier) => void;
}) {
  const cs = candidats.filter((c) => ids.includes(c.id));
  const rows: { label: string; fn: (c: LocalDossier) => React.ReactNode }[] = [
    { label: 'Score IA',      fn: (c) => <ScorePill score={c.score} /> },
    { label: 'Grade',         fn: (c) => <Tag type="indigo">Grade {c.grade}</Tag> },
    { label: 'Revenus',       fn: (c) => <b className="text-emerald-700">{c.revenus.toLocaleString()} €</b> },
    { label: 'Ratio loyer',   fn: (c) => { const r = c.revenus / (bien.loyer || 1); return <span className={`font-bold ${r >= 3 ? 'text-emerald-600' : r >= 2 ? 'text-amber-600' : 'text-red-600'}`}>{r.toFixed(1)}x</span>; } },
    { label: 'Contrat',       fn: (c) => <Tag type={c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>{c.contrat}</Tag> },
    { label: 'Reste à vivre', fn: (c) => <span className="text-xs">{c.remainingIncomeLabel || '—'}</span> },
    { label: 'Garantie',      fn: (c) => <span className={c.garantie && c.garantie !== 'Aucune garantie' ? 'font-semibold text-emerald-600' : 'text-slate-400'}>{c.garantie || '—'}</span> },
    { label: 'Qualité',       fn: (c) => <span className={(c.qualityScore ?? 0) >= 70 ? 'font-semibold text-emerald-600' : 'text-amber-600'}>{c.qualityScore ?? '—'}/100</span> },
    { label: 'Audit IA',      fn: (c) => <Tag type={c.auditStatus === 'CLEAR' ? 'green' : c.auditStatus === 'ALERT' ? 'red' : 'amber'}>{c.auditStatus || '—'}</Tag> },
    { label: 'Prêt à signer', fn: (c) => <span className={c.contractReady ? 'font-semibold text-emerald-600' : 'text-slate-400'}>{c.contractReady ? '✓ Oui' : '✗ Non'}</span> },
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
              {cs.map((c) => (
                <td key={c.id} className="border-l border-slate-100 px-4 py-3 text-center text-sm">{row.fn(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-4 py-3" />
            {cs.map((c) => (
              <td key={c.id} className="border-l border-slate-100 px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="w-full rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400"
                >
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

// ── Tunnel sélection (modal) ──────────────────────────────────────────────────

const SEL_STEPS = ['Dossiers', 'Comparaison', 'Confirmation', 'Succès'];

function TunnelSelection({ bien, candidats, onClose, onDone }: {
  bien: LocalBien;
  candidats: LocalDossier[];
  onClose: () => void;
  onDone: (c: LocalDossier) => void;
}) {
  const [step, setStep] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<LocalDossier | null>(null);
  const [detail, setDetail] = useState<LocalDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cands = [...candidats].sort((a, b) => b.score - a.score);

  const toggleCompare = (id: string) =>
    setCompareIds((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p);

  const handleSelect = (c: LocalDossier) => { setSelected(c); setStep(2); setCompareMode(false); };

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/properties/${bien.id}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: selected.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Erreur lors de la sélection.');
        return;
      }
      setStep(3);
      onDone(selected);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/50 backdrop-blur-sm">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4 px-6 py-4">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <X className="h-4 w-4" /> Fermer
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-slate-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">🏠 {bien.label}</span>
            <span className="text-sm text-slate-500">{bien.adresse}</span>
            <Tag type="slate">{bien.loyer} €/mois</Tag>
          </div>
          <div className="ml-auto w-80">
            <StepBar step={step} steps={SEL_STEPS} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-5xl">

          {/* Step 0 — liste */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">{cands.length} candidature{cands.length !== 1 ? 's' : ''} · {bien.label}</h2>
                  <p className="mt-1 text-sm text-slate-500">Analysées et scorées par IA · Triées par score</p>
                </div>
                <div className="flex gap-2">
                  {compareMode ? (
                    <>
                      <Btn variant="secondary" onClick={() => { setCompareMode(false); setCompareIds([]); }}>Annuler</Btn>
                      <Btn variant="amber" disabled={compareIds.length < 2} onClick={() => setStep(1)}>Comparer ({compareIds.length}) →</Btn>
                    </>
                  ) : (
                    <Btn variant="ghost" onClick={() => setCompareMode(true)}>Comparer des dossiers</Btn>
                  )}
                </div>
              </div>
              {compareMode && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Sélectionnez 2 ou 3 candidats à comparer. {compareIds.length}/3 sélectionnés.
                </div>
              )}
              {cands.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                  <div className="mb-3 text-4xl">📭</div>
                  <p className="text-slate-500">Aucune candidature pour ce bien.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {cands.map((c) => (
                    <CandidatCard key={c.id} c={c} bien={bien} onSelect={handleSelect} onDetail={setDetail} compareMode={compareMode} inCompare={compareIds.includes(c.id)} onToggleCompare={toggleCompare} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 1 — comparaison */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">Comparaison côte à côte</h2>
                  <p className="mt-1 text-sm text-slate-500">Analysez les critères clés</p>
                </div>
                <Btn variant="secondary" onClick={() => setStep(0)}>← Retour à la liste</Btn>
              </div>
              <CompareView ids={compareIds} candidats={cands} bien={bien} onSelect={handleSelect} />
            </motion.div>
          )}

          {/* Step 2 — confirmation */}
          {step === 2 && selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg">
              <div className="mb-8 text-center">
                <div className="mb-3 text-5xl">🏆</div>
                <h2 className="font-serif text-2xl font-bold text-slate-950">Votre locataire sélectionné</h2>
                <p className="mt-2 text-sm text-slate-500">Confirmez pour enregistrer la sélection</p>
              </div>
              <div className="mb-4 rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-lg shadow-emerald-500/10">
                <div className="mb-5 flex items-center gap-4">
                  <Avatar name={`${selected.prenom} ${selected.nom}`} id={selected.id} size="lg" />
                  <div>
                    <div className="text-lg font-bold text-slate-950">{selected.prenom} {selected.nom}</div>
                    <div className="text-sm text-slate-500">{selected.contrat}</div>
                    <div className="mt-2 flex gap-2">
                      <ScorePill score={selected.score} />
                      <Tag type={selected.contrat === 'CDI' || selected.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>{selected.contrat}</Tag>
                    </div>
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {[
                    ['Revenus', `${selected.revenus.toLocaleString()} €`, 'text-emerald-700'],
                    ['Ratio', `${(selected.revenus / (bien.loyer || 1)).toFixed(1)}x`, selected.revenus / (bien.loyer || 1) >= 3 ? 'text-emerald-600' : 'text-amber-600'],
                    ['Audit IA', selected.auditStatus || '—', selected.auditStatus === 'CLEAR' ? 'text-emerald-600' : 'text-amber-600'],
                  ].map(([l, v, c]) => (
                    <div key={l} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className={`text-lg font-bold ${c}`}>{v}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{l}</div>
                    </div>
                  ))}
                </div>
                {selected.contractReady && (
                  <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                    ✓ Prêt à contracter · Dossier complet
                  </div>
                )}
              </div>
              {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Les autres candidats seront notifiés automatiquement par e-mail.
              </div>
              <div className="flex gap-3">
                <Btn variant="secondary" onClick={() => setStep(0)} className="flex-1">← Modifier</Btn>
                <Btn variant="amber" onClick={handleConfirm} disabled={loading} className="flex-[2]">
                  {loading ? 'Enregistrement…' : 'Confirmer la sélection →'}
                </Btn>
              </div>
            </motion.div>
          )}

          {/* Step 3 — succès */}
          {step === 3 && selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg py-12 text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <h2 className="font-serif text-2xl font-bold text-slate-950">Sélection enregistrée !</h2>
              <p className="mt-2 mb-8 text-sm text-slate-500">
                {selected.prenom} {selected.nom} a été sélectionné(e) pour {bien.label}.
                Rendez-vous sur la fiche du bien pour rédiger le bail.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Btn variant="secondary" onClick={onClose}>Retour au tableau de bord</Btn>
                <Btn variant="amber" onClick={() => { onClose(); window.location.href = `/dashboard/owner/property/${bien.id}`; }}>
                  <FileSignature className="h-4 w-4" /> Rédiger le bail →
                </Btn>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Détail candidat (modale secondaire) */}
      <AnimatePresence>
        {detail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"
            onClick={() => setDetail(null)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={`${detail.prenom} ${detail.nom}`} id={detail.id} />
                  <div>
                    <div className="font-bold text-slate-950">{detail.prenom} {detail.nom}</div>
                    <div className="text-xs text-slate-500">{detail.contrat}</div>
                    <div className="mt-1"><ScorePill score={detail.score} /></div>
                  </div>
                </div>
                <button type="button" onClick={() => setDetail(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-4 divide-y divide-slate-100">
                {[
                  ['Contrat', detail.contrat],
                  ['Revenus', `${detail.revenus.toLocaleString()} €/mois`],
                  ['Ratio', `${(detail.revenus / (bien.loyer || 1)).toFixed(2)}x`],
                  ['Reste à vivre', detail.remainingIncomeLabel || '—'],
                  ['Effort locatif', detail.effortRateLabel || '—'],
                  ['Garantie', detail.garantie || 'Aucune'],
                  ['Audit IA', detail.auditStatus || '—'],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between py-2.5 text-sm">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-semibold text-slate-900">{v}</span>
                  </div>
                ))}
              </div>
              {detail.auditSummary && (
                <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs italic leading-5 text-slate-600">{detail.auditSummary}</div>
              )}
              <button type="button" onClick={() => { handleSelect(detail); setDetail(null); }} className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400">
                Sélectionner {detail.prenom} →
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Nouvel actif (création de bien) ──────────────────────────────────────────

const ACTIF_STEPS = ['Adresse', 'Paramètres', 'Récap'];

function NouvelActifForm({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ address: '', rentAmount: '', surfaceM2: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: form.address,
          rentAmount: parseFloat(form.rentAmount) || 0,
          surfaceM2: parseFloat(form.surfaceM2) || 0,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Erreur lors de la création.');
        return;
      }
      onDone();
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
        <StepBar step={step} steps={ACTIF_STEPS} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {step === 0 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Adresse du bien</h3>
            <p className="mb-5 text-sm text-slate-500">Entrez l&apos;adresse complète du logement à mettre en gestion.</p>
            <div className="mb-6">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Adresse complète</label>
              <input
                type="text"
                placeholder="Ex : 42 rue de la Roquette, 75011 Paris"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                value={form.address}
                onChange={(e) => f('address', e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Btn variant="amber" disabled={!form.address.trim()} onClick={() => setStep(1)}>
                Continuer <ArrowRight className="h-4 w-4" />
              </Btn>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Paramètres locatifs</h3>
            <p className="mb-5 text-sm text-slate-500">Définissez le loyer et la surface pour le scoring des candidatures.</p>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Loyer mensuel (€)</label>
                <input
                  type="number"
                  placeholder="1 200"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                  value={form.rentAmount}
                  onChange={(e) => f('rentAmount', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Surface (m²)</label>
                <input
                  type="number"
                  placeholder="45"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                  value={form.surfaceM2}
                  onChange={(e) => f('surfaceM2', e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-between">
              <Btn variant="secondary" onClick={() => setStep(0)}>← Retour</Btn>
              <Btn variant="amber" disabled={!form.rentAmount} onClick={() => setStep(2)}>Continuer →</Btn>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h3 className="mb-1 font-semibold text-slate-900">Récapitulatif</h3>
            <p className="mb-5 text-sm text-slate-500">Vérifiez avant de créer la fiche.</p>
            <div className="mb-5 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50">
              {[
                ['Adresse', form.address],
                ['Loyer', `${parseFloat(form.rentAmount) || 0} €/mois`],
                ['Surface', `${parseFloat(form.surfaceM2) || '—'} m²`],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">{k}</span>
                  <span className="font-semibold text-slate-900">{v}</span>
                </div>
              ))}
            </div>
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Un lien de candidature unique sera généré pour partager à vos candidats.</span>
            </div>
            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <div className="flex justify-between">
              <Btn variant="secondary" onClick={() => setStep(1)}>← Retour</Btn>
              <Btn variant="amber" disabled={loading} onClick={handleSubmit}>
                <CheckCircle2 className="h-4 w-4" /> {loading ? 'Création…' : 'Créer le bien'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Navigation sidebar ────────────────────────────────────────────────────────

type NavId = 'dashboard' | 'candidatures' | 'biens' | 'depot' | 'baux' | 'gestion' | 'edl';
const NAV: { id: NavId; label: string; Icon: React.ElementType; group: string; badge?: boolean }[] = [
  { id: 'dashboard',    label: "Vue d'ensemble",    Icon: LayoutDashboard, group: 'Principal' },
  { id: 'candidatures', label: 'Candidatures',       Icon: Users,           group: 'Principal', badge: true },
  { id: 'biens',        label: 'Mes actifs',         Icon: Building2,       group: 'Principal' },
  { id: 'depot',        label: 'Nouvel actif',       Icon: Plus,            group: 'Actions' },
  { id: 'baux',         label: 'Baux & Signatures',  Icon: FileSignature,   group: 'Actions' },
  { id: 'gestion',      label: 'Gestion locative',   Icon: ScrollText,      group: 'Actions' },
  { id: 'edl',          label: 'États des lieux',    Icon: ClipboardList,   group: 'Actions' },
];

// ── Main app ──────────────────────────────────────────────────────────────────

export default function OwnerDashboardClient() {
  const router = useRouter();
  const { data, loading, userEmail, refresh } = useOwner();
  const [page, setPage] = useState<NavId>('dashboard');
  const [selBienId, setSelBienId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Derived data ──────────────────────────────────────────────
  const biens = data.map(toBien);
  const allDossiers: LocalDossier[] = data.flatMap((e) =>
    e.candidatures.map((c) => toDossier(c, e.property.id, e.property.rent || 0))
  );
  const managed = data.filter((e) => e.flow.stage === 'management' || e.property.isRented);
  const pending = allDossiers.filter((d) => d.statut === 'en_attente' && !d.isSealed).length;
  const selectionnes = biens.filter((b) => b.isRented || b.flowStage === 'management').length;

  const go = (p: NavId) => { setPage(p); setExpandedId(null); };

  function Th({ children }: { children?: React.ReactNode }) {
    return <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</th>;
  }
  function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`border-t border-slate-100 px-5 py-4 text-sm ${className}`}>{children}</td>;
  }

  const selBien = biens.find((b) => b.id === selBienId) ?? null;
  const selCands = selBienId ? allDossiers.filter((d) => d.bien_id === selBienId) : [];

  const handleSelectDone = (c: LocalDossier) => {
    refresh();
    // Keep tunnel open to show success step — tunnel handles close itself
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 mx-auto" />
          <p className="text-sm text-slate-500">Chargement de votre espace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 font-sans">

      {/* ── SIDEBAR ───────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-slate-200 bg-white/90 backdrop-blur-xl">
        {/* Logo */}
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-lg">
              🛡️
            </div>
            <div>
              <div className="font-serif text-base font-bold tracking-tight text-slate-950">PatrimoTrust™</div>
              <div className="mt-0.5 inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Propriétaire</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {[...new Set(NAV.map((n) => n.group))].map((grp) => (
            <div key={grp} className="mb-4">
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{grp}</div>
              {NAV.filter((n) => n.group === grp).map(({ id, label, Icon, badge }) => {
                const active = page === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => go(id)}
                    className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                      active
                        ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200'
                        : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {badge && pending > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{pending}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-800 to-emerald-600 text-xs font-bold text-white">
              {userEmail ? userEmail[0].toUpperCase() : 'P'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900">{userEmail || 'Propriétaire'}</div>
              <div className="text-[11px] text-slate-500">Espace sécurisé</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ──────────────────────────────────────────────── */}
      <main className="ml-60 flex-1 px-8 py-8">

        {/* ─ DASHBOARD ─ */}
        {page === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">
                  Bonjour{userEmail ? ` ${userEmail.split('@')[0]}` : ''} 👋
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {biens.length} bien{biens.length !== 1 ? 's' : ''} en portefeuille · Cockpit Souverain
                </p>
              </div>
              <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Nouvel actif</Btn>
            </div>

            <div className="mb-6 grid grid-cols-4 gap-4">
              <StatCard icon="🏠" value={biens.length}           label="Actifs en portefeuille"  bg="bg-emerald-50" />
              <StatCard icon="📋" value={allDossiers.length}     label="Candidatures reçues"     bg="bg-teal-50" />
              <StatCard icon="✓"  value={selectionnes}           label="Locataires sélectionnés" bg="bg-blue-50" />
              <StatCard icon="⏳" value={pending}                label="En attente d'analyse"    bg="bg-amber-50" />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {/* Dernières candidatures */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Dernières candidatures</div>
                  <button type="button" onClick={() => go('candidatures')} className="text-xs font-semibold text-emerald-600 hover:underline">Voir tout →</button>
                </div>
                {allDossiers.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">Aucune candidature reçue.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {[...allDossiers]
                      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
                      .slice(0, 5)
                      .map((d) => {
                        const bien = biens.find((b) => b.id === d.bien_id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => router.push(`/dashboard/owner/property/${d.bien_id}`)}
                            className="-mx-1 flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-slate-50"
                          >
                            <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-900">{d.prenom} {d.nom}</div>
                              <div className="truncate text-xs text-slate-500">{bien?.label || '—'}</div>
                            </div>
                            <ScorePill score={d.score} />
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Biens actifs */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Mes actifs</div>
                  <button type="button" onClick={() => go('biens')} className="text-xs font-semibold text-emerald-600 hover:underline">Voir tout →</button>
                </div>
                {biens.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-3 text-sm text-slate-400">Aucun bien en portefeuille.</p>
                    <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Ajouter un bien</Btn>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {biens.slice(0, 5).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}
                        className="-mx-1 flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-base">🏠</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">{b.label}</div>
                          <div className="truncate text-xs text-slate-500">{b.loyer.toLocaleString()} €/mois · {b.totalCandidates || 0} candidature{(b.totalCandidates || 0) !== 1 ? 's' : ''}</div>
                        </div>
                        <Tag type={b.isRented ? 'green' : 'indigo'}>{b.isRented ? 'Loué' : b.flowStage || 'Disponible'}</Tag>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─ CANDIDATURES ─ */}
        {page === 'candidatures' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">Candidatures</h1>
                <p className="mt-1 text-sm text-slate-500">{allDossiers.length} dossier{allDossiers.length !== 1 ? 's' : ''} · Analyse IA activée</p>
              </div>
            </div>

            {biens.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">📭</div>
                <p className="mb-4 text-slate-500">Aucun bien en portefeuille. Créez votre premier actif.</p>
                <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer un actif</Btn>
              </div>
            ) : (
              <div className="space-y-5">
                {data.map((entry) => {
                  const bien = toBien(entry);
                  const cands = allDossiers.filter((d) => d.bien_id === bien.id);
                  const hasSel = cands.some((d) => d.statut === 'selectionne');
                  return (
                    <div key={bien.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl">🏠</div>
                          <div>
                            <div className="font-semibold text-slate-900">{bien.label}</div>
                            <div className="text-xs text-slate-500">{bien.adresse} · {bien.loyer} €/mois · {cands.length} candidature{cands.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => router.push(`/dashboard/owner/property/${bien.id}`)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            <ExternalLink className="h-3.5 w-3.5" /> Fiche complète
                          </button>
                          {hasSel ? (
                            <Tag type="green">✓ Locataire sélectionné</Tag>
                          ) : cands.length > 0 ? (
                            <Btn variant="amber" onClick={() => setSelBienId(bien.id)}>Sélectionner <ArrowRight className="h-4 w-4" /></Btn>
                          ) : null}
                        </div>
                      </div>
                      {cands.length > 0 ? (
                        <table className="w-full border-collapse">
                          <thead className="bg-slate-50">
                            <tr>
                              <Th>Candidat</Th><Th>Revenus</Th><Th>Score IA</Th><Th>Statut</Th><Th>Garantie</Th><Th></Th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...cands].sort((a, b) => b.score - a.score).map((d) => (
                              <Fragment key={d.id}>
                                <tr
                                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                                  className="cursor-pointer transition-colors hover:bg-slate-50"
                                >
                                  <Td>
                                    <div className="flex items-center gap-3">
                                      <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                                      <div>
                                        <div className="font-semibold text-slate-900">{d.prenom} {d.nom}</div>
                                        <div className="text-xs text-slate-400">{d.submittedAt ? new Date(d.submittedAt).toLocaleDateString('fr-FR') : '—'}</div>
                                      </div>
                                    </div>
                                  </Td>
                                  <Td><b className="text-slate-900">{d.revenus.toLocaleString()} €</b></Td>
                                  <Td><ScorePill score={d.score} /></Td>
                                  <Td>
                                    <Tag type={d.statut === 'selectionne' ? 'green' : d.isSealed ? 'slate' : 'indigo'}>
                                      {d.statut === 'selectionne' ? 'Sélectionné' : d.isSealed ? (d.sealedLabel || 'Scellé') : 'En attente'}
                                    </Tag>
                                  </Td>
                                  <Td>{d.garantie || <span className="text-slate-400">—</span>}</Td>
                                  <Td>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/owner/property/${d.bien_id}`); }}
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                    >
                                      Voir →
                                    </button>
                                  </Td>
                                </tr>
                                {expandedId === d.id && (
                                  <tr>
                                    <td colSpan={6} className="border-t border-slate-100 bg-slate-50 px-5 py-5">
                                      <div className="grid gap-5 xl:grid-cols-2">
                                        <div>
                                          <div className="mb-3 font-semibold text-slate-900">Analyse IA — {d.prenom} {d.nom}</div>
                                          {[
                                            ['Solvabilité', bien.loyer > 0 ? Math.min((d.revenus / bien.loyer / 3) * 100, 100) : 0, d.revenus / (bien.loyer || 1) >= 3 ? 'bg-emerald-500' : 'bg-amber-500'],
                                            ['Qualité dossier', d.qualityScore ?? 50, (d.qualityScore ?? 0) >= 70 ? 'bg-emerald-500' : 'bg-amber-500'],
                                            ['Audit IA', d.auditStatus === 'CLEAR' ? 100 : d.auditStatus === 'ALERT' ? 20 : 60, d.auditStatus === 'CLEAR' ? 'bg-emerald-500' : d.auditStatus === 'ALERT' ? 'bg-red-500' : 'bg-amber-500'],
                                          ].map(([l, v, c]) => (
                                            <div key={String(l)} className="mb-3">
                                              <div className="mb-1 flex justify-between text-xs font-semibold">
                                                <span className="text-slate-500">{l}</span>
                                                <span className="text-slate-700">{Math.round(Number(v))}%</span>
                                              </div>
                                              <Bar value={Number(v)} color={String(c)} />
                                            </div>
                                          ))}
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                          {[
                                            ['Contrat', d.contrat],
                                            ['Revenus', `${d.revenus.toLocaleString()} €`],
                                            ['Ratio', `${(d.revenus / (bien.loyer || 1)).toFixed(1)}×`],
                                            ['Reste à vivre', d.remainingIncomeLabel || '—'],
                                            ['Effort locatif', d.effortRateLabel || '—'],
                                          ].map(([k, v]) => (
                                            <div key={String(k)} className="flex justify-between py-2 text-sm">
                                              <span className="text-slate-500">{k}</span>
                                              <span className="font-semibold text-slate-900">{v}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      {d.auditSummary && (
                                        <div className="mt-4 rounded-xl bg-white px-4 py-3 text-xs italic text-slate-600 border border-slate-200">
                                          {d.auditSummary}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex items-center justify-between px-5 py-4">
                          <p className="text-sm text-slate-400">Aucune candidature reçue pour ce bien.</p>
                          {bien.applyToken && (
                            <button
                              type="button"
                              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/apply/${bien.applyToken}`); }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Copier le lien candidature
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ─ MES ACTIFS ─ */}
        {page === 'biens' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">Mes actifs</h1>
                <p className="mt-1 text-sm text-slate-500">{biens.length} bien{biens.length !== 1 ? 's' : ''} en portefeuille</p>
              </div>
              <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Nouvel actif</Btn>
            </div>
            {biens.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">🏠</div>
                <p className="mb-4 text-slate-500">Aucun bien enregistré.</p>
                <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer votre premier actif</Btn>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {biens.map((b) => {
                  const selTenant = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                  return (
                    <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-xl">🏠</div>
                        <Tag type={b.isRented ? 'green' : 'indigo'}>{b.isRented ? 'Loué' : b.flowStage || 'Disponible'}</Tag>
                      </div>
                      <div className="font-bold text-slate-950">{b.label}</div>
                      <div className="mt-0.5 mb-3 text-sm text-slate-500">{b.adresse}</div>
                      <div className="mb-3 text-[1.75rem] font-bold text-emerald-700">
                        {b.loyer.toLocaleString()} <span className="text-sm font-normal text-slate-400">€/mois</span>
                      </div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {b.surface > 0 && <Tag>{b.surface} m²</Tag>}
                        <Tag>{b.totalCandidates || 0} candidature{(b.totalCandidates || 0) !== 1 ? 's' : ''}</Tag>
                      </div>
                      {selTenant && (
                        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                          <span className="text-slate-500">Locataire · </span>
                          <b className="text-slate-900">{selTenant.prenom} {selTenant.nom}</b>
                        </div>
                      )}
                      {b.flowProgress !== undefined && (
                        <div className="mb-4">
                          <div className="mb-1 flex justify-between text-xs text-slate-400">
                            <span>Progression</span><span>{b.flowProgress}%</span>
                          </div>
                          <Bar value={b.flowProgress} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Btn variant="secondary" className="flex-1 py-2 text-xs" onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Voir la fiche
                        </Btn>
                        {!b.isRented && (allDossiers.filter((d) => d.bien_id === b.id).length > 0) && (
                          <Btn variant="amber" className="flex-1 py-2 text-xs" onClick={() => setSelBienId(b.id)}>
                            Sélectionner →
                          </Btn>
                        )}
                        {b.applyToken && !b.isRented && (
                          <button
                            type="button"
                            title="Copier le lien candidature"
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/apply/${b.applyToken}`)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ─ NOUVEL ACTIF ─ */}
        {page === 'depot' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Nouvel actif</h1>
              <p className="mt-1 text-sm text-slate-500">Ajoutez un bien à votre portefeuille</p>
            </div>
            <NouvelActifForm onDone={() => { refresh(); go('biens'); }} />
          </motion.div>
        )}

        {/* ─ BAUX ─ */}
        {page === 'baux' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Baux &amp; Signatures</h1>
              <p className="mt-1 text-sm text-slate-500">Suivi des contrats · Signature électronique</p>
            </div>
            {managed.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">📄</div>
                <p className="text-slate-500">Aucun bail en cours. Sélectionnez un locataire depuis vos candidatures.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Loyer</Th><Th>Statut bail</Th><Th>Prochaine étape</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {managed.map((entry) => {
                      const b = toBien(entry);
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={b.tenantLabel || selCand ? `${selCand?.prenom} ${selCand?.nom}` : '?'} id={b.id} size="sm" />
                              <b className="text-slate-900">{b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—')}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-500">{b.label}</span></Td>
                          <Td><b className="text-emerald-700">{b.loyer.toLocaleString()} €</b></Td>
                          <Td>
                            <Tag type={b.leaseStatusLabel?.toLowerCase().includes('signé') ? 'green' : 'amber'}>
                              {b.leaseStatusLabel || 'En cours'}
                            </Tag>
                          </Td>
                          <Td><span className="text-xs text-slate-500">{b.nextMilestone || '—'}</span></Td>
                          <Td>
                            <Btn variant="ghost" className="py-1.5 text-xs" onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}>
                              <FileSignature className="h-3.5 w-3.5" /> Gérer →
                            </Btn>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* ─ GESTION LOCATIVE ─ */}
        {page === 'gestion' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Gestion locative</h1>
              <p className="mt-1 text-sm text-slate-500">Loyers · Quittances · Encaissements</p>
            </div>
            <div className="mb-6 grid grid-cols-4 gap-4">
              <StatCard icon="🏠" value={managed.length}        label="Biens en gestion"   bg="bg-emerald-50" />
              <StatCard icon="📋" value={allDossiers.length}    label="Candidatures totales" bg="bg-teal-50" />
              <StatCard icon="✓"  value={selectionnes}          label="Locataires actifs"  bg="bg-blue-50" />
              <StatCard icon="⏳" value={pending}               label="En attente"         bg="bg-amber-50" />
            </div>
            {managed.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
                <div className="mb-3 text-4xl">📊</div>
                <p className="text-slate-500">Aucun bien en gestion pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">
                  Biens sous gestion
                </div>
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Loyer</Th><Th>Statut</Th><Th>Résumé</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {managed.map((entry) => {
                      const b = toBien(entry);
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '?')} id={b.id} size="sm" />
                              <b>{b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—')}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-500">{b.label}</span></Td>
                          <Td><b className="text-emerald-700">{b.loyer.toLocaleString()} €</b></Td>
                          <Td>
                            <Tag type={b.isRented ? 'green' : 'amber'}>{b.isRented ? 'Occupé' : 'En cours'}</Tag>
                          </Td>
                          <Td><span className="text-xs text-slate-500">{b.leaseStatusLabel || '—'}</span></Td>
                          <Td>
                            <Btn variant="ghost" className="py-1.5 text-xs" onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}>
                              <ScrollText className="h-3.5 w-3.5" /> Détail →
                            </Btn>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* ─ ÉTATS DES LIEUX ─ */}
        {page === 'edl' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">États des lieux</h1>
                <p className="mt-1 text-sm text-slate-500">Entrées &amp; sorties · Rapport numérique</p>
              </div>
            </div>
            {managed.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">🔑</div>
                <p className="text-slate-500">Aucun bien en gestion avec un état des lieux.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Type</Th><Th>Statut EDL</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {managed.map((entry) => {
                      const b = toBien(entry);
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '?')} id={b.id} size="sm" />
                              <b>{b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—')}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-500">{b.label}</span></Td>
                          <Td><Tag type="indigo">Entrée</Tag></Td>
                          <Td>
                            <Tag type={entry.flow.stage === 'management' ? 'green' : 'amber'}>
                              {entry.flow.stage === 'management' ? 'En gestion' : 'À planifier'}
                            </Tag>
                          </Td>
                          <Td>
                            <Btn
                              variant="ghost"
                              className="py-1.5 text-xs"
                              onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}
                            >
                              <Download className="h-3.5 w-3.5" /> Voir l&apos;EDL →
                            </Btn>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* ── TUNNEL SÉLECTION (overlay) ─────────────────────────── */}
      <AnimatePresence>
        {selBienId && selBien && (
          <motion.div key="tunnel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TunnelSelection
              bien={selBien}
              candidats={selCands}
              onClose={() => setSelBienId(null)}
              onDone={handleSelectDone}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
