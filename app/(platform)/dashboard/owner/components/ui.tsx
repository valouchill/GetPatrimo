'use client';

import { Fragment } from 'react';
import { CheckCircle2, ClipboardCheck, CreditCard, LayoutDashboard, Users, Building2, Plus, FileSignature, ScrollText, ClipboardList, Wallet, UserCog } from 'lucide-react';
import type { Candidature as RealCandidature, PropertyWithCandidatures } from '../OwnerContext';

// ── Stage labels ──────────────────────────────────────────────────────────────

export const STAGE_FR: Record<string, string> = {
  search:     'Recherche',
  analysis:   'Analyse',
  selection:  'Sélection',
  contract:   'Contrat',
  management: 'Gestion',
};

// ── Composants promus vers la lib partagée (V4.1 / PR26) ─────────────────────
//
// Avatar, ScorePill, GradeBadge, Tag, TAG_CLS, GuaranteeBadge sont désormais
// définis dans /opt/doc2loc/app/components/ui/. Ce fichier les ré-exporte
// pour garantir la rétrocompat des imports `from "./ui"` côté owner.
// Pour le nouveau code, importer directement depuis @/app/components/ui.

import {
  Avatar as AvatarShared,
  ScorePill as ScorePillShared,
  GradeBadge as GradeBadgeShared,
  Tag as TagShared,
  TAG_CLS as TAG_CLS_SHARED,
  GuaranteeBadge as GuaranteeBadgeShared,
  type TagType as TagTypeShared,
} from '@/app/components/ui';

export const Avatar = AvatarShared;
export const ScorePill = ScorePillShared;
export const GradeBadge = GradeBadgeShared;
export const Tag = TagShared;
export const TAG_CLS = TAG_CLS_SHARED;
export const GuaranteeBadge = GuaranteeBadgeShared;
export type TagType = TagTypeShared;

// Palette historique conservée pour rétrocompat (utilisée dans certains tests)
export const AVATAR_PALETTE = [
  'from-emerald-500 to-teal-600',
  'from-teal-500 to-cyan-600',
  'from-cyan-500 to-blue-500',
  'from-amber-400 to-amber-500',
  'from-emerald-400 to-emerald-600',
  'from-slate-500 to-slate-700',
];

// ── Button ────────────────────────────────────────────────────────────────────

export type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'amber';
export const BTN_CLS: Record<BtnVariant, string> = {
  primary:   'bg-amber-500 text-white hover:bg-amber-600 shadow-md',
  secondary: 'border border-amber-500 text-amber-500 hover:bg-amber-50',
  ghost:     'text-slate-600 hover:text-slate-800 hover:bg-slate-100',
  success:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  danger:    'bg-red-50 text-red-700 border border-red-200',
  amber:     'bg-amber-500 text-white hover:bg-amber-600 shadow-md',
};
export function Btn({ children, variant = 'primary', onClick, disabled, className = '' }: {
  children: React.ReactNode; variant?: BtnVariant; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${BTN_CLS[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

export function StatCard({ icon, value, label, bg = 'bg-amber-50' }: { icon: React.ReactNode; value: string | number; label: string; bg?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
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
  // Enriched fields
  propertyType?: string; floor?: number | null; rooms?: number | null;
  purchasePrice?: number | null; charges?: number;
  status?: string; vacantSince?: string | null;
  grossYield?: number | null;
};

export type LocalDossier = {
  id: string; prenom: string; nom: string; bien_id: string; loyer: number;
  revenus: number; contrat: string; score: number; grade: string;
  statut: 'en_attente' | 'selectionne' | 'refuse'; isSealed: boolean;
  sealedLabel?: string; garantie?: string; guaranteeMode?: 'NONE' | 'VISALE' | 'PHYSICAL';
  auditStatus?: string; auditSummary?: string;
  effortRateLabel?: string; remainingIncomeLabel?: string; qualityScore?: number;
  contractReady?: boolean; submittedAt?: string;
  isTop3?: boolean; pipelineStage?: string;
  highlights?: string[]; blockers?: string[];
  pillars?: Array<{ id: string; label: string; score: number; max: number; status: string; summary: string }>;
  decisionHeadline?: string; strengths?: string[]; watchouts?: string[];
  passportPreviewUrl?: string | null;
  passportDownloadUrl?: string | null;
  passportShareUrl?: string | null;
  // Phase J — Wow factor signals (exposés du payload existant)
  remainingIncome?: number | null;       // valeur exacte (€ /mois)
  effortRate?: number | null;            // taux d'effort (0-1)
  monthlyIncome?: number | null;         // revenu mensuel net (€)
  riskBand?: { label: string; score: number; tone: string };
  integrityScore?: { score: number; category: string; label: string };
  identityVerified?: boolean;            // Didit VERIFIED
  readyToLease?: boolean;
  riskLabel?: string;
  qualityStatusLabel?: string;
  qualityStatusTone?: string;
  certifiedDocuments?: number;
  reviewDocuments?: number;
  rejectedDocuments?: number;
  missingCriticalBlocks?: string[];
  contractWarnings?: string[];
  guaranteeStatus?: string;
  guaranteeSummary?: string;
  rank?: number;
  totalCandidates?: number;
  // Phase U — Verdict propriétaire centralisé serveur
  verdict?: 'recommended' | 'review' | 'risky';
  verdictLabel?: string;
  reasonCodes?: string[];
  // V1.4 — Détail bulletins de paie
  payslipsBreakdown?: Array<{
    amount: number;
    period?: string | null;
    date?: string | null;
    status?: string;
    source?: string | null;
    confidence?: number | null;
  }>;
  monthlyIncomeMean?: number | null;
  monthlyIncomeMedian?: number | null;
  monthlyIncomeStdDev?: number | null;
  monthlyIncomeMethod?: 'mean' | 'median' | 'none' | null;
  varianceRatio?: number | null;
  varianceHigh?: boolean;
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
    // Enriched
    propertyType: p.propertyType || 'APPARTEMENT',
    floor: p.floor ?? null,
    rooms: p.rooms ?? null,
    purchasePrice: p.purchasePrice ?? null,
    charges: p.chargesAmount || 0,
    status: p.status || 'AVAILABLE',
    vacantSince: p.vacantSince || null,
    grossYield: (p.purchasePrice && p.rent) ? Math.round(((p.rent * 12) / p.purchasePrice) * 1000) / 10 : null,
  };
}

export function toDossier(c: RealCandidature, bienId: string, loyer: number): LocalDossier {
  const ins = c.ownerInsights;
  // V1.4.1 — fallback intelligent sur le revenu (extraction IA peut renvoyer 0 sur anciens dossiers)
  const aiIncome = ins?.financial?.monthlyIncome && ins.financial.monthlyIncome > 0
    ? ins.financial.monthlyIncome
    : null;
  const declaredIncome = c.financialSummary?.monthlyNetIncome && c.financialSummary.monthlyNetIncome > 0
    ? c.financialSummary.monthlyNetIncome
    : null;
  const finalIncome = aiIncome ?? declaredIncome ?? null;

  // V1.4.1 — recalcul UI de effortRate / remainingIncome si backend les a à null (causé par monthlyIncome=0 backend)
  const backendEffort = ins?.financial?.effortRate;
  const backendRemain = ins?.financial?.remainingIncome;
  const computedEffort = finalIncome && finalIncome > 0 && loyer > 0
    ? Number(((loyer / finalIncome) * 100).toFixed(1))
    : null;
  const computedRemain = finalIncome && finalIncome > 0 && loyer > 0
    ? Math.max(0, finalIncome - loyer - Math.max(50, loyer * 0.1))
    : null;
  const finalEffort = (backendEffort !== null && backendEffort !== undefined && backendEffort > 0)
    ? backendEffort
    : computedEffort;
  const finalRemain = (backendRemain !== null && backendRemain !== undefined && backendRemain > 0)
    ? backendRemain
    : computedRemain;

  return {
    id: c.id,
    prenom: c.profile.firstName,
    nom: c.profile.lastName,
    bien_id: bienId,
    loyer,
    revenus: finalIncome ?? 0,
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
    pipelineStage: c.pipelineStage || undefined,
    highlights: ins?.aiAudit?.highlights,
    blockers: ins?.aiAudit?.blockers,
    pillars: ins?.pillars,
    decisionHeadline: ins?.decisionSummary?.headline,
    strengths: ins?.decisionSummary?.strengths,
    watchouts: ins?.decisionSummary?.watchouts,
    passportPreviewUrl: c.passport?.previewUrl ?? null,
    passportDownloadUrl: c.passport?.downloadUrl ?? null,
    passportShareUrl: c.passport?.shareUrl ?? null,
    // Phase J — Wow factor signals (avec fallback V1.4.1)
    remainingIncome: finalRemain,
    effortRate: finalEffort != null ? finalEffort / 100 : null, // backend expose en %, on stocke en ratio 0-1
    monthlyIncome: finalIncome,
    riskBand: ins?.financial?.riskBand,
    integrityScore: c.integrityScore,
    identityVerified: ins?.decisionSummary?.identityVerified ?? (c.didit?.status === 'VERIFIED'),
    readyToLease: ins?.decisionSummary?.readyToLease ?? ins?.contractReadiness?.ready,
    riskLabel: ins?.decisionSummary?.riskLabel,
    qualityStatusLabel: ins?.quality?.status?.label,
    qualityStatusTone: ins?.quality?.status?.tone,
    certifiedDocuments: ins?.quality?.certifiedDocuments,
    reviewDocuments: ins?.quality?.reviewDocuments,
    rejectedDocuments: ins?.quality?.rejectedDocuments,
    missingCriticalBlocks: ins?.quality?.missingCriticalBlocks,
    contractWarnings: ins?.contractReadiness?.warnings,
    guaranteeStatus: ins?.guarantee?.status,
    guaranteeSummary: ins?.guarantee?.summary,
    rank: c.rank,
    totalCandidates: undefined, // ajouté par le parent qui connaît le bien
    // Phase U — Verdict propriétaire centralisé (source: serveur)
    verdict: ins?.decisionSummary?.verdict,
    verdictLabel: ins?.decisionSummary?.verdictLabel,
    reasonCodes: ins?.decisionSummary?.reasonCodes,
    // V1.4 — Détail bulletins de paie
    payslipsBreakdown: ins?.financial?.payslipsBreakdown,
    monthlyIncomeMean: ins?.financial?.monthlyIncomeMean ?? null,
    monthlyIncomeMedian: ins?.financial?.monthlyIncomeMedian ?? null,
    monthlyIncomeStdDev: ins?.financial?.monthlyIncomeStdDev ?? null,
    monthlyIncomeMethod: ins?.financial?.monthlyIncomeMethod ?? null,
    varianceRatio: ins?.financial?.varianceRatio ?? null,
    varianceHigh: ins?.financial?.varianceHigh,
  };
}

// ── Step constants ────────────────────────────────────────────────────────────

export const ACTIF_STEPS = ['Adresse', 'Paramètres', 'Récap'];
export const SEL_STEPS = ['Dossiers', 'Comparaison', 'Confirmation', 'Succès'];

// ── Stage tag helper ──────────────────────────────────────────────────────────

export function StagePill({ stage, stageLabel }: { stage?: string; stageLabel?: string }) {
  const label = stageLabel || STAGE_FR[stage || ''] || stage || 'Inconnu';
  const type: TagType = stage === 'management' ? 'green' : stage === 'contract' ? 'amber' : stage === 'selection' ? 'amber' : stage === 'search' ? 'blue' : 'slate';
  return <Tag type={type}>{label}</Tag>;
}

// ── Sidebar nav ───────────────────────────────────────────────────────────────

export type NavId = 'dashboard' | 'candidatures' | 'biens' | 'depot' | 'baux' | 'gestion' | 'loyers' | 'edl' | 'profil';
import type { FeatureKey } from '@/lib/features';
export const NAV: { id: NavId; label: string; Icon: React.ElementType; group: string; badge?: boolean; hidden?: boolean; href?: string; feature?: FeatureKey }[] = [
  { id: 'dashboard',    label: "Vue d'ensemble",     Icon: LayoutDashboard,  group: 'Mon patrimoine' },
  { id: 'biens',        label: 'Mes biens',          Icon: Building2,        group: 'Mon patrimoine' },
  { id: 'candidatures', label: 'Candidatures',       Icon: Users,            group: 'Location', badge: true },
  { id: 'baux',         label: 'Baux & Signatures',  Icon: FileSignature,    group: 'Location',    feature: 'LEASES' },
  { id: 'edl',          label: 'États des lieux',    Icon: ClipboardCheck,   group: 'Location',    feature: 'EDL' },
  { id: 'loyers',       label: 'Loyers & Quittances', Icon: Wallet,          group: 'Finances',    feature: 'RECEIPTS' },
  { id: 'profil',       label: 'Mon profil',         Icon: UserCog,          group: 'Compte' },
  { id: 'depot',        label: 'Nouvel actif',       Icon: Plus,             group: '_hidden', hidden: true },
  { id: 'gestion',      label: 'Gestion locative',   Icon: ScrollText,       group: '_hidden', hidden: true, feature: 'MANAGEMENT' },
];
