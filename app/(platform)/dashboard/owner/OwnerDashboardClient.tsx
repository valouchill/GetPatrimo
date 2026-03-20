'use client';

import { Fragment, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  LayoutDashboard,
  Lock,
  Plus,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useOwner } from './OwnerContext';
import type { Candidature as RealCandidature, PropertyWithCandidatures } from './OwnerContext';

// ── Stage labels ──────────────────────────────────────────────────────────────

const STAGE_FR: Record<string, string> = {
  search:     'Recherche',
  analysis:   'Analyse',
  selection:  'Sélection',
  contract:   'Contrat',
  management: 'Gestion',
};

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
  const ini = (name || '?').split(' ').map((s) => s[0] || '').join('').slice(0, 2).toUpperCase() || '?';
  const cls = { xs: 'h-7 w-7 rounded-lg text-[10px]', sm: 'h-9 w-9 rounded-xl text-xs', md: 'h-11 w-11 rounded-xl text-sm', lg: 'h-14 w-14 rounded-2xl text-base' }[size];
  return (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white ${cls} ${palette(id)}`}>
      {ini}
    </div>
  );
}

// ── Score pill ────────────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const cls = score >= 70 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : score >= 45 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
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
  slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',  red:   'bg-red-50 text-red-700',
  indigo: 'bg-emerald-50 text-emerald-700', violet: 'bg-teal-50 text-teal-700',
};
function Tag({ children, type = 'slate' }: { children: React.ReactNode; type?: TagType }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_CLS[type]}`}>{children}</span>;
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
function Btn({ children, variant = 'primary', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: BtnVariant; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${BTN_CLS[variant]} ${className}`}>
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
      <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

// ── Step bar ──────────────────────────────────────────────────────────────────

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
  id: string; label: string; adresse: string; loyer: number; surface: number;
  applyToken?: string; isRented?: boolean; flowStage?: string; flowStageLabel?: string;
  flowProgress?: number; flowSummary?: string; totalCandidates?: number;
  tenantLabel?: string; leaseStatusLabel?: string; nextMilestone?: string;
  nextActionLabel?: string; nextActionHref?: string;
};

type LocalDossier = {
  id: string; prenom: string; nom: string; bien_id: string; loyer: number;
  revenus: number; contrat: string; score: number; grade: string;
  statut: 'en_attente' | 'selectionne' | 'refuse'; isSealed: boolean;
  sealedLabel?: string; garantie?: string; auditStatus?: string; auditSummary?: string;
  effortRateLabel?: string; remainingIncomeLabel?: string; qualityScore?: number;
  contractReady?: boolean; submittedAt?: string;
};

function toBien(e: PropertyWithCandidatures): LocalBien {
  const p = e.property;
  const flow = e.flow;
  const ms = flow?.managementSummary;
  return {
    id: p.id,
    label: p.title || p.address?.split(',')[0]?.trim() || 'Bien',
    adresse: p.address || '',
    loyer: p.rent || 0,
    surface: p.surfaceM2 || 0,
    applyToken: p.applyToken,
    isRented: p.isRented,
    flowStage: flow?.stage,
    flowStageLabel: flow?.stageLabel || STAGE_FR[flow?.stage || ''] || '',
    flowProgress: flow?.progress ?? 0,
    flowSummary: flow?.summary,
    totalCandidates: flow?.totalCandidates ?? e.candidatures.length,
    tenantLabel: ms?.tenantLabel,
    leaseStatusLabel: ms?.leaseStatusLabel,
    nextMilestone: ms?.nextMilestone,
    nextActionLabel: flow?.nextAction?.label,
    nextActionHref: flow?.nextAction?.href,
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

// ── Candidat card ─────────────────────────────────────────────────────────────

function CandidatCard({ c, bien, onSelect, onDetail, compareMode, inCompare, onToggleCompare }: {
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
            {c.garantie && c.garantie !== 'Aucune garantie' && c.garantie !== 'Sans garantie' && <Tag type="indigo">{c.garantie}</Tag>}
            {c.contractReady && <Tag type="green">✓ Prêt à signer</Tag>}
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

function CompareView({ ids, candidats, bien, onSelect }: {
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
    { label: 'Garantie',      fn: (c) => <span className={(c.garantie && c.garantie !== 'Aucune garantie') ? 'font-semibold text-emerald-600' : 'text-slate-400'}>{c.garantie || '—'}</span> },
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

// ── Tunnel sélection ──────────────────────────────────────────────────────────

const SEL_STEPS = ['Dossiers', 'Comparaison', 'Confirmation', 'Succès'];

function TunnelSelection({ bien, candidats, onClose, onConfirmed, onGoToProperty }: {
  bien: LocalBien; candidats: LocalDossier[];
  onClose: () => void; onConfirmed: () => void; onGoToProperty: () => void;
}) {
  const [step, setStep] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<LocalDossier | null>(null);
  const [detail, setDetail] = useState<LocalDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlockedCands = candidats.filter((c) => !c.isSealed);
  const sealedCands = candidats.filter((c) => c.isSealed);
  const cands = [...unlockedCands].sort((a, b) => b.score - a.score);

  const toggleCompare = (id: string) =>
    setCompareIds((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p);
  const handleSelect = (c: LocalDossier) => { setSelected(c); setStep(2); setCompareMode(false); };

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/owner/properties/${bien.id}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: selected.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Erreur lors de la sélection.'); return;
      }
      setStep(3); onConfirmed();
    } catch { setError('Erreur réseau.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/50 backdrop-blur-sm">
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4 px-6 py-4">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <X className="h-4 w-4" /> Fermer
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded-xl border border-slate-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shrink-0">🏠 {bien.label}</span>
            <span className="hidden truncate text-sm text-slate-500 sm:block">{bien.adresse}</span>
            <Tag type="slate">{bien.loyer.toLocaleString()} €/mois</Tag>
          </div>
          <div className="ml-auto hidden w-72 shrink-0 sm:block">
            <StepBar step={step} steps={SEL_STEPS} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">

          {/* Step 0 — liste */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">
                    {candidats.length} candidature{candidats.length !== 1 ? 's' : ''}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {unlockedCands.length} dossier{unlockedCands.length !== 1 ? 's' : ''} déverrouillé{unlockedCands.length !== 1 ? 's' : ''}
                    {sealedCands.length > 0 && ` · ${sealedCands.length} scellé${sealedCands.length !== 1 ? 's' : ''}`}
                    {' · '}Triés par score IA
                  </p>
                </div>
                {!compareMode ? (
                  <Btn variant="ghost" onClick={() => setCompareMode(true)} disabled={unlockedCands.length < 2}>Comparer des dossiers</Btn>
                ) : (
                  <div className="flex gap-2">
                    <Btn variant="secondary" onClick={() => { setCompareMode(false); setCompareIds([]); }}>Annuler</Btn>
                    <Btn variant="amber" disabled={compareIds.length < 2} onClick={() => setStep(1)}>Comparer ({compareIds.length}) →</Btn>
                  </div>
                )}
              </div>
              {compareMode && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Sélectionnez 2 ou 3 candidats à comparer côte à côte · {compareIds.length}/3
                </div>
              )}
              {unlockedCands.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                  <div className="mb-3 text-4xl">🔒</div>
                  <p className="text-slate-500">Aucun dossier déverrouillé pour ce bien.</p>
                  <p className="mt-2 text-xs text-slate-400">Déverrouillez les candidatures depuis la fiche du bien.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {cands.map((c) => (
                    <CandidatCard key={c.id} c={c} bien={bien} onSelect={handleSelect} onDetail={setDetail}
                      compareMode={compareMode} inCompare={compareIds.includes(c.id)} onToggleCompare={toggleCompare} />
                  ))}
                  {sealedCands.map((c) => (
                    <CandidatCard key={c.id} c={c} bien={bien} onSelect={handleSelect} onDetail={setDetail}
                      compareMode={false} inCompare={false} onToggleCompare={toggleCompare} />
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
                  <p className="mt-1 text-sm text-slate-500">{compareIds.length} candidats · Critères clés</p>
                </div>
                <Btn variant="secondary" onClick={() => setStep(0)}>← Liste complète</Btn>
              </div>
              <CompareView ids={compareIds} candidats={cands} bien={bien} onSelect={handleSelect} />
            </motion.div>
          )}

          {/* Step 2 — confirmation */}
          {step === 2 && selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg">
              <div className="mb-8 text-center">
                <div className="mb-3 text-5xl">🏆</div>
                <h2 className="font-serif text-2xl font-bold text-slate-950">Confirmer la sélection</h2>
                <p className="mt-2 text-sm text-slate-500">Cette action notifiera automatiquement tous les candidats</p>
              </div>
              <div className="mb-4 rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-lg shadow-emerald-500/10">
                <div className="mb-5 flex items-center gap-4">
                  <Avatar name={`${selected.prenom} ${selected.nom}`} id={selected.id} size="lg" />
                  <div>
                    <div className="text-lg font-bold text-slate-950">{selected.prenom} {selected.nom}</div>
                    <div className="text-sm text-slate-500">{selected.contrat}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ScorePill score={selected.score} />
                      <Tag type={selected.contrat === 'CDI' || selected.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>{selected.contrat}</Tag>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['Revenus', `${selected.revenus.toLocaleString()} €`, 'text-emerald-700'],
                    ['Ratio', `${(selected.revenus / (bien.loyer || 1)).toFixed(1)}×`, selected.revenus / (bien.loyer || 1) >= 3 ? 'text-emerald-600' : 'text-amber-600'],
                    ['Audit', selected.auditStatus === 'CLEAR' ? 'Validé' : selected.auditStatus === 'ALERT' ? 'Alerte' : '—', selected.auditStatus === 'CLEAR' ? 'text-emerald-600' : 'text-amber-600'],
                  ].map(([l, v, c]) => (
                    <div key={l} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className={`text-base font-bold ${c}`}>{v}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{l}</div>
                    </div>
                  ))}
                </div>
                {selected.contractReady && (
                  <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                    ✓ Prêt à contracter · Dossier validé
                  </div>
                )}
              </div>
              {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                ⚠ Les autres candidats seront notifiés automatiquement par e-mail.
              </div>
              <div className="flex gap-3">
                <Btn variant="secondary" onClick={() => setStep(0)} className="flex-1">← Retour</Btn>
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
              <h2 className="font-serif text-2xl font-bold text-slate-950">Locataire sélectionné !</h2>
              <p className="mt-2 mb-2 text-sm text-slate-600">
                <span className="font-semibold">{selected.prenom} {selected.nom}</span> a été retenu(e) pour <span className="font-semibold">{bien.label}</span>.
              </p>
              <p className="mb-8 text-sm text-slate-500">
                Rendez-vous sur la fiche du bien pour rédiger et envoyer le bail pour signature.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Btn variant="secondary" onClick={onClose}>Retour au tableau de bord</Btn>
                <Btn variant="amber" onClick={() => { onClose(); onGoToProperty(); }}>
                  <FileSignature className="h-4 w-4" /> Rédiger le bail →
                </Btn>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Détail candidat */}
      <AnimatePresence>
        {detail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4"
            onClick={() => setDetail(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={`${detail.prenom} ${detail.nom}`} id={detail.id} />
                  <div>
                    <div className="font-bold text-slate-950">{detail.prenom} {detail.nom}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{detail.contrat}</div>
                    <div className="mt-1"><ScorePill score={detail.score} /></div>
                  </div>
                </div>
                <button type="button" onClick={() => setDetail(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-4 divide-y divide-slate-100">
                {([
                  ['Revenus', `${detail.revenus.toLocaleString()} €/mois`],
                  ['Ratio loyer', `${(detail.revenus / (bien.loyer || 1)).toFixed(2)}×`],
                  ['Reste à vivre', detail.remainingIncomeLabel || '—'],
                  ['Effort locatif', detail.effortRateLabel || '—'],
                  ['Garantie', detail.garantie || 'Aucune'],
                  ['Audit IA', detail.auditStatus === 'CLEAR' ? '✓ Validé' : detail.auditStatus === 'ALERT' ? '⚠ Alerte' : '—'],
                  ['Qualité dossier', detail.qualityScore ? `${detail.qualityScore}/100` : '—'],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2.5 text-sm">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-semibold text-slate-900">{v}</span>
                  </div>
                ))}
              </div>
              {detail.auditSummary && (
                <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs italic leading-5 text-slate-600">{detail.auditSummary}</div>
              )}
              <button type="button" onClick={() => { handleSelect(detail); setDetail(null); }}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400">
                Sélectionner {detail.prenom} →
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Nouvel actif ──────────────────────────────────────────────────────────────

const ACTIF_STEPS = ['Adresse', 'Paramètres', 'Récap'];

function NouvelActifForm({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ address: '', rentAmount: '', surfaceM2: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/owner/properties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: form.address, rentAmount: parseFloat(form.rentAmount) || 0, surfaceM2: parseFloat(form.surfaceM2) || undefined }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Erreur lors de la création.'); return; }
      onDone();
    } catch { setError('Erreur réseau. Vérifiez votre connexion.'); }
    finally { setLoading(false); }
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
              <input type="text" placeholder="Ex : 42 rue de la Roquette, 75011 Paris"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                value={form.address} onChange={(e) => f('address', e.target.value)} />
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
            <p className="mb-5 text-sm text-slate-500">Ces données alimentent le scoring automatique des candidatures.</p>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Loyer charges exclues (€)</label>
                <input type="number" min={0} placeholder="1 200"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                  value={form.rentAmount} onChange={(e) => f('rentAmount', e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">Surface (m²) <span className="font-normal text-slate-400">optionnel</span></label>
                <input type="number" min={0} placeholder="45"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50"
                  value={form.surfaceM2} onChange={(e) => f('surfaceM2', e.target.value)} />
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
              {([['Adresse', form.address], ['Loyer', `${parseFloat(form.rentAmount) || 0} €/mois`], ['Surface', form.surfaceM2 ? `${parseFloat(form.surfaceM2)} m²` : '—']] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-500">{k}</span><span className="font-semibold text-slate-900">{v}</span>
                </div>
              ))}
            </div>
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Un lien Sésame unique sera généré pour partager aux candidats.</span>
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

// ── Sidebar nav ───────────────────────────────────────────────────────────────

type NavId = 'dashboard' | 'candidatures' | 'biens' | 'depot' | 'baux' | 'gestion' | 'edl';
const NAV: { id: NavId; label: string; Icon: React.ElementType; group: string; badge?: boolean }[] = [
  { id: 'dashboard',    label: "Vue d'ensemble",   Icon: LayoutDashboard, group: 'Principal' },
  { id: 'candidatures', label: 'Candidatures',      Icon: Users,           group: 'Principal', badge: true },
  { id: 'biens',        label: 'Mes actifs',        Icon: Building2,       group: 'Principal' },
  { id: 'depot',        label: 'Nouvel actif',      Icon: Plus,            group: 'Actions' },
  { id: 'baux',         label: 'Baux & Signatures', Icon: FileSignature,   group: 'Actions' },
  { id: 'gestion',      label: 'Gestion locative',  Icon: ScrollText,      group: 'Actions' },
  { id: 'edl',          label: 'États des lieux',   Icon: ClipboardList,   group: 'Actions' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function OwnerDashboardClient() {
  const router = useRouter();
  const { data, loading, userEmail, refresh } = useOwner();
  const [page, setPage] = useState<NavId>('dashboard');
  const [selBienId, setSelBienId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────
  const biens = data.map(toBien);
  const bienById = new Map(biens.map((b) => [b.id, b]));
  const allDossiers: LocalDossier[] = data.flatMap((e) =>
    e.candidatures.map((c) => toDossier(c, e.property.id, e.property.rent || 0))
  );
  const pending = allDossiers.filter((d) => !d.isSealed && d.statut === 'en_attente').length;
  const selectionnes = biens.filter((b) => b.isRented || b.flowStage === 'management').length;
  // Baux: contract OR management stage
  const biensAvecBail = data.filter((e) => e.flow.stage === 'contract' || e.flow.stage === 'management');
  // EDL / Gestion: management stage
  const biensGeres = data.filter((e) => e.flow.stage === 'management' || e.property.isRented);

  const go = (p: NavId) => { setPage(p); setExpandedId(null); };

  const copyLink = async (token: string, id: string) => {
    const url = `${window.location.origin}/apply/${token}`;
    try { await navigator.clipboard.writeText(url); }
    catch { /* fallback: select/copy */ const el = document.createElement('textarea'); el.value = url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selBien = selBienId ? bienById.get(selBienId) ?? null : null;
  const selCands = selBienId ? allDossiers.filter((d) => d.bien_id === selBienId) : [];

  // ── Table helpers (local, stable refs) ────────────────────────
  function Th({ children }: { children?: React.ReactNode }) {
    return <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</th>;
  }
  function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`border-t border-slate-100 px-5 py-4 text-sm ${className}`}>{children}</td>;
  }

  // ── Loading / error ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-slate-500">Chargement de votre espace…</p>
        </div>
      </div>
    );
  }

  // ── Stage tag helper ───────────────────────────────────────────
  function StagePill({ stage, stageLabel }: { stage?: string; stageLabel?: string }) {
    const label = stageLabel || STAGE_FR[stage || ''] || stage || 'Inconnu';
    const type: TagType = stage === 'management' ? 'green' : stage === 'contract' ? 'indigo' : stage === 'selection' ? 'amber' : 'slate';
    return <Tag type={type}>{label}</Tag>;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 font-sans">

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-lg">🛡️</div>
            <div>
              <div className="font-serif text-base font-bold tracking-tight text-slate-950">PatrimoTrust™</div>
              <div className="mt-0.5 inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Propriétaire</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {[...new Set(NAV.map((n) => n.group))].map((grp) => (
            <div key={grp} className="mb-4">
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{grp}</div>
              {NAV.filter((n) => n.group === grp).map(({ id, label, Icon, badge }) => {
                const active = page === id;
                return (
                  <button key={id} type="button" onClick={() => go(id)}
                    className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                      active ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}>
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

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-800 to-emerald-600 text-xs font-bold text-white">
              {userEmail ? userEmail[0].toUpperCase() : 'P'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900">{userEmail || 'Propriétaire'}</div>
              <div className="text-[11px] text-slate-400">Espace sécurisé</div>
            </div>
            <button type="button" onClick={refresh} aria-label="Actualiser" className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────── */}
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
                  {biens.length} bien{biens.length !== 1 ? 's' : ''} · {allDossiers.length} candidature{allDossiers.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Nouvel actif</Btn>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon="🏠" value={biens.length}    label="Actifs en portefeuille" bg="bg-emerald-50" />
              <StatCard icon="📋" value={allDossiers.length} label="Candidatures reçues"  bg="bg-teal-50" />
              <StatCard icon="✓"  value={selectionnes}    label="Locataires sélectionnés" bg="bg-blue-50" />
              <StatCard icon="⏳" value={pending}         label="En attente d'examen"    bg="bg-amber-50" />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {/* Dernières candidatures */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Dernières candidatures</div>
                  <button type="button" onClick={() => go('candidatures')} className="text-xs font-semibold text-emerald-600 hover:underline">Voir tout →</button>
                </div>
                {allDossiers.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-2 text-sm text-slate-400">Aucune candidature reçue.</p>
                    <p className="text-xs text-slate-400">Partagez le lien Sésame de vos biens pour commencer.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {[...allDossiers]
                      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
                      .slice(0, 5)
                      .map((d) => {
                        const bien = bienById.get(d.bien_id);
                        return (
                          <button key={d.id} type="button" onClick={() => router.push(`/dashboard/owner/property/${d.bien_id}`)}
                            className="-mx-1 flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-slate-50">
                            <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-900">{d.prenom} {d.nom}</div>
                              <div className="truncate text-xs text-slate-500">{bien?.label || '—'} · {d.contrat}</div>
                            </div>
                            <ScorePill score={d.score} />
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Biens avec prochaine action */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Prochaines actions</div>
                  <button type="button" onClick={() => go('biens')} className="text-xs font-semibold text-emerald-600 hover:underline">Tous les actifs →</button>
                </div>
                {biens.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-3 text-sm text-slate-400">Aucun bien enregistré.</p>
                    <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer un actif</Btn>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {biens.slice(0, 5).map((b) => (
                      <div key={b.id} className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-base">🏠</span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{b.label}</div>
                              <div className="text-xs text-slate-500">{b.loyer.toLocaleString()} €/mois</div>
                            </div>
                          </div>
                          <StagePill stage={b.flowStage} stageLabel={b.flowStageLabel} />
                        </div>
                        {b.flowSummary && (
                          <p className="mt-2 text-xs text-slate-500 line-clamp-2">{b.flowSummary}</p>
                        )}
                        {b.nextActionLabel && (
                          <button type="button" onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}
                            className="mt-2 text-xs font-semibold text-emerald-600 hover:underline">
                            → {b.nextActionLabel}
                          </button>
                        )}
                      </div>
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

            {data.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">📭</div>
                <p className="mb-4 text-slate-500">Aucun bien en portefeuille.</p>
                <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer un actif</Btn>
              </div>
            ) : (
              <div className="space-y-5">
                {data.map((entry) => {
                  const b = bienById.get(entry.property.id)!;
                  const cands = allDossiers.filter((d) => d.bien_id === b.id);
                  const hasSel = cands.some((d) => d.statut === 'selectionne');
                  return (
                    <div key={b.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">🏠</div>
                          <div>
                            <div className="font-semibold text-slate-900">{b.label}</div>
                            <div className="text-xs text-slate-500">
                              {b.loyer.toLocaleString()} €/mois · {cands.length} candidature{cands.length !== 1 ? 's' : ''}
                              {cands.filter(c => !c.isSealed).length > 0 && ` · ${cands.filter(c => !c.isSealed).length} déverrouillé${cands.filter(c => !c.isSealed).length !== 1 ? 's' : ''}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            <ExternalLink className="h-3.5 w-3.5" /> Fiche complète
                          </button>
                          {hasSel ? (
                            <Tag type="green">✓ Locataire sélectionné</Tag>
                          ) : cands.filter(c => !c.isSealed).length > 0 ? (
                            <Btn variant="amber" onClick={() => setSelBienId(b.id)}>Sélectionner <ArrowRight className="h-4 w-4" /></Btn>
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
                            {[...cands].sort((a, b) => (a.isSealed ? 1 : 0) - (b.isSealed ? 1 : 0) || b.score - a.score).map((d) => (
                              <Fragment key={d.id}>
                                <tr onClick={() => !d.isSealed && setExpandedId(expandedId === d.id ? null : d.id)}
                                  className={`transition-colors ${d.isSealed ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                                  <Td>
                                    <div className="flex items-center gap-3">
                                      {d.isSealed
                                        ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Lock className="h-4 w-4 text-slate-400" /></div>
                                        : <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                                      }
                                      <div>
                                        <div className="font-semibold text-slate-900">
                                          {d.isSealed ? (d.sealedLabel || 'Candidat scellé') : `${d.prenom} ${d.nom}`}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                          {d.submittedAt ? new Date(d.submittedAt).toLocaleDateString('fr-FR') : '—'}
                                        </div>
                                      </div>
                                    </div>
                                  </Td>
                                  <Td>{d.isSealed ? <span className="text-slate-300">—</span> : <b className="text-slate-900">{d.revenus.toLocaleString()} €</b>}</Td>
                                  <Td>{d.isSealed ? <span className="text-slate-300">—</span> : <ScorePill score={d.score} />}</Td>
                                  <Td>
                                    {d.isSealed
                                      ? <Tag type="slate">🔒 Scellé</Tag>
                                      : <Tag type={d.statut === 'selectionne' ? 'green' : 'indigo'}>
                                          {d.statut === 'selectionne' ? '✓ Sélectionné' : 'En attente'}
                                        </Tag>
                                    }
                                  </Td>
                                  <Td>{d.isSealed ? <span className="text-slate-300">—</span> : (d.garantie || <span className="text-slate-400">—</span>)}</Td>
                                  <Td>
                                    {!d.isSealed && (
                                      <button type="button"
                                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/owner/property/${d.bien_id}`); }}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                        Voir →
                                      </button>
                                    )}
                                  </Td>
                                </tr>
                                {expandedId === d.id && !d.isSealed && (
                                  <tr>
                                    <td colSpan={6} className="border-t border-slate-100 bg-slate-50/80 px-5 py-5">
                                      <div className="grid gap-5 xl:grid-cols-2">
                                        <div>
                                          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Analyse IA</div>
                                          {([
                                            ['Solvabilité', b.loyer > 0 ? Math.min((d.revenus / b.loyer / 3) * 100, 100) : 0, d.revenus / (b.loyer || 1) >= 3 ? 'bg-emerald-500' : 'bg-amber-500'],
                                            ['Qualité dossier', d.qualityScore ?? 50, (d.qualityScore ?? 0) >= 70 ? 'bg-emerald-500' : 'bg-amber-500'],
                                            ['Audit IA', d.auditStatus === 'CLEAR' ? 100 : d.auditStatus === 'ALERT' ? 15 : 60, d.auditStatus === 'CLEAR' ? 'bg-emerald-500' : d.auditStatus === 'ALERT' ? 'bg-red-500' : 'bg-amber-500'],
                                          ] as [string, number, string][]).map(([l, v, c]) => (
                                            <div key={l} className="mb-3">
                                              <div className="mb-1 flex justify-between text-xs font-semibold">
                                                <span className="text-slate-500">{l}</span><span className="text-slate-700">{Math.round(v)}%</span>
                                              </div>
                                              <Bar value={v} color={c} />
                                            </div>
                                          ))}
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                          {([
                                            ['Contrat', d.contrat],
                                            ['Revenus', `${d.revenus.toLocaleString()} €`],
                                            ['Ratio', `${(d.revenus / (b.loyer || 1)).toFixed(1)}×`],
                                            ['Reste à vivre', d.remainingIncomeLabel || '—'],
                                            ['Effort locatif', d.effortRateLabel || '—'],
                                          ] as [string, string][]).map(([k, v]) => (
                                            <div key={k} className="flex justify-between py-2 text-sm">
                                              <span className="text-slate-500">{k}</span>
                                              <span className="font-semibold text-slate-900">{v}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      {d.auditSummary && (
                                        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs italic text-slate-600">{d.auditSummary}</div>
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
                          <p className="text-sm text-slate-400">Aucune candidature reçue — partagez le lien Sésame.</p>
                          {b.applyToken && (
                            <button type="button" onClick={() => copyLink(b.applyToken!, b.id)}
                              aria-label="Copier le lien candidature"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                              <Copy className="h-3.5 w-3.5" />
                              {copiedId === b.id ? 'Copié !' : 'Copier le lien Sésame'}
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
                  const candCount = allDossiers.filter((d) => d.bien_id === b.id).length;
                  return (
                    <div key={b.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">🏠</div>
                        <StagePill stage={b.flowStage} stageLabel={b.flowStageLabel} />
                      </div>
                      <div className="font-bold text-slate-950">{b.label}</div>
                      <div className="mt-0.5 mb-3 text-sm text-slate-500 line-clamp-1">{b.adresse}</div>
                      <div className="mb-3 text-[1.75rem] font-bold text-emerald-700">
                        {b.loyer.toLocaleString()} <span className="text-sm font-normal text-slate-400">€/mois</span>
                      </div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {b.surface > 0 && <Tag>{b.surface} m²</Tag>}
                        <Tag>{candCount} candidature{candCount !== 1 ? 's' : ''}</Tag>
                      </div>
                      {selTenant && (
                        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                          <span className="text-slate-500">Locataire · </span>
                          <b className="text-slate-900">{selTenant.prenom} {selTenant.nom}</b>
                        </div>
                      )}
                      {b.flowSummary && (
                        <p className="mb-3 text-xs leading-5 text-slate-500 line-clamp-2">{b.flowSummary}</p>
                      )}
                      {typeof b.flowProgress === 'number' && (
                        <div className="mb-4">
                          <div className="mb-1 flex justify-between text-xs text-slate-400">
                            <span>Progression</span><span>{b.flowProgress}%</span>
                          </div>
                          <Bar value={b.flowProgress} />
                        </div>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Btn variant="secondary" className="flex-1 py-2 text-xs" onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Voir la fiche
                        </Btn>
                        {!b.isRented && allDossiers.filter(d => d.bien_id === b.id && !d.isSealed).length > 0 && (
                          <Btn variant="amber" className="flex-1 py-2 text-xs" onClick={() => setSelBienId(b.id)}>
                            Sélectionner →
                          </Btn>
                        )}
                        {b.applyToken && !b.isRented && (
                          <button type="button" onClick={() => copyLink(b.applyToken!, b.id)} title="Copier le lien Sésame" aria-label="Copier le lien Sésame"
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              copiedId === b.id
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}>
                            {copiedId === b.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
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
              <p className="mt-1 text-sm text-slate-500">Ajoutez un bien à votre portefeuille PatrimoTrust</p>
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
            {biensAvecBail.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">📄</div>
                <p className="mb-2 text-slate-500">Aucun bail en cours.</p>
                <p className="text-xs text-slate-400">Sélectionnez un locataire depuis vos candidatures pour démarrer la rédaction.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Loyer</Th><Th>Étape</Th><Th>Statut bail</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {biensAvecBail.map((entry) => {
                      const b = bienById.get(entry.property.id)!;
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      const tenantName = b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={tenantName} id={b.id} size="sm" />
                              <b className="text-slate-900">{tenantName}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-600">{b.label}</span></Td>
                          <Td><b className="text-emerald-700">{b.loyer.toLocaleString()} €</b></Td>
                          <Td><StagePill stage={b.flowStage} stageLabel={b.flowStageLabel} /></Td>
                          <Td>
                            <Tag type={b.leaseStatusLabel?.toLowerCase().includes('signé') ? 'green' : 'amber'}>
                              {b.leaseStatusLabel || (entry.flow.stage === 'contract' ? 'En cours de rédaction' : 'En gestion')}
                            </Tag>
                          </Td>
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
              <p className="mt-1 text-sm text-slate-500">Suivi des locataires actifs</p>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon="🏠" value={biensGeres.length}   label="Biens en gestion"    bg="bg-emerald-50" />
              <StatCard icon="📋" value={allDossiers.length}  label="Candidatures totales" bg="bg-teal-50" />
              <StatCard icon="✓"  value={selectionnes}        label="Locataires actifs"   bg="bg-blue-50" />
              <StatCard icon="⏳" value={pending}             label="En attente"          bg="bg-amber-50" />
            </div>
            {biensGeres.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
                <div className="mb-3 text-4xl">📊</div>
                <p className="text-slate-500">Aucun bien en gestion active pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Loyer</Th><Th>Statut</Th><Th>Résumé</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {biensGeres.map((entry) => {
                      const b = bienById.get(entry.property.id)!;
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      const tenantName = b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={tenantName} id={b.id} size="sm" />
                              <b>{tenantName}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-600">{b.label}</span></Td>
                          <Td><b className="text-emerald-700">{b.loyer.toLocaleString()} €</b></Td>
                          <Td><Tag type="green">{b.isRented ? 'Occupé' : 'En gestion'}</Tag></Td>
                          <Td><span className="text-xs text-slate-500 line-clamp-2">{b.leaseStatusLabel || entry.flow.managementSummary?.summary || '—'}</span></Td>
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
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">États des lieux</h1>
              <p className="mt-1 text-sm text-slate-500">Entrées &amp; sorties · Rapport numérique · Signature</p>
            </div>
            {biensGeres.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">🔑</div>
                <p className="text-slate-500">Aucun bien en gestion avec un état des lieux.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Type</Th><Th>Étape</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {biensGeres.map((entry) => {
                      const b = bienById.get(entry.property.id)!;
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      const tenantName = b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={tenantName} id={b.id} size="sm" />
                              <b>{tenantName}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-600">{b.label}</span></Td>
                          <Td><Tag type="indigo">Entrée</Tag></Td>
                          <Td>
                            <Tag type={entry.flow.stage === 'management' ? 'green' : 'amber'}>
                              {entry.flow.stage === 'management' ? 'EDL réalisé' : 'À planifier'}
                            </Tag>
                          </Td>
                          <Td>
                            <Btn variant="ghost" className="py-1.5 text-xs" onClick={() => router.push(`/dashboard/owner/property/${b.id}`)}>
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

      {/* ── TUNNEL SÉLECTION ────────────────────────────────────── */}
      <AnimatePresence>
        {selBienId && selBien && (
          <motion.div key="tunnel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TunnelSelection
              bien={selBien}
              candidats={selCands}
              onClose={() => setSelBienId(null)}
              onConfirmed={() => refresh()}
              onGoToProperty={() => router.push(`/dashboard/owner/property/${selBienId}`)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
