'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Crown,
  ExternalLink,
  Fingerprint,
  Loader2,
  Lock,
  ScrollText,
  Shield,
  Sparkles,
} from 'lucide-react';

import CheckoutModal from '@/app/components/CheckoutModal';
import {
  ActionBar,
  cx,
  InfoRow,
  MetricTile,
  PremiumSurface,
  SignalList,
  StatusBadge,
  TimelineBlock,
} from '@/app/components/ui/premium';

/* ------------------------------------------------------------------ */
/*  Types (aligned with PropertyDetailClient / API response)           */
/* ------------------------------------------------------------------ */

type CandidateRecord = {
  id: string;
  rank?: number;
  isTop3?: boolean;
  isOwnerSelected?: boolean;
  isUnlocked?: boolean;
  applyToken?: string;
  isSealed?: boolean;
  sealedLabel?: string;
  sealedId?: string;
  profile?: { firstName?: string; lastName?: string; phone?: string | null; email?: string | null };
  userEmail?: string;
  status?: string;
  submittedAt?: string;
  patrimometer?: { score?: number; grade?: string };
  didit?: { status?: string };
  financialSummary?: {
    monthlyNetIncome?: number;
    remainingIncome?: number | null;
    riskLevel?: string;
    riskPercent?: number;
    effortRate?: number | null;
    contractType?: string;
  } | null;
  guarantor?: Record<string, any> | null;
  guarantee?: {
    mode?: 'NONE' | 'VISALE' | 'PHYSICAL';
    visale?: Record<string, any> | null;
    guarantors?: Array<Record<string, any>>;
  } | null;
  passport?: {
    state?: string;
    stateLabel?: string;
    summary?: string;
    previewUrl?: string | null;
    shareUrl?: string | null;
    downloadUrl?: string | null;
  } | null;
  ownerInsights?: {
    aiAudit?: {
      status?: 'CLEAR' | 'REVIEW' | 'ALERT';
      score?: number;
      summary?: string;
      highlights?: string[];
      blockers?: string[];
      reviewReasons?: string[];
    };
    financial?: {
      monthlyIncomeLabel?: string | null;
      remainingIncomeLabel?: string | null;
      effortRateLabel?: string | null;
      riskBand?: { label?: string; tone?: string };
      summary?: string;
    };
    quality?: {
      score?: number;
      status?: { label?: string; tone?: string };
      summary?: string;
      certifiedDocuments?: number;
      reviewDocuments?: number;
      rejectedDocuments?: number;
      missingCriticalBlocks?: string[];
    };
    contractReadiness?: {
      ready?: boolean;
      blockers?: string[];
      warnings?: string[];
      leaseType?: string;
      suggestedDepositLabel?: string | null;
    };
    guarantee?: {
      mode?: string;
      label?: string;
      status?: string;
      summary?: string;
      shareBadge?: string;
    };
    pillars?: Array<{
      id: string;
      label: string;
      score: number;
      max: number;
      status: string;
      summary: string;
    }>;
    timeline?: Array<{
      id: string;
      title: string;
      status: string;
      time?: string | null;
      description: string;
    }>;
  } | null;
  documentsCount?: number;
  certifiedDocumentsCount?: number;
};

type PropertyMeta = {
  _id?: string;
  name?: string;
  address?: string;
  applyToken?: string;
  rentAmount?: number;
  surfaceM2?: number;
  status?: string;
  managed?: boolean;
  flow?: {
    stage: string;
    sealedCount: number;
    unlocked?: boolean;
    selectedCandidateId?: string | null;
  };
  acceptedTenantId?: string | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function candidateName(c?: CandidateRecord | null) {
  if (!c) return 'Candidat';
  if (c.isSealed) return c.sealedLabel || 'Profil masqué';
  return [c.profile?.firstName, c.profile?.lastName].filter(Boolean).join(' ').trim() || 'Candidat';
}

function auditPresentation(c?: CandidateRecord | null) {
  const status = String(c?.ownerInsights?.aiAudit?.status || '');
  const grade = c?.patrimometer?.grade;
  if (status === 'ALERT') return { tone: 'danger' as const, label: 'Alerte critique' };
  if (status === 'REVIEW') return { tone: 'warning' as const, label: 'Vérification requise' };
  if (grade) return { tone: 'success' as const, label: `Grade ${grade}` };
  return { tone: 'success' as const, label: 'Dossier fluide' };
}

function formatCurrency(value?: number | null, fallback = '—') {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function PillarBar({ label, score, max, status, summary }: { label: string; score: number; max: number; status: string; summary?: string }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-900">{label}</span>
        <span className="font-mono text-xs text-slate-500">{score}/{max}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className={cx(
            'h-full rounded-full',
            status === 'danger' ? 'bg-rose-500' : status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
          )}
        />
      </div>
      {summary ? <p className="text-xs leading-5 text-slate-500">{summary}</p> : null}
    </div>
  );
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */

export default function CandidateAuditClient({
  propertyId,
  candidateId,
}: {
  propertyId: string;
  candidateId: string;
}) {
  const router = useRouter();
  const [property, setProperty] = useState<PropertyMeta | null>(null);
  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [propRes, candRes] = await Promise.all([
        fetch(`/api/owner/properties/${propertyId}`, { cache: 'no-store' }),
        fetch(`/api/owner/properties/${propertyId}/candidatures`, { cache: 'no-store' }),
      ]);
      const propData = propRes.ok ? await propRes.json() : null;
      const candData = candRes.ok ? await candRes.json() : { candidatures: [] };
      const list: CandidateRecord[] = Array.isArray(candData?.candidatures) ? candData.candidatures : [];
      setProperty(propData);
      setCandidate(list.find((c) => c.id === candidateId) || null);
    } catch {
      setProperty(null);
      setCandidate(null);
    } finally {
      setLoading(false);
    }
  }, [propertyId, candidateId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChoose = async () => {
    if (!candidate) return;
    setSelectionBusy(true);
    setSelectionError(null);
    try {
      const res = await fetch(`/api/owner/properties/${propertyId}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: candidate.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Impossible de sélectionner ce dossier.');
      router.push(`/dashboard/owner/property/${propertyId}?tab=selected&applicationId=${candidate.id}`);
    } catch (err) {
      setSelectionError(err instanceof Error ? err.message : 'Erreur de sélection.');
    } finally {
      setSelectionBusy(false);
    }
  };

  const audit = useMemo(() => auditPresentation(candidate), [candidate]);
  const isSealed = Boolean(candidate?.isSealed);
  const isOwnerSelected = Boolean(candidate?.isOwnerSelected);
  const canChangeSelection = !['LEASE_IN_PROGRESS', 'OCCUPIED'].includes(String(property?.status || '').toUpperCase());
  const propertyLabel = property?.address || property?.name || 'le bien';

  const signals = useMemo(() => {
    if (!candidate?.ownerInsights) return [];
    return [
      ...(candidate.ownerInsights.aiAudit?.blockers || []).map((b) => ({
        id: `b-${b}`, title: 'Blocage' as const, description: b, tone: 'danger' as const,
      })),
      ...(candidate.ownerInsights.aiAudit?.reviewReasons || []).map((r) => ({
        id: `r-${r}`, title: 'Revue humaine' as const, description: r, tone: 'warning' as const,
      })),
      ...(candidate.ownerInsights.aiAudit?.highlights || []).map((h) => ({
        id: `h-${h}`, title: 'Signal favorable' as const, description: h, tone: 'success' as const,
      })),
    ];
  }, [candidate]);

  const timelineItems = useMemo(() => {
    return (candidate?.ownerInsights?.timeline || []).map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      meta: e.time || undefined,
      status: ['success', 'warning', 'danger', 'sealed'].includes(e.status) ? e.status : undefined,
    }));
  }, [candidate]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  /* ── Not found ── */
  if (!candidate) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Dossier introuvable</h2>
        <p className="mt-2 text-sm text-slate-500">Le dossier demandé n&apos;est pas accessible.</p>
        <Link
          href={`/dashboard/owner/property/${propertyId}`}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
      </div>
    );
  }

  const pillars = candidate.ownerInsights?.pillars || [];
  const name = candidateName(candidate);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        propertyId={propertyId}
        propertyLabel={propertyLabel}
        candidateCount={Number(property?.flow?.sealedCount || 0)}
        unlockScope="property"
      />

      {/* ── Back link ── */}
      <Link
        href={`/dashboard/owner/property/${propertyId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au bien
      </Link>

      {/* ── Sealed banner ── */}
      {isSealed && (
        <PremiumSurface padding="md" className="rounded-3xl border-amber-200 bg-amber-50">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
              <Lock className="h-5 w-5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <h4 className="text-lg font-semibold text-amber-950">Ce dossier reste masqué</h4>
              <p className="mt-2 text-sm leading-6 text-amber-900/80">
                Le détail complet s&apos;ouvrira une fois le bien déverrouillé. Le paiement débloque tous les profils de ce bien.
              </p>
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
              >
                <Lock className="h-4 w-4 text-amber-300" />
                Déverrouiller tous les dossiers
              </button>
            </div>
          </div>
        </PremiumSurface>
      )}

      {selectionError && (
        <PremiumSurface padding="sm" className="rounded-3xl border-rose-200 bg-rose-50">
          <p className="text-sm font-medium text-rose-700">{selectionError}</p>
        </PremiumSurface>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/*  CANDIDATE HEADER                                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <PremiumSurface padding="lg" className="rounded-3xl border-slate-200 bg-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <ActionBar className="gap-2">
              <StatusBadge tone={audit.tone} label={audit.label} className="normal-case tracking-normal text-[11px] font-semibold" />
              {candidate.didit?.status === 'VERIFIED' && (
                <StatusBadge
                  tone="success"
                  label={<><Fingerprint className="h-3.5 w-3.5" /> Identité vérifiée</>}
                  className="normal-case tracking-normal text-[11px] font-semibold"
                />
              )}
              {isOwnerSelected && (
                <StatusBadge tone="dark" label="Choisi par le propriétaire" className="normal-case tracking-normal text-[11px] font-semibold" />
              )}
              {candidate.isTop3 && (
                <StatusBadge tone="neutral" label={`#${candidate.rank} recommandé IA`} className="normal-case tracking-normal text-[11px] font-semibold" />
              )}
            </ActionBar>

            <h1 className="mt-4 break-words font-serif text-[2.2rem] tracking-tight text-slate-950 sm:text-[2.8rem]">
              {name}
            </h1>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              Score de confiance : <span className="font-semibold text-slate-900">{Math.round(Number(candidate.patrimometer?.score || 0))}/100</span>
              {candidate.patrimometer?.grade && (
                <span className="ml-2 font-semibold text-slate-900">· Grade {candidate.patrimometer.grade}</span>
              )}
            </p>
          </div>

          {/* Desktop actions */}
          <ActionBar className="gap-2 lg:flex-col lg:items-end">
            {candidate.passport?.previewUrl || candidate.passport?.shareUrl ? (
              <button
                type="button"
                onClick={() => window.open(candidate.passport?.previewUrl || candidate.passport?.shareUrl || '', '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" />
                Voir le passeport
              </button>
            ) : null}
            {!isSealed && isOwnerSelected && (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/owner/property/${propertyId}?tab=selected&applicationId=${candidate.id}`)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
              >
                <ScrollText className="h-4 w-4" />
                Préparer le bail
              </button>
            )}
            {!isSealed && !isOwnerSelected && canChangeSelection && (
              <button
                type="button"
                disabled={selectionBusy}
                onClick={handleChoose}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-55"
              >
                <Crown className="h-4 w-4 text-amber-300" />
                {selectionBusy ? 'Sélection...' : 'Choisir ce dossier'}
              </button>
            )}
            {isSealed && (
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
              >
                <Lock className="h-4 w-4 text-amber-300" />
                Déverrouiller
              </button>
            )}
          </ActionBar>
        </div>
      </PremiumSurface>

      {/* ══════════════════════════════════════════════════════════ */}
      {/*  SCORECARD (4 metrics)                                    */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Score de confiance"
          value={`${Math.round(Number(candidate.patrimometer?.score || 0))}%`}
          caption={candidate.patrimometer?.grade ? `Grade ${candidate.patrimometer.grade}` : 'Lecture du dossier'}
        />
        <MetricTile
          label="Solvabilité"
          value={candidate.ownerInsights?.financial?.remainingIncomeLabel || 'À confirmer'}
          caption={candidate.ownerInsights?.financial?.effortRateLabel || 'Taux d\'effort indisponible'}
        />
        <MetricTile
          label="Qualité dossier"
          value={candidate.ownerInsights?.quality?.status?.label || 'En audit'}
          caption={`${Number(candidate.ownerInsights?.quality?.score || 0)}/100`}
        />
        <MetricTile
          label="Pièces certifiées"
          value={`${Number(candidate.certifiedDocumentsCount || 0)}/${Number(candidate.documentsCount || 0)}`}
          caption={candidate.ownerInsights?.guarantee?.label || 'Sans garant'}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/*  AI SYNTHESIS                                             */}
      {/* ══════════════════════════════════════════════════════════ */}
      <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <Sparkles className="h-5 w-5 text-slate-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Synthèse IA</div>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {candidate.ownerInsights?.aiAudit?.summary || 'Aucune synthèse disponible pour le moment.'}
            </p>
          </div>
        </div>
      </PremiumSurface>

      {/* ══════════════════════════════════════════════════════════ */}
      {/*  BODY : 2-col layout (pillars+financial | signals+guarantee) */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* ── Left column (7/12) ── */}
        <div className="space-y-6 xl:col-span-7">
          {/* Pillars */}
          {pillars.length > 0 && (
            <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Piliers du score</div>
              <div className="mt-5 space-y-5">
                {pillars.map((p) => (
                  <PillarBar key={p.id} label={p.label} score={p.score} max={p.max} status={p.status} summary={p.summary} />
                ))}
              </div>
            </PremiumSurface>
          )}

          {/* Financial detail */}
          <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Détail financier</div>
            <div className="mt-4 space-y-3">
              <InfoRow
                label="Revenu net mensuel"
                value={candidate.ownerInsights?.financial?.monthlyIncomeLabel || formatCurrency(candidate.financialSummary?.monthlyNetIncome)}
              />
              <InfoRow
                label="Reste à vivre"
                value={candidate.ownerInsights?.financial?.remainingIncomeLabel || formatCurrency(candidate.financialSummary?.remainingIncome)}
              />
              <InfoRow
                label="Taux d'effort"
                value={candidate.ownerInsights?.financial?.effortRateLabel || '—'}
              />
              <InfoRow
                label="Bande de risque"
                value={candidate.ownerInsights?.financial?.riskBand?.label || candidate.financialSummary?.riskLevel || '—'}
              />
              {candidate.ownerInsights?.financial?.summary && (
                <div className="rounded-[1.15rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm leading-6 text-slate-600">{candidate.ownerInsights.financial.summary}</p>
                </div>
              )}
            </div>
          </PremiumSurface>
        </div>

        {/* ── Right column (5/12) ── */}
        <div className="space-y-6 xl:col-span-5">
          {/* Signals */}
          <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-slate-50/70">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Points saillants</div>
            <SignalList
              className="mt-4"
              items={signals.length > 0 ? signals : [{
                id: 'clear',
                title: 'Lecture favorable',
                description: 'Aucun blocage critique remonté sur ce dossier.',
                tone: 'success',
              }]}
            />
          </PremiumSurface>

          {/* Guarantee */}
          <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Garantie</div>
            <div className="mt-4 space-y-3">
              <InfoRow label="Mode" value={candidate.ownerInsights?.guarantee?.label || 'Sans garant'} />
              {candidate.ownerInsights?.guarantee?.status && (
                <InfoRow label="Statut" value={candidate.ownerInsights.guarantee.status} />
              )}
              {candidate.ownerInsights?.guarantee?.summary && (
                <div className="rounded-[1.15rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm leading-6 text-slate-600">{candidate.ownerInsights.guarantee.summary}</p>
                </div>
              )}
            </div>
          </PremiumSurface>

          {/* Contract readiness */}
          {candidate.ownerInsights?.contractReadiness && (
            <PremiumSurface
              padding="md"
              className={cx(
                'rounded-3xl',
                candidate.ownerInsights.contractReadiness.ready
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
              )}
            >
              <div className="flex items-center gap-2">
                {candidate.ownerInsights.contractReadiness.ready ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                ) : (
                  <Shield className="h-5 w-5 text-amber-700" />
                )}
                <span className="text-sm font-semibold text-slate-900">
                  {candidate.ownerInsights.contractReadiness.ready ? 'Prêt au bail' : 'Pas encore prêt au bail'}
                </span>
              </div>
              {(candidate.ownerInsights.contractReadiness.blockers || []).length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-amber-800">
                  {candidate.ownerInsights.contractReadiness.blockers!.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </PremiumSurface>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/*  AUDIT TIMELINE                                           */}
      {/* ══════════════════════════════════════════════════════════ */}
      <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">Chronologie d&apos;audit</div>
        <TimelineBlock
          className="mt-5"
          items={timelineItems.length > 0 ? timelineItems : [{
            id: 'pending',
            title: 'Timeline en attente',
            description: 'La chronologie sera enrichie au fil des contrôles.',
          }]}
        />
      </PremiumSurface>

      {/* ── Mobile sticky actions ── */}
      <div className="sticky bottom-4 z-20 lg:hidden">
        <PremiumSurface padding="sm" className="rounded-3xl border-slate-200 bg-white/95 backdrop-blur-xl">
          <ActionBar className="justify-center gap-2">
            {!isSealed && !isOwnerSelected && canChangeSelection && (
              <button
                type="button"
                disabled={selectionBusy}
                onClick={handleChoose}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
              >
                <Crown className="h-4 w-4 text-amber-300" />
                {selectionBusy ? 'Sélection...' : 'Choisir ce dossier'}
              </button>
            )}
            {!isSealed && isOwnerSelected && (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/owner/property/${propertyId}?tab=selected&applicationId=${candidate.id}`)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
              >
                <ScrollText className="h-4 w-4" />
                Module contrat
              </button>
            )}
            {isSealed && (
              <button
                type="button"
                onClick={() => setCheckoutOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
              >
                <Lock className="h-4 w-4 text-amber-300" />
                Déverrouiller
              </button>
            )}
          </ActionBar>
        </PremiumSurface>
      </div>
    </motion.div>
  );
}
