'use client';

import { Fragment } from 'react';
import { CheckCircle2, CreditCard, LayoutDashboard, Users, Building2, Plus, FileSignature, ScrollText, ClipboardList } from 'lucide-react';
import type { Candidature as RealCandidature, PropertyWithCandidatures } from '../OwnerContext';

// ── Stage labels ──────────────────────────────────────────────────────────────

export const STAGE_FR: Record<string, string> = {
  search:     'Recherche',
  analysis:   'Analyse',
  selection:  'Sélection',
  contract:   'Contrat',
  management: 'Gestion',
};

// ── Avatar ────────────────────────────────────────────────────────────────────

export const AVATAR_PALETTE = [
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

export function Avatar({ name, id = 0, size = 'md' }: { name: string; id?: string | number; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const ini = (name || '?').split(' ').map((s) => s[0] || '').join('').slice(0, 2).toUpperCase() || '?';
  const cls = { xs: 'h-7 w-7 rounded-lg text-[10px]', sm: 'h-9 w-9 rounded-xl text-xs', md: 'h-11 w-11 rounded-xl text-sm', lg: 'h-14 w-14 rounded-2xl text-base' }[size];
  return (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white ${cls} ${palette(id)}`}>
      {ini}
    </div>
  );
}

// ── Score pill ────────────────────────────────────────────────────────────────

export function ScorePill({ score }: { score: number }) {
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

export type TagType = 'slate' | 'green' | 'amber' | 'red' | 'indigo' | 'violet';
export const TAG_CLS: Record<TagType, string> = {
  slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',  red:   'bg-red-50 text-red-700',
  indigo: 'bg-emerald-50 text-emerald-700', violet: 'bg-teal-50 text-teal-700',
};
export function Tag({ children, type = 'slate' }: { children: React.ReactNode; type?: TagType }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TAG_CLS[type]}`}>{children}</span>;
}

// ── Guarantee badge ──────────────────────────────────────────────────────────

export function GuaranteeBadge({ mode, short }: { mode?: 'NONE' | 'VISALE' | 'PHYSICAL'; short?: boolean }) {
  if (!mode || mode === 'NONE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        {short ? 'Sans garant' : '⚠ Sans garant'}
      </span>
    );
  }
  if (mode === 'VISALE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {short ? 'Visale' : '✓ Visale'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
      {short ? 'Garant' : '✓ Garant physique'}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'amber';
export const BTN_CLS: Record<BtnVariant, string> = {
  primary:   'bg-slate-950 text-white hover:bg-slate-800',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  ghost:     'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100',
  success:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  danger:    'bg-red-50 text-red-700 border border-red-200',
  amber:     'bg-amber-500 text-slate-950 hover:bg-amber-400',
};
export function Btn({ children, variant = 'primary', onClick, disabled, className = '' }: {
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

export function StatCard({ icon, value, label, bg = 'bg-emerald-50' }: { icon: string; value: string | number; label: string; bg?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg ${bg}`}>{icon}</div>
      <div className="text-[1.75rem] font-bold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

export function Bar({ value, color = 'bg-emerald-500' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-[width] duration-500 ${color}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

// ── Step bar ──────────────────────────────────────────────────────────────────

export function StepBar({ step, steps }: { step: number; steps: string[] }) {
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

export type LocalBien = {
  id: string; label: string; adresse: string; loyer: number; surface: number;
  applyToken?: string; isRented?: boolean; flowStage?: string; flowStageLabel?: string;
  flowProgress?: number; flowSummary?: string; totalCandidates?: number;
  tenantLabel?: string; leaseStatusLabel?: string; nextMilestone?: string;
  nextActionLabel?: string; nextActionHref?: string;
};

export type LocalDossier = {
  id: string; prenom: string; nom: string; bien_id: string; loyer: number;
  revenus: number; contrat: string; score: number; grade: string;
  statut: 'en_attente' | 'selectionne' | 'refuse'; isSealed: boolean;
  sealedLabel?: string; garantie?: string; guaranteeMode?: 'NONE' | 'VISALE' | 'PHYSICAL';
  auditStatus?: string; auditSummary?: string;
  effortRateLabel?: string; remainingIncomeLabel?: string; qualityScore?: number;
  contractReady?: boolean; submittedAt?: string;
  isTop3?: boolean;
  highlights?: string[]; blockers?: string[];
  pillars?: Array<{ id: string; label: string; score: number; max: number; status: string; summary: string }>;
  decisionHeadline?: string; strengths?: string[]; watchouts?: string[];
};

export function toBien(e: PropertyWithCandidatures): LocalBien {
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

export function toDossier(c: RealCandidature, bienId: string, loyer: number): LocalDossier {
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
    guaranteeMode: c.guarantee?.mode || ins?.guarantee?.mode,
    auditStatus: ins?.aiAudit?.status,
    auditSummary: ins?.aiAudit?.summary,
    effortRateLabel: ins?.financial?.effortRateLabel ?? undefined,
    remainingIncomeLabel: ins?.financial?.remainingIncomeLabel ?? undefined,
    qualityScore: ins?.quality?.score,
    contractReady: ins?.contractReadiness?.ready,
    submittedAt: c.submittedAt,
    isTop3: c.isTop3,
    highlights: ins?.aiAudit?.highlights,
    blockers: ins?.aiAudit?.blockers,
    pillars: ins?.pillars,
    decisionHeadline: ins?.decisionSummary?.headline,
    strengths: ins?.decisionSummary?.strengths,
    watchouts: ins?.decisionSummary?.watchouts,
  };
}

// ── Step constants ────────────────────────────────────────────────────────────

export const ACTIF_STEPS = ['Adresse', 'Paramètres', 'Récap'];
export const SEL_STEPS = ['Dossiers', 'Comparaison', 'Confirmation', 'Succès'];

// ── Stage tag helper ──────────────────────────────────────────────────────────

export function StagePill({ stage, stageLabel }: { stage?: string; stageLabel?: string }) {
  const label = stageLabel || STAGE_FR[stage || ''] || stage || 'Inconnu';
  const type: TagType = stage === 'management' ? 'green' : stage === 'contract' ? 'indigo' : stage === 'selection' ? 'amber' : 'slate';
  return <Tag type={type}>{label}</Tag>;
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────

export type NavId = 'dashboard' | 'candidatures' | 'biens' | 'depot' | 'baux' | 'gestion' | 'loyers' | 'edl';
export const NAV: { id: NavId; label: string; Icon: React.ElementType; group: string; badge?: boolean }[] = [
  { id: 'dashboard',    label: "Vue d'ensemble",   Icon: LayoutDashboard, group: 'Principal' },
  { id: 'candidatures', label: 'Candidatures',      Icon: Users,           group: 'Principal', badge: true },
  { id: 'biens',        label: 'Mes actifs',        Icon: Building2,       group: 'Principal' },
  { id: 'depot',        label: 'Nouvel actif',      Icon: Plus,            group: 'Actions' },
  { id: 'baux',         label: 'Baux & Signatures', Icon: FileSignature,   group: 'Actions' },
  { id: 'gestion',      label: 'Gestion locative',  Icon: ScrollText,      group: 'Actions' },
  { id: 'loyers',       label: 'Loyers & Quittances', Icon: CreditCard,   group: 'Actions' },
  { id: 'edl',          label: 'États des lieux',   Icon: ClipboardList,   group: 'Actions' },
];
