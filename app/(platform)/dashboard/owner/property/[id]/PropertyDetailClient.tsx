'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  Lock,
  ScrollText,
  Shield,
} from 'lucide-react';

import CheckoutModal from '@/app/components/CheckoutModal';
import {
  ActionBar,
  EmptyState,
  InfoRow,
  PremiumSectionHeader,
  PremiumSurface,
  QuickStat,
  StatusBadge,
} from '@/app/components/ui/premium';
import CandidateComparisonMatrix from '../../components/CandidateComparisonMatrix';

// ─── Types ───────────────────────────────────────────────────────────────────

type PropertyRecord = {
  _id?: string;
  name?: string;
  address?: string;
  applyToken?: string;
  rentAmount?: number;
  chargesAmount?: number;
  surfaceM2?: number;
  managed?: boolean;
  archived?: boolean;
  status?: string;
  acceptedTenantId?: string | null;
  isRented?: boolean;
  flow?: {
    stage: 'search' | 'analysis' | 'selection' | 'contract' | 'management';
    stageLabel: string;
    stageTone: string;
    progress: number;
    unlocked?: boolean;
    summary: string;
    compareHref?: string;
    nextAction: { id: string; label: string; description?: string; href: string; kind: string; applicationId?: string | null };
    focusCard?: { title: string; reason: string; summary: string };
    guidance?: { currentStage: { id: string; label: string; tip: string; progress: number }; contextualAdvice: string; whyThisStage: string };
    selectionState?: {
      mode: 'empty' | 'review' | 'compare' | 'selected';
      defaultTab: 'overview' | 'compare' | 'selected';
      compareHref: string;
      selectedCandidateId?: string | null;
      selectedCandidateLabel?: string | null;
      selectionReason?: string | null;
      finalistsCount: number;
      otherCandidatesCount: number;
      headline: string;
      body: string;
      primaryAction?: { label: string; href: string; kind: string } | null;
    };
    sealedCount: number;
    readyToContractCount: number;
    totalCandidates: number;
    alerts: string[];
    blockers: string[];
    managementSummary: {
      tenantLabel: string;
      leaseStatusLabel: string;
      documentsLabel: string;
      nextMilestone: string;
      nextActions: string[];
      summary: string;
    };
  };
  managementTools?: {
    leaseId?: string | null;
    signatureStatus?: string;
    edlStatus?: string;
    vaultDocuments?: Array<{
      id: string;
      label: string;
      status: string;
      kind: string;
      fileName?: string | null;
      downloadUrl?: string | null;
    }>;
  } | null;
};

type CandidateRecord = {
  id: string;
  rank?: number;
  isTop3?: boolean;
  isOwnerSelected?: boolean;
  isUnlocked?: boolean;
  isSealed?: boolean;
  sealedLabel?: string;
  sealedId?: string;
  profile?: { firstName?: string; lastName?: string; email?: string | null };
  patrimometer?: { score?: number; grade?: string };
  ownerInsights?: {
    aiAudit?: { status?: string; summary?: string; blockers?: string[]; reviewReasons?: string[] };
    financial?: { monthlyIncomeLabel?: string | null; remainingIncomeLabel?: string | null; effortRateLabel?: string | null };
    quality?: { status?: { label?: string; tone?: string }; score?: number };
    contractReadiness?: { ready?: boolean };
    guarantee?: { label?: string };
    decisionSummary?: {
      headline?: string;
      strengths?: string[];
      watchouts?: string[];
      identityVerified?: boolean;
      readyToLease?: boolean;
      riskLabel?: string;
    };
    comparison?: {
      scoreValue?: number;
      scoreLabel?: string;
      identityVerified?: boolean;
      identityVerifiedLabel?: string;
      monthlyIncomeLabel?: string;
      remainingIncomeLabel?: string;
      effortRateLabel?: string;
      qualityLabel?: string;
      qualityScore?: number;
      guaranteeLabel?: string;
      readyToLease?: boolean;
      readyToLeaseLabel?: string;
      riskLabel?: string;
      auditLabel?: string;
      masked?: boolean;
    };
  } | null;
  passport?: { previewUrl?: string | null; shareUrl?: string | null };
  documentsCount?: number;
  certifiedDocumentsCount?: number;
};

type CheckoutTarget = { propertyLabel: string; candidateCount: number } | null;
type Tab = 'overview' | 'passports' | 'compare' | 'selection';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value?: number | null, fallback = '—') {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function candidateName(candidate?: CandidateRecord | null) {
  if (!candidate) return 'Candidat';
  if (candidate.isSealed) return candidate.sealedLabel || candidate.sealedId || 'Profil masqué';
  return [candidate.profile?.firstName, candidate.profile?.lastName].filter(Boolean).join(' ').trim() || 'Candidat';
}

function resolveStageTone(tone?: string) {
  if (tone === 'success') return 'success' as const;
  if (tone === 'warning') return 'warning' as const;
  if (tone === 'danger') return 'danger' as const;
  if (tone === 'dark') return 'dark' as const;
  if (tone === 'info') return 'info' as const;
  return 'neutral' as const;
}

const GRADE_BG: Record<string, string> = {
  SOUVERAIN: 'bg-gradient-to-br from-amber-400 to-amber-600',
  A: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
  B: 'bg-gradient-to-br from-blue-400 to-blue-600',
  C: 'bg-gradient-to-br from-cyan-400 to-cyan-600',
  D: 'bg-gradient-to-br from-slate-400 to-slate-600',
  E: 'bg-gradient-to-br from-orange-400 to-orange-600',
  F: 'bg-gradient-to-br from-red-400 to-red-600',
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-5 pb-12">
      <div className="h-64 rounded-[2rem] bg-slate-100" />
      <div className="h-20 rounded-[1.75rem] bg-slate-100" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 w-28 rounded-xl bg-slate-100" />)}
      </div>
      <div className="h-48 rounded-3xl bg-slate-100" />
    </div>
  );
}

// ─── Stage Pipeline ───────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'search', num: 'I', label: 'Recherche' },
  { id: 'analysis', num: 'II', label: 'Analyse' },
  { id: 'selection', num: 'III', label: 'Sélection' },
  { id: 'contract', num: 'IV', label: 'Contrat' },
  { id: 'management', num: 'V', label: 'Gestion' },
] as const;

function StagePipeline({ currentStage }: { currentStage?: string }) {
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.id === currentStage);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-5">
      {/* Desktop */}
      <div className="hidden items-center sm:flex">
        {PIPELINE_STAGES.map((stage, index) => {
          const isCompleted = index < safeIndex;
          const isActive = index === safeIndex;

          return (
            <Fragment key={stage.id}>
              <div className="flex flex-col items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                  isCompleted
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/30'
                    : isActive
                    ? 'border-2 border-amber-400 bg-white ring-4 ring-amber-100 shadow-md'
                    : 'border border-slate-200 bg-slate-50'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  ) : (
                    <span className={`text-xs font-bold ${isActive ? 'text-amber-600' : 'text-slate-400'}`}>
                      {stage.num}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.06em] ${
                    isActive ? 'text-slate-900'
                    : isCompleted ? 'text-emerald-700'
                    : 'text-slate-400'
                  }`}>
                    {stage.label}
                  </span>
                  {isActive && (
                    <motion.div
                      className="mt-0.5 h-0.5 w-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500"
                      initial={{ scaleX: 0, originX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.45 }}
                    />
                  )}
                </div>
              </div>

              {index < PIPELINE_STAGES.length - 1 && (
                <div className="relative mx-3 h-px flex-1">
                  <div className="absolute inset-0 rounded-full bg-slate-200" />
                  {isCompleted && (
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.35, delay: index * 0.08 }}
                    />
                  )}
                  {isActive && (
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-amber-400"
                      initial={{ width: 0 }}
                      animate={{ width: '50%' }}
                      transition={{ duration: 0.35 }}
                    />
                  )}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="flex items-center justify-between sm:hidden">
        <span className="text-sm font-bold text-slate-900">
          Étape {safeIndex + 1}/5 &middot; {PIPELINE_STAGES[safeIndex]?.label}
        </span>
        <div className="flex gap-1">
          {PIPELINE_STAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-5 rounded-full ${
                i < safeIndex ? 'bg-emerald-500'
                : i === safeIndex ? 'bg-amber-400'
                : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview' as Tab, label: "Vue d'ensemble", Icon: Building2 },
  { id: 'passports' as Tab, label: 'Passeports', Icon: FileText },
  { id: 'compare' as Tab, label: 'Comparer', Icon: Shield },
  { id: 'selection' as Tab, label: 'Sélection', Icon: CheckCircle2 },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function PropertyDetailClient({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';

  const [property, setProperty] = useState<PropertyRecord | null>(null);
  const [candidatures, setCandidatures] = useState<CandidateRecord[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget>(null);
  const [copied, setCopied] = useState(false);
  const [selectionBusyId, setSelectionBusyId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
  const [unlockPolling, setUnlockPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/owner/properties/${propertyId}`, { cache: 'no-store' }),
        fetch(`/api/owner/properties/${propertyId}/candidatures`, { cache: 'no-store' }),
      ]);
      const pData = pRes.ok ? await pRes.json() : null;
      const cData = cRes.ok ? await cRes.json() : { candidatures: [], unlocked: false };
      setProperty(pData);
      setCandidatures(Array.isArray(cData?.candidatures) ? cData.candidatures : []);
      setUnlocked(Boolean(cData?.unlocked));
      return Boolean(cData?.unlocked);
    } catch {
      setProperty(null);
      setCandidatures([]);
      return false;
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!checkoutSuccess) return;
    let attempts = 0;
    const maxAttempts = 10;
    setUnlockPolling(true);

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(`/api/owner/properties/${propertyId}/candidatures`, { cache: 'no-store' });
        const data = res.ok ? await res.json() : {};
        if (data.unlocked) {
          setUnlocked(true);
          setCandidatures(Array.isArray(data.candidatures) ? data.candidatures : []);
          setUnlockPolling(false);
          return;
        }
      } catch {
        // noop
      }
      if (attempts < maxAttempts) {
        pollRef.current = setTimeout(poll, 3000);
      } else {
        setUnlockPolling(false);
      }
    }

    poll();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [checkoutSuccess, propertyId]);

  const sorted = useMemo(() => {
    return [...candidatures].sort((a, b) => {
      const aRank = Number(a.rank || 999);
      const bRank = Number(b.rank || 999);
      if (aRank !== bRank) return aRank - bRank;
      return Number(b.patrimometer?.score || 0) - Number(a.patrimometer?.score || 0);
    });
  }, [candidatures]);

  const ownerSelected = sorted.find((c) => c.isOwnerSelected)
    || sorted.find((c) => property?.acceptedTenantId && String(c.id) === String(property.acceptedTenantId))
    || null;

  const finalists = sorted.slice(0, 3);
  const otherCandidates = sorted.slice(3);
  const showManagement = property?.flow?.stage === 'management' || property?.isRented;
  const selectionState = property?.flow?.selectionState;

  const requestedTab = searchParams.get('tab');
  const currentTab = useMemo((): Tab => {
    if (requestedTab === 'passports') return 'passports';
    if (requestedTab === 'compare') return 'compare';
    if (requestedTab === 'selected') return 'selection';
    if (selectionState?.defaultTab === 'compare') return 'compare';
    if (selectionState?.defaultTab === 'selected' && ownerSelected) return 'selection';
    return 'overview';
  }, [requestedTab, selectionState?.defaultTab, ownerSelected]);

  const openUnlockModal = () => {
    setCheckoutTarget({
      propertyLabel: property?.address || property?.name || 'ce bien',
      candidateCount: Number(property?.flow?.sealedCount || sorted.filter((c) => c.isSealed).length || 0),
    });
  };

  const handleCopyLink = async () => {
    if (!property?.applyToken) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/apply/${property.applyToken}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // noop
    }
  };

  const goToTab = (tab: Tab, applicationId?: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab === 'selection' ? 'selected' : tab);
    if (applicationId) params.set('applicationId', applicationId);
    else params.delete('applicationId');
    router.replace(`/dashboard/owner/property/${propertyId}?${params.toString()}`);
  };

  const handleRequestChoose = (candidateId: string) => {
    setPendingSelectionId(candidateId);
    if (currentTab !== 'compare') goToTab('compare', candidateId);
  };

  const handleConfirmChoose = async () => {
    if (!pendingSelectionId) return;
    setSelectionBusyId(pendingSelectionId);
    setSelectionError(null);
    try {
      const res = await fetch(`/api/owner/properties/${propertyId}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: pendingSelectionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Impossible de sélectionner ce dossier.');
      setPendingSelectionId(null);
      await loadData();
      goToTab('selection', pendingSelectionId);
    } catch (err) {
      setSelectionError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setSelectionBusyId(null);
    }
  };

  const launchContractDesk = () => {
    if (!ownerSelected) return;
    if (ownerSelected.isSealed) { openUnlockModal(); return; }
    router.push(`/properties/${propertyId}/contract?applicationId=${encodeURIComponent(ownerSelected.id)}`);
  };

  if (loading) return <Skeleton />;

  if (!property) {
    return (
      <EmptyState
        title="Bien introuvable"
        description="La fiche de ce bien n'est pas accessible."
        action={
          <Link href="/dashboard/owner" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
        }
      />
    );
  }

  const primaryAction = selectionState?.primaryAction;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-12">
      <CheckoutModal
        open={Boolean(checkoutTarget)}
        onClose={() => setCheckoutTarget(null)}
        propertyId={propertyId}
        propertyLabel={checkoutTarget?.propertyLabel || ''}
        candidateCount={checkoutTarget?.candidateCount || 0}
        unlockScope="property"
      />

      {/* ── Banners ─────────────────────────────────────────────────── */}
      {checkoutSuccess && (
        <div className="flex items-start gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <p className="font-semibold text-emerald-950">
              {unlocked ? 'Accès complet activé' : unlockPolling ? 'Activation en cours…' : 'Paiement reçu'}
            </p>
            <p className="mt-0.5 text-sm text-emerald-800">
              {unlocked
                ? 'Les passeports complets sont maintenant accessibles.'
                : unlockPolling
                ? 'Synchronisation en cours, quelques secondes.'
                : "Rechargez dans quelques instants si les passeports ne s'affichent pas encore."}
            </p>
          </div>
        </div>
      )}

      {selectionError && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-3">
          <p className="text-sm font-medium text-rose-700">{selectionError}</p>
        </div>
      )}

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
        <Link
          href="/dashboard/owner"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au portefeuille
        </Link>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <Building2 className="h-5 w-5 text-emerald-800" />
          </div>
          <div className="min-w-0 flex-1">
            <ActionBar className="mb-3 gap-2">
              <StatusBadge
                tone={resolveStageTone(property.flow?.stageTone)}
                label={property.flow?.stageLabel || 'Pipeline'}
                className="normal-case tracking-normal text-[11px] font-semibold"
              />
              {ownerSelected && (
                <StatusBadge tone="success" label="Locataire retenu" className="normal-case tracking-normal text-[11px] font-semibold" />
              )}
            </ActionBar>
            <h1 className="break-words font-serif text-3xl tracking-tight text-slate-950 sm:text-4xl">
              {property.address || property.name || 'Actif'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {formatCurrency(property.rentAmount)} HC
              {Number(property.chargesAmount || 0) > 0 ? ` + ${formatCurrency(property.chargesAmount)} charges` : ''}
              {property.surfaceM2 ? ` · ${property.surfaceM2} m²` : ''}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickStat label="Passeports" value={property.flow?.totalCandidates || 0} />
          <QuickStat label="Finalistes" value={selectionState?.finalistsCount || 0} />
          <QuickStat label="Masqués" value={property.flow?.sealedCount || 0} />
          <QuickStat label="Prêts au bail" value={property.flow?.readyToContractCount || 0} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={!property.applyToken}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {copied ? <Copy className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? 'Sésame copié !' : 'Copier le Sésame candidat'}
          </button>
          {primaryAction && (
            <button
              type="button"
              onClick={() => {
                if (primaryAction.kind === 'unlock') { openUnlockModal(); return; }
                router.push(primaryAction.href || `/dashboard/owner/property/${propertyId}`);
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              {primaryAction.kind === 'unlock' ? <Lock className="h-4 w-4 text-amber-500" /> : <Shield className="h-4 w-4" />}
              {primaryAction.label}
            </button>
          )}
        </div>
      </div>

      {/* ── STAGE PIPELINE ──────────────────────────────────────────── */}
      <StagePipeline currentStage={property.flow?.stage} />

      {/* ── TABS ────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => goToTab(id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-6 py-3 text-sm font-medium transition-all ${
              currentTab === id
                ? 'bg-slate-950 text-white shadow-lg'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === 'passports' && sorted.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                currentTab === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {sorted.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB : VUE D'ENSEMBLE ────────────────────────────────────── */}
      {currentTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Contexte de l&apos;étape
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {property.flow?.guidance?.whyThisStage || property.flow?.focusCard?.reason || property.flow?.summary}
            </p>
            {(property.flow?.alerts || []).length > 0 && (
              <div className="mt-4 space-y-2">
                {property.flow?.alerts?.map((alert) => (
                  <div key={alert} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-slate-700">
                    {alert}
                  </div>
                ))}
              </div>
            )}
          </PremiumSurface>

          {property.applyToken && (
            <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Sésame candidat
              </div>
              <code className="mt-4 block break-all rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-sm text-slate-700">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/apply/${property.applyToken}`
                  : `/apply/${property.applyToken}`}
              </code>
              <ActionBar className="mt-4 gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copié !' : 'Copier'}
                </button>
                <button
                  type="button"
                  onClick={() => window.open(`/apply/${property.applyToken}`, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Voir la page candidat
                </button>
              </ActionBar>
            </PremiumSurface>
          )}
        </motion.div>
      )}

      {/* ── TAB : PASSEPORTS ────────────────────────────────────────── */}
      {currentTab === 'passports' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <PremiumSurface padding="md" className="overflow-hidden rounded-3xl border-slate-200 bg-white">
            <PremiumSectionHeader
              eyebrow="Passeports reçus"
              title={`${sorted.length} candidature${sorted.length !== 1 ? 's' : ''}`}
            />
            {sorted.length > 0 ? (
              <div className="mt-6 divide-y divide-slate-100">
                {sorted.map((candidate) => {
                  const grade = candidate.patrimometer?.grade;
                  const gradeBg = grade ? (GRADE_BG[grade] || GRADE_BG.F) : null;
                  const initials = [candidate.profile?.firstName?.[0], candidate.profile?.lastName?.[0]]
                    .filter(Boolean).join('').toUpperCase();

                  return (
                    <div
                      key={candidate.id}
                      className="flex flex-col gap-4 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center"
                    >
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        candidate.isSealed ? 'bg-slate-100' : 'border border-emerald-100 bg-emerald-50'
                      }`}>
                        {candidate.isSealed
                          ? <Lock className="h-5 w-5 text-slate-400" />
                          : <span className="text-sm font-bold text-emerald-700">{initials || '?'}</span>}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{candidateName(candidate)}</p>
                        <p className="text-sm text-slate-500">
                          {candidate.ownerInsights?.decisionSummary?.headline
                            || candidate.ownerInsights?.financial?.monthlyIncomeLabel
                            || 'Profil en attente de lecture'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {candidate.rank != null && (
                          <StatusBadge tone="neutral" label={`#${candidate.rank}`} className="normal-case tracking-normal text-[11px] font-semibold" />
                        )}
                        {candidate.isOwnerSelected && (
                          <StatusBadge tone="success" label="Retenu" className="normal-case tracking-normal text-[11px] font-semibold" />
                        )}
                        {grade && !candidate.isSealed && gradeBg && (
                          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white ${gradeBg}`}>
                            {grade === 'SOUVERAIN' ? '👑' : grade}
                          </span>
                        )}
                      </div>

                      {candidate.isSealed ? (
                        <button
                          type="button"
                          onClick={openUnlockModal}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
                        >
                          <Lock className="h-4 w-4" /> Déverrouiller
                        </button>
                      ) : (
                        <Link
                          href={`/dashboard/owner/property/${propertyId}/candidate/${candidate.id}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Voir le dossier <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState
                  icon={<FileText className="h-7 w-7 text-slate-300" />}
                  title="Aucun passeport reçu"
                  description="Partagez le Sésame candidat depuis Vue d'ensemble pour recevoir des dossiers."
                />
              </div>
            )}
          </PremiumSurface>
        </motion.div>
      )}

      {/* ── TAB : COMPARER ──────────────────────────────────────────── */}
      {currentTab === 'compare' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <PremiumSectionHeader
            eyebrow="Comparaison"
            title="Décider sur des critères stables"
          />
          {finalists.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-7 w-7 text-slate-300" />}
              title="Aucun finaliste à comparer"
              description="Revenez sur Vue d'ensemble pour partager le Sésame candidat."
            />
          ) : (
            <CandidateComparisonMatrix
              propertyId={propertyId}
              candidates={finalists}
              otherCandidates={otherCandidates}
              selectedCandidateId={ownerSelected?.id || null}
              pendingCandidateId={pendingSelectionId}
              selectionBusyId={selectionBusyId}
              canChangeSelection={!['LEASE_IN_PROGRESS', 'OCCUPIED'].includes(String(property.status || '').toUpperCase())}
              onRequestChoose={handleRequestChoose}
              onConfirmChoose={handleConfirmChoose}
              onCancelChoose={() => setPendingSelectionId(null)}
              onUnlock={openUnlockModal}
            />
          )}
        </motion.div>
      )}

      {/* ── TAB : SÉLECTION ─────────────────────────────────────────── */}
      {currentTab === 'selection' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <PremiumSectionHeader
            eyebrow="Sélection confirmée"
            title="Locataire retenu"
          />
          {ownerSelected ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <PremiumSurface padding="lg" className="rounded-3xl border-emerald-200 bg-emerald-50">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                      Locataire retenu
                    </div>
                    <h3 className="mt-2 font-serif text-3xl tracking-tight text-emerald-950">
                      {candidateName(ownerSelected)}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-emerald-900/85">
                      {selectionState?.selectionReason || ownerSelected.ownerInsights?.decisionSummary?.headline || 'Le choix a été confirmé pour ce bien.'}
                    </p>
                  </div>
                </div>
                {(ownerSelected.ownerInsights?.decisionSummary?.strengths || []).length > 0 && (
                  <div className="mt-6 space-y-2">
                    {ownerSelected.ownerInsights?.decisionSummary?.strengths?.slice(0, 4).map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm text-emerald-950">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </PremiumSurface>

              <PremiumSurface padding="lg" className="rounded-3xl border-slate-200 bg-white">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Suite du tunnel
                </div>
                <div className="mt-5 space-y-3">
                  <InfoRow label="Score de confiance" value={ownerSelected.ownerInsights?.comparison?.scoreLabel || '—'} />
                  <InfoRow label="Garantie" value={ownerSelected.ownerInsights?.comparison?.guaranteeLabel || '—'} />
                  <InfoRow label="Prêt pour le bail" value={ownerSelected.ownerInsights?.comparison?.readyToLeaseLabel || '—'} />
                </div>
                <ActionBar className="mt-6 gap-3">
                  <button
                    type="button"
                    onClick={launchContractDesk}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <ScrollText className="h-4 w-4" /> Préparer le bail
                  </button>
                  <button
                    type="button"
                    onClick={() => goToTab('compare', ownerSelected.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Revoir la comparaison
                  </button>
                </ActionBar>
              </PremiumSurface>
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="h-7 w-7 text-slate-300" />}
              title="Aucun locataire sélectionné"
              description="Comparez les finalistes depuis l'onglet Comparer, puis confirmez votre choix."
              action={
                <button
                  type="button"
                  onClick={() => goToTab('compare')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                >
                  <Shield className="h-4 w-4" /> Comparer les finalistes
                </button>
              }
            />
          )}
        </motion.div>
      )}

      {/* ── GESTION LOCATIVE ────────────────────────────────────────── */}
      {showManagement && (
        <section className="space-y-4">
          <PremiumSectionHeader
            eyebrow="Gestion locative"
            title="L&apos;essentiel reste accessible"
          />
          <div className="grid gap-4 xl:grid-cols-3">
            <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
              <InfoRow label="Locataire" value={property.flow?.managementSummary?.tenantLabel || candidateName(ownerSelected)} />
            </PremiumSurface>
            <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
              <InfoRow label="Bail" value={property.managementTools?.signatureStatus || property.flow?.managementSummary?.leaseStatusLabel || 'Prospection'} />
            </PremiumSurface>
            <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
              <InfoRow label="Prochaine étape" value={property.flow?.managementSummary?.nextMilestone || 'Aucune échéance'} />
            </PremiumSurface>
          </div>

          <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-slate-50/70">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Coffre-Fort documentaire
            </div>
            <div className="mt-5 space-y-3">
              {(property.managementTools?.vaultDocuments || []).length > 0 ? (
                property.managementTools?.vaultDocuments?.map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{doc.label}</div>
                      <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{doc.status}</div>
                    </div>
                    {doc.downloadUrl ? (
                      <a href={doc.downloadUrl} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <FileText className="h-4 w-4" /> Ouvrir
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-400">
                        <Lock className="h-4 w-4" /> En attente
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-sm text-slate-500">
                  Aucun document archivé.
                </div>
              )}
            </div>
          </PremiumSurface>
        </section>
      )}
    </motion.div>
  );
}
