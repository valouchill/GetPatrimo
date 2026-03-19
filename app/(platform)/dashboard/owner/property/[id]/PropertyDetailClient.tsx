'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Loader2,
  Lock,
  ScrollText,
  Shield,
} from 'lucide-react';

import CheckoutModal from '@/app/components/CheckoutModal';
import {
  ActionBar,
  EmptyState,
  InfoRow,
  MetricTile,
  PremiumSectionHeader,
  PremiumSurface,
  StatusBadge,
} from '@/app/components/ui/premium';
import CandidateComparisonMatrix from '../../components/CandidateComparisonMatrix';
import PropertyJourneyStrip from '../../components/PropertyJourneyStrip';

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
    focusCard?: {
      title: string;
      reason: string;
      summary: string;
    };
    guidance?: {
      currentStage: { id: string; label: string; tip: string; progress: number };
      contextualAdvice: string;
      whyThisStage: string;
    };
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

function stageTone(tone?: string) {
  if (tone === 'success') return 'success' as const;
  if (tone === 'warning') return 'warning' as const;
  if (tone === 'danger') return 'danger' as const;
  if (tone === 'dark') return 'dark' as const;
  if (tone === 'info') return 'info' as const;
  return 'neutral' as const;
}

const JOURNEY_ITEMS = [
  { id: 'overview', label: 'Vue d’ensemble', caption: 'Lire le contexte du bien' },
  { id: 'receive', label: 'Recevoir des dossiers', caption: 'Partager le lien candidat' },
  { id: 'compare', label: 'Comparer les finalistes', caption: 'Arbitrer sur des critères stables' },
  { id: 'selected', label: 'Sélection confirmée', caption: 'Passer ensuite au bail' },
] as const;

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
    return [...candidatures].sort((left, right) => {
      const leftRank = Number(left.rank || 999);
      const rightRank = Number(right.rank || 999);
      if (leftRank !== rightRank) return leftRank - rightRank;
      return Number(right.patrimometer?.score || 0) - Number(left.patrimometer?.score || 0);
    });
  }, [candidatures]);

  const ownerSelected = sorted.find((candidate) => candidate.isOwnerSelected)
    || sorted.find((candidate) => property?.acceptedTenantId && String(candidate.id) === String(property.acceptedTenantId))
    || null;

  const finalists = sorted.slice(0, 3);
  const otherCandidates = sorted.slice(3);
  const showManagement = property?.flow?.stage === 'management' || property?.isRented;
  const selectionState = property?.flow?.selectionState;

  const requestedTab = searchParams.get('tab');
  const currentTab = useMemo(() => {
    const wanted = requestedTab === 'compare' || requestedTab === 'selected' || requestedTab === 'overview'
      ? requestedTab
      : selectionState?.defaultTab || 'overview';

    if (wanted === 'selected' && !ownerSelected) {
      return selectionState?.defaultTab === 'compare' ? 'compare' : 'overview';
    }
    if (wanted === 'compare' && finalists.length === 0) return 'overview';
    return wanted;
  }, [finalists.length, ownerSelected, requestedTab, selectionState?.defaultTab]);

  const activeJourneyId = currentTab === 'selected'
    ? 'selected'
    : currentTab === 'compare'
      ? 'compare'
      : sorted.length === 0
        ? 'receive'
        : 'overview';

  const openUnlockModal = () => {
    setCheckoutTarget({
      propertyLabel: property?.address || property?.name || 'ce bien',
      candidateCount: Number(property?.flow?.sealedCount || sorted.filter((candidate) => candidate.isSealed).length || 0),
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

  const goToTab = (tab: 'overview' | 'compare' | 'selected', applicationId?: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (applicationId) params.set('applicationId', applicationId); else params.delete('applicationId');
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
      goToTab('selected', pendingSelectionId);
    } catch (err) {
      setSelectionError(err instanceof Error ? err.message : 'Erreur.');
    } finally {
      setSelectionBusyId(null);
    }
  };

  const launchContractDesk = () => {
    if (!ownerSelected) return;
    if (ownerSelected.isSealed) {
      openUnlockModal();
      return;
    }
    router.push(`/properties/${propertyId}/contract?applicationId=${encodeURIComponent(ownerSelected.id)}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!property) {
    return (
      <EmptyState
        title="Bien introuvable"
        description="La fiche de ce bien n'est pas accessible."
        action={
          <Link href="/dashboard/owner" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        }
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      <CheckoutModal
        open={Boolean(checkoutTarget)}
        onClose={() => setCheckoutTarget(null)}
        propertyId={propertyId}
        propertyLabel={checkoutTarget?.propertyLabel || ''}
        candidateCount={checkoutTarget?.candidateCount || 0}
        unlockScope="property"
      />

      {checkoutSuccess ? (
        <PremiumSurface padding="md" className="rounded-3xl border-emerald-200 bg-emerald-50">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
              {unlockPolling ? <Loader2 className="h-5 w-5 animate-spin text-emerald-700" /> : <CheckCircle2 className="h-5 w-5 text-emerald-700" />}
            </div>
            <div>
              <h2 className="font-serif text-2xl tracking-tight text-emerald-950">
                {unlocked ? 'Accès complet activé' : unlockPolling ? 'Activation en cours...' : 'Paiement reçu'}
              </h2>
              <p className="mt-2 text-sm text-emerald-800">
                {unlocked
                  ? 'Les dossiers complets sont maintenant accessibles pour ce bien.'
                  : unlockPolling
                    ? 'Le déverrouillage est en cours de synchronisation.'
                    : 'Rechargez la page dans quelques instants si le détail complet n’apparaît pas encore.'}
              </p>
            </div>
          </div>
        </PremiumSurface>
      ) : null}

      {selectionError ? (
        <PremiumSurface padding="sm" className="rounded-3xl border-rose-200 bg-rose-50">
          <p className="text-sm font-medium text-rose-700">{selectionError}</p>
        </PremiumSurface>
      ) : null}

      <PremiumSurface tone="hero" padding="lg" className="rounded-[2.25rem] border-stone-200/80">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_auto] xl:items-start">
          <div className="min-w-0">
            <Link href="/dashboard/owner" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-4 w-4" />
              Retour au portefeuille
            </Link>

            <div className="mt-5 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75">
                <Building2 className="h-6 w-6 text-emerald-900" />
              </div>
              <div className="min-w-0">
                <ActionBar className="gap-2">
                  <StatusBadge tone={stageTone(property.flow?.stageTone)} label={property.flow?.stageLabel || 'Pipeline'} className="normal-case tracking-normal text-[11px] font-semibold" />
                  {property.flow?.selectionState?.mode === 'selected' ? (
                    <StatusBadge tone="success" label="Locataire retenu" className="normal-case tracking-normal text-[11px] font-semibold" />
                  ) : null}
                </ActionBar>
                <h1 className="mt-4 break-words font-serif text-[2.45rem] tracking-tight text-slate-950 sm:text-[3rem]">
                  {property.address || property.name || 'Bien'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {formatCurrency(property.rentAmount)} HC
                  {Number(property.chargesAmount || 0) > 0 ? ` + ${formatCurrency(property.chargesAmount)} charges` : ''}
                  {property.surfaceM2 ? ` · ${property.surfaceM2} m²` : ''}
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
                  {property.flow?.selectionState?.headline || property.flow?.focusCard?.title || property.flow?.summary}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:w-[240px]">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!property.applyToken}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              {copied ? 'Lien copié' : 'Copier le lien candidat'}
            </button>

            {property.flow?.selectionState?.primaryAction ? (
              <button
                type="button"
                onClick={() => {
                  if (property.flow?.selectionState?.primaryAction?.kind === 'unlock') {
                    openUnlockModal();
                  } else {
                    router.push(property.flow?.selectionState?.primaryAction?.href || property.flow?.nextAction?.href || `/dashboard/owner/property/${propertyId}`);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                {property.flow?.selectionState?.primaryAction?.kind === 'unlock' ? <Lock className="h-4 w-4 text-amber-300" /> : <ArrowLeft className="h-4 w-4 rotate-180" />}
                {property.flow.selectionState.primaryAction.label}
              </button>
            ) : null}
          </div>
        </div>
      </PremiumSurface>

      <PropertyJourneyStrip
        items={JOURNEY_ITEMS as unknown as { id: string; label: string; caption?: string }[]}
        activeId={activeJourneyId}
        onSelect={(id) => {
          if (id === 'overview' || id === 'receive') {
            goToTab('overview', sorted[0]?.id || null);
            return;
          }
          if (id === 'compare') {
            goToTab('compare', finalists[0]?.id || null);
            return;
          }
          if (ownerSelected) {
            goToTab('selected', ownerSelected.id);
          }
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Dossiers reçus" value={property.flow?.totalCandidates || 0} caption="Entrées du bien" />
        <MetricTile label="Dossiers comparables" value={selectionState?.finalistsCount || 0} caption="Finalistes visibles" />
        <MetricTile label="Dossiers masqués" value={property.flow?.sealedCount || 0} caption="Accès complet optionnel" />
        <MetricTile label="Prêts pour le bail" value={property.flow?.readyToContractCount || 0} caption="Après choix explicite" />
      </div>

      <section className="space-y-6">
        <PremiumSectionHeader
          eyebrow="Vue d’ensemble"
          title="Comprendre le bien avant de décider"
          description={property.flow?.summary || 'L’espace vous guide du premier dossier jusqu’à la sélection confirmée.'}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Pourquoi cette étape
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {property.flow?.guidance?.whyThisStage || property.flow?.focusCard?.reason || property.flow?.summary}
            </p>
            <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Conseil
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {property.flow?.guidance?.contextualAdvice || property.flow?.selectionState?.body || 'Le prochain geste utile est indiqué juste en dessous.'}
              </p>
            </div>
          </PremiumSurface>

          <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-slate-50/75">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
              Priorité active
            </div>
            <h2 className="mt-3 font-serif text-3xl tracking-tight text-slate-950">
              {property.flow?.focusCard?.title || property.flow?.selectionState?.headline || 'Étape en cours'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {property.flow?.focusCard?.reason || property.flow?.summary}
            </p>
            {(property.flow?.alerts || []).length > 0 ? (
              <div className="mt-5 space-y-3">
                {property.flow?.alerts?.map((alert) => (
                  <div key={alert} className="rounded-[1.35rem] border border-amber-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                    {alert}
                  </div>
                ))}
              </div>
            ) : null}
          </PremiumSurface>
        </div>
      </section>

      <section className="space-y-6">
        <PremiumSectionHeader
          eyebrow="Recevoir des dossiers"
          title="Lien candidat"
          description="Le dépôt de dossier démarre depuis ce lien unique. Les vérifications et le classement se font ensuite automatiquement."
        />

        {property.applyToken ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-white">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Adresse à partager
              </div>
              <code className="mt-4 block break-all rounded-[1.45rem] border border-slate-200 bg-slate-50 px-4 py-4 font-mono text-sm text-slate-700">
                {typeof window !== 'undefined' ? `${window.location.origin}/apply/${property.applyToken}` : `/apply/${property.applyToken}`}
              </code>
              <ActionBar className="mt-4 gap-2">
                <button type="button" onClick={handleCopyLink} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900">
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copié' : 'Copier'}
                </button>
                <button type="button" onClick={() => window.open(`/apply/${property.applyToken}`, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <ExternalLink className="h-4 w-4" />
                  Voir la page candidat
                </button>
              </ActionBar>
            </PremiumSurface>

            <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-slate-50/75">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Effet attendu
              </div>
              <h3 className="mt-3 font-serif text-3xl tracking-tight text-slate-950">
                Moins de friction, plus de dossiers comparables
              </h3>
              <div className="mt-5 space-y-3">
                <InfoRow label="Dossiers reçus" value={property.flow?.totalCandidates || 0} />
                <InfoRow label="Analyses prêtes" value={property.flow?.readyToContractCount || 0} />
                <InfoRow label="Étape suivante" value={property.flow?.nextAction?.label || 'Suivre le tunnel'} />
              </div>
            </PremiumSurface>
          </div>
        ) : (
          <EmptyState
            icon={<Link2 className="h-7 w-7 text-slate-300" />}
            title="Lien candidat indisponible"
            description="Le lien apparaîtra automatiquement dès que ce bien sera prêt à recevoir des dossiers."
          />
        )}
      </section>

      {currentTab === 'overview' && sorted.length > 0 ? (
        <section className="space-y-6">
          <PremiumSectionHeader
            eyebrow="Aperçu décisionnel"
            title="Voir si ce bien mérite déjà une comparaison"
            description={selectionState?.body || 'Les finalistes sont résumés ici avant d’ouvrir le comparateur complet.'}
          />

          <div className="grid gap-4 xl:grid-cols-3">
            {finalists.map((candidate) => (
              <PremiumSurface key={candidate.id} padding="md" className="rounded-3xl border-slate-200 bg-white">
                <ActionBar className="gap-2">
                  {candidate.rank ? <StatusBadge tone="neutral" label={`#${candidate.rank}`} className="normal-case tracking-normal text-[10px] font-semibold" /> : null}
                  {candidate.isOwnerSelected ? <StatusBadge tone="dark" label="Retenu" className="normal-case tracking-normal text-[10px] font-semibold" /> : null}
                  {candidate.isSealed ? <StatusBadge tone="warning" label="Masqué" className="normal-case tracking-normal text-[10px] font-semibold" /> : null}
                </ActionBar>
                <h3 className="mt-4 break-words font-serif text-2xl tracking-tight text-slate-950">
                  {candidateName(candidate)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {candidate.ownerInsights?.decisionSummary?.headline || 'Profil en attente de lecture détaillée.'}
                </p>
                <div className="mt-4 space-y-3">
                  <InfoRow label="Score de confiance" value={candidate.ownerInsights?.comparison?.scoreLabel || '—'} />
                  <InfoRow label="Garantie" value={candidate.ownerInsights?.comparison?.guaranteeLabel || '—'} />
                  <InfoRow label="Prêt pour le bail" value={candidate.ownerInsights?.comparison?.readyToLeaseLabel || '—'} />
                </div>
              </PremiumSurface>
            ))}
          </div>

          <ActionBar className="gap-3">
            <button
              type="button"
              onClick={() => goToTab('compare', finalists[0]?.id || null)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-900"
            >
              <Shield className="h-4 w-4" />
              Ouvrir le comparateur
            </button>
            {ownerSelected ? (
              <button
                type="button"
                onClick={() => goToTab('selected', ownerSelected.id)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Voir la sélection confirmée
              </button>
            ) : null}
          </ActionBar>
        </section>
      ) : null}

      {currentTab === 'compare' ? (
        <section className="space-y-6">
          <PremiumSectionHeader
            eyebrow="Comparer les finalistes"
            title="Décider avec les mêmes critères pour chaque dossier"
            description="Le comparateur rassemble uniquement les informations utiles au choix. L’analyse complète reste disponible en second niveau."
          />

          {finalists.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-7 w-7 text-slate-300" />}
              title="Aucun finaliste à comparer"
              description="Revenez à la vue d’ensemble pour partager le lien candidat ou attendre les prochains dossiers."
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
        </section>
      ) : null}

      {currentTab === 'selected' && ownerSelected ? (
        <section className="space-y-6">
          <PremiumSectionHeader
            eyebrow="Sélection confirmée"
            title="Le locataire retenu est clairement identifié"
            description="Le tunnel se referme ici côté sélection. Le prochain geste utile est de préparer le bail."
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
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

              <div className="mt-6 space-y-3">
                {(ownerSelected.ownerInsights?.decisionSummary?.strengths || []).slice(0, 4).map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-emerald-950">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
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
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  <ScrollText className="h-4 w-4" />
                  Préparer le bail
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
        </section>
      ) : null}

      {showManagement ? (
        <section className="space-y-6">
          <PremiumSectionHeader
            eyebrow="Gestion locative"
            title="L’essentiel reste accessible"
            description="Le lot de refonte s’arrête à la sélection, mais les outils de gestion déjà en place restent disponibles ici."
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
              Coffre-fort documentaire
            </div>
            <div className="mt-5 space-y-3">
              {(property.managementTools?.vaultDocuments || []).length > 0 ? (
                property.managementTools?.vaultDocuments?.map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-950">{doc.label}</div>
                      <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">{doc.status}</div>
                    </div>
                    {doc.downloadUrl ? (
                      <a href={doc.downloadUrl} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <FileText className="h-4 w-4" />
                        Ouvrir
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-400">
                        <Lock className="h-4 w-4" />
                        En attente
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-white/70 px-4 py-5 text-sm text-slate-500">
                  Aucun document archivé.
                </div>
              )}
            </div>
          </PremiumSurface>
        </section>
      ) : null}
    </motion.div>
  );
}
