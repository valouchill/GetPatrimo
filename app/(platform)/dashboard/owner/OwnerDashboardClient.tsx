'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Lock,
  Shield,
} from 'lucide-react';

import CheckoutModal from '@/app/components/CheckoutModal';
import {
  ActionBar,
  EmptyState,
  PremiumSectionHeader,
  PremiumSurface,
  StageRail,
  StatusBadge,
} from '@/app/components/ui/premium';
import PortfolioFocusHero from './components/PortfolioFocusHero';
import { useOwner, type PropertyWithCandidatures } from './OwnerContext';

type CheckoutTarget = {
  propertyId: string;
  propertyLabel: string;
  candidateCount: number;
} | null;

const STAGE_SECTIONS = [
  { id: 'search', title: 'Recherche' },
  { id: 'analysis', title: 'Analyse' },
  { id: 'selection', title: 'Sélection' },
  { id: 'contract', title: 'Contractualisation' },
  { id: 'management', title: 'Gestion' },
] as const;

function stageTone(tone?: string) {
  if (tone === 'success') return 'success' as const;
  if (tone === 'warning') return 'warning' as const;
  if (tone === 'danger') return 'danger' as const;
  if (tone === 'dark') return 'dark' as const;
  if (tone === 'info') return 'info' as const;
  return 'neutral' as const;
}

function formatActiveReason(entry: PropertyWithCandidatures) {
  return entry.flow?.focusCard?.reason || entry.flow?.summary || 'Ouvrez l'actif pour poursuivre le tunnel.';
}

/* ─── Skeleton ─────────────────────────────────────────────────────────────── */

function SkeletonPill({ className }: { className?: string }) {
  return <div className={`rounded-full bg-slate-200 ${className}`} />;
}

function PropertyQueueCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex gap-2">
            <SkeletonPill className="h-6 w-24" />
            <SkeletonPill className="h-6 w-16 bg-slate-100" />
          </div>
          <div className="h-7 w-3/4 rounded-xl bg-slate-200" />
          <div className="h-4 w-full rounded-lg bg-slate-100" />
        </div>
        <div className="flex shrink-0 flex-col gap-3 lg:w-[200px]">
          <div className="h-16 rounded-[1.45rem] bg-slate-100" />
          <div className="h-11 rounded-[1.45rem] bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="animate-pulse rounded-[2.25rem] border border-stone-200 bg-stone-100/60 p-7 sm:p-8">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="space-y-7">
          <SkeletonPill className="h-6 w-36 bg-stone-200" />
          <div className="space-y-3">
            <div className="h-10 w-3/4 rounded-xl bg-stone-200" />
            <div className="h-10 w-1/2 rounded-xl bg-stone-200" />
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-[1.2rem] bg-white/60" />
            ))}
          </div>
          <div className="flex gap-3">
            <div className="h-11 w-36 rounded-2xl bg-stone-200" />
          </div>
        </div>
        <div className="h-52 rounded-[1.9rem] bg-white/60" />
      </div>
    </div>
  );
}

/* ─── PropertyQueueCard ────────────────────────────────────────────────────── */

function PropertyQueueCard({
  entry,
  onAction,
}: {
  entry: PropertyWithCandidatures;
  onAction: (entry: PropertyWithCandidatures) => void;
}) {
  const focusCard = entry.flow?.focusCard;
  const candidateCount = Number(entry.flow?.totalCandidates || 0);
  const isUnlock = entry.flow?.nextAction?.kind === 'unlock';

  const secondaryBadge = entry.flow?.selectionRequired
    ? `${Math.min(candidateCount, 3)} finaliste${Math.min(candidateCount, 3) > 1 ? 's' : ''}`
    : candidateCount > 0
      ? `${candidateCount} passeport${candidateCount > 1 ? 's' : ''}`
      : 'À lancer';

  return (
    <PremiumSurface
      padding="md"
      className="rounded-[2rem] border-slate-200 bg-white transition hover:shadow-[0_24px_64px_-40px_rgba(15,23,42,0.18)]"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

        {/* ── Info ── */}
        <div className="min-w-0 space-y-3">
          <ActionBar className="gap-2">
            <StatusBadge
              tone={stageTone(entry.flow?.stageTone)}
              label={entry.flow?.stageLabel || 'Pipeline'}
              className="normal-case tracking-normal text-[11px] font-semibold"
            />
            <StatusBadge
              tone="neutral"
              label={secondaryBadge}
              className="normal-case tracking-normal text-[11px] font-semibold"
            />
          </ActionBar>

          <h3 className="font-serif text-xl tracking-tight text-slate-950 sm:text-2xl">
            {entry.property.address || entry.property.title}
          </h3>

          <p className="max-w-xl text-sm leading-6 text-slate-600">
            {focusCard?.title || formatActiveReason(entry)}
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="flex shrink-0 flex-col gap-3 lg:w-[200px]">
          {focusCard?.metricValue !== undefined && (
            <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {focusCard.metricLabel || 'Passeports'}
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-950">
                {focusCard.metricValue}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onAction(entry)}
            className={`inline-flex items-center justify-center gap-2 rounded-[1.45rem] px-4 py-3 text-sm font-semibold transition ${
              isUnlock
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-slate-950 text-white hover:bg-slate-800'
            }`}
          >
            {isUnlock ? <Lock className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            {entry.flow?.nextAction?.label || focusCard?.ctaLabel || 'Ouvrir'}
          </button>
        </div>
      </div>
    </PremiumSurface>
  );
}

/* ─── Dashboard principal ──────────────────────────────────────────────────── */

export default function OwnerDashboardClient() {
  const { data, loading, refresh, setActivePropertyId } = useOwner();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setJustUnlocked(true);
      refresh();
      const timer = window.setTimeout(() => setJustUnlocked(false), 4000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [refresh, searchParams]);

  const stageFilter = searchParams.get('stage') || 'all';

  const activeEntries = useMemo(() => data.filter((entry) => !entry.property.archived), [data]);
  const archivedEntries = useMemo(() => data.filter((entry) => entry.property.archived), [data]);

  const metrics = useMemo(() => ({
    total: activeEntries.length,
    decisions: activeEntries.filter((entry) => entry.flow?.selectionRequired).length,
    analysis: activeEntries.filter((entry) => entry.flow?.stage === 'analysis').length,
    managed: activeEntries.filter((entry) => entry.flow?.stage === 'management' || entry.property.isRented).length,
  }), [activeEntries]);

  const prioritizedEntries = useMemo(() => {
    const filtered = stageFilter === 'all'
      ? activeEntries
      : activeEntries.filter((entry) => entry.flow?.stage === stageFilter);

    return [...filtered].sort((left, right) => {
      const leftPriority = Number(left.flow?.focusCard?.priority || 0);
      const rightPriority = Number(right.flow?.focusCard?.priority || 0);
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return Number(right.flow?.totalCandidates || 0) - Number(left.flow?.totalCandidates || 0);
    });
  }, [activeEntries, stageFilter]);

  const focusEntry = prioritizedEntries[0] || activeEntries[0] || null;

  const handleAction = (entry: PropertyWithCandidatures) => {
    if (entry.flow?.nextAction?.kind === 'unlock') {
      setCheckoutTarget({
        propertyId: entry.property.id,
        propertyLabel: entry.property.address || entry.property.title,
        candidateCount: entry.flow?.sealedCount || 0,
      });
      return;
    }
    setActivePropertyId(entry.property.id);
    router.push(entry.flow?.nextAction?.href || `/dashboard/owner/property/${entry.property.id}`);
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-8">
        <HeroSkeleton />
        <div className="space-y-4">
          <PropertyQueueCardSkeleton />
          <PropertyQueueCardSkeleton />
        </div>
      </div>
    );
  }

  /* ── Empty ── */
  if (data.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="py-20">
        <EmptyState
          icon={<Building2 className="h-8 w-8 text-slate-400" />}
          title="Votre portefeuille est prêt"
          description="Ajoutez votre premier actif pour activer le Sésame candidat, recevoir des Passeports Locatifs et lancer le cockpit de sélection."
          action={
            <Link
              href="/fast-track"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-400"
            >
              <Building2 className="h-4 w-4" /> Ajouter un actif
            </Link>
          }
        />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <CheckoutModal
        open={Boolean(checkoutTarget)}
        onClose={() => setCheckoutTarget(null)}
        propertyId={checkoutTarget?.propertyId || ''}
        propertyLabel={checkoutTarget?.propertyLabel || ''}
        candidateCount={checkoutTarget?.candidateCount || 0}
        unlockScope="property"
      />

      <AnimatePresence>
        {justUnlocked ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
              <span className="text-sm font-semibold text-emerald-900">
                Les Passeports Locatifs de cet actif sont maintenant accessibles.
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PortfolioFocusHero
        headline="Choisissez le bon locataire, sans bruit."
        metrics={[
          { label: 'Actifs', value: metrics.total },
          { label: 'Décisions', value: metrics.decisions, caption: 'À arbitrer' },
          { label: 'Analyses', value: metrics.analysis, caption: 'En cours' },
          { label: 'En gestion', value: metrics.managed },
        ]}
        focusCard={focusEntry?.flow?.focusCard || null}
      />

      <StageRail
        activeId={stageFilter}
        onSelect={(id) => {
          const params = new URLSearchParams(searchParams.toString());
          if (!id || id === 'all') params.delete('stage'); else params.set('stage', id);
          const q = params.toString();
          router.replace(q ? `/dashboard/owner?${q}` : '/dashboard/owner');
        }}
        items={[
          { id: 'all', label: 'Tout', count: activeEntries.length, caption: 'Vue portefeuille' },
          ...STAGE_SECTIONS.map((section) => ({
            id: section.id,
            label: section.title,
            count: activeEntries.filter((entry) => entry.flow?.stage === section.id).length,
          })),
        ]}
      />

      <section className="space-y-4">
        <PremiumSectionHeader
          eyebrow="Décisions en attente"
          title="File priorisée"
        />

        {prioritizedEntries.length === 0 ? (
          <EmptyState
            icon={<Shield className="h-7 w-7 text-slate-300" />}
            title="Aucun actif dans ce filtre"
            description="Changez de filtre pour voir les autres étapes du portefeuille."
          />
        ) : (
          <div className="space-y-4">
            {prioritizedEntries.map((entry) => (
              <PropertyQueueCard key={entry.property.id} entry={entry} onAction={handleAction} />
            ))}
          </div>
        )}
      </section>

      {archivedEntries.length > 0 && stageFilter === 'all' ? (
        <section className="space-y-4">
          <PremiumSectionHeader
            eyebrow="Historique"
            title="Actifs archivés"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {archivedEntries.map((entry) => (
              <Link
                key={entry.property.id}
                href={`/dashboard/owner/property/${entry.property.id}`}
                className="group rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-5 transition hover:border-slate-300 hover:bg-white"
              >
                <h3 className="break-words font-serif text-base font-semibold text-slate-700 group-hover:text-slate-950">
                  {entry.property.address || entry.property.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {entry.flow?.summary}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 group-hover:text-slate-700">
                  Ouvrir
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </motion.div>
  );
}
