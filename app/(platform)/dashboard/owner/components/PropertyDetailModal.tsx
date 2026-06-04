'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  Building2,
  Pencil,
  X,
  Inbox,
  Crown,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import type { LocalDossier, LocalBien } from './ui';
import type { PropertyWithCandidatures } from '../OwnerContext';
import { Button, SectionHeader } from '@/app/components/ui';
import { TopCandidateCard } from './TopCandidateCard';
import { PropertySesameCard } from './PropertySesameCard';
import { formatPrice, PRODUCT } from '@/lib/product-lexicon';

// ── Helper KPI tile (inline) ─────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-card border bg-white px-3 py-2.5 shadow-card',
        highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200',
      ].join(' ')}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={[
          'mt-1 font-serif font-bold tracking-tight',
          highlight ? 'text-emerald-700' : 'text-slate-900',
          value.length > 8 ? 'text-base' : 'text-xl',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

// ── Stage label/color helpers ────────────────────────────────────────────────

const STAGE_TONE: Record<string, { bg: string; text: string; dot: string }> = {
  search:     { bg: 'bg-slate-100',  text: 'text-slate-700',  dot: 'bg-slate-500' },
  analysis:   { bg: 'bg-blue-50',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  selection:  { bg: 'bg-amber-50',   text: 'text-amber-700',  dot: 'bg-amber-500' },
  contract:   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  management: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

function StageBadge({ stage, label }: { stage?: string; label?: string }) {
  const tone = STAGE_TONE[String(stage || '')] || STAGE_TONE.search;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      {label || 'Recherche'}
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function PropertyDetailModal({
  bien,
  candidats,
  allData,
  onClose,
  onSelectCandidate,
  onOpenTunnel,
  onEditProperty,
  onDeleteProperty,
}: {
  bien: LocalBien;
  candidats: LocalDossier[];
  allData: PropertyWithCandidatures[];
  onClose: () => void;
  onSelectCandidate: (c: LocalDossier) => void;
  onOpenTunnel: () => void;
  onGoToContract: (propertyId: string, applicationId?: string) => void;
  onEditProperty?: () => void;
  onDeleteProperty?: () => void;
}) {
  const titleId = React.useId();
  const entry = allData.find((e) => e.property.id === bien.id);
  const flow = entry?.flow;

  // ESC ferme + lock body scroll
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  // Top 3 candidats non-scellés par score
  const nonSealed = candidats.filter((d) => !d.isSealed);
  const top3 = [...nonSealed]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 3);
  const topScore = nonSealed.length > 0
    ? Math.max(...nonSealed.map((d) => d.score || 0))
    : 0;
  const hasSelected = candidats.some((d) => d.statut === 'selectionne');

  // Animation stagger
  const sectionTransition = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  });

  return (
    <AnimatePresence>
      <motion.div
        key="property-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        key="property-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className={[
          'fixed z-[201] flex flex-col bg-white shadow-premium',
          // Mobile : bottom sheet
          'inset-x-0 bottom-0 max-h-[92vh] rounded-t-modal',
          // Desktop : modale centrée 4xl
          'md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-h-[88vh] md:w-[calc(100vw-2rem)] md:max-w-4xl md:rounded-modal',
        ].join(' ')}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        {/* Header sticky */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-6 md:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-amber-50 text-amber-700">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="truncate font-serif text-base font-bold text-slate-900 md:text-lg">
                {bien.label}
              </h2>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs text-slate-500">{formatPrice(bien.loyer)}/mois</span>
                <span className="text-slate-300">·</span>
                <StageBadge stage={bien.flowStage} label={bien.flowStageLabel} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onEditProperty && (
              <button
                type="button"
                onClick={onEditProperty}
                aria-label="Modifier le bien"
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onDeleteProperty && (
              <button
                type="button"
                onClick={onDeleteProperty}
                aria-label="Archiver le bien"
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <Archive className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* HERO */}
          <motion.section
            {...sectionTransition(0)}
            className="border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white px-4 py-5 md:px-6 md:py-6"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">
              Mon bien
            </p>
            <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {bien.label}
            </h1>
            {bien.adresse && (
              <p className="mt-1 text-sm text-slate-500">{bien.adresse}</p>
            )}
            <ul className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-slate-700">
              <li>
                <strong className="font-serif text-base text-emerald-700">{formatPrice(bien.loyer)}</strong>
                <span className="text-slate-500"> /mois</span>
              </li>
              {bien.charges !== undefined && bien.charges > 0 && (
                <li className="text-slate-500">
                  Charges <strong className="text-slate-700">{formatPrice(bien.charges)}</strong>
                </li>
              )}
              {bien.surface > 0 && (
                <li className="text-slate-500">
                  <strong className="text-slate-700">{bien.surface}</strong> m²
                </li>
              )}
              {bien.rooms ? (
                <li className="text-slate-500">
                  <strong className="text-slate-700">{bien.rooms}</strong> pièces
                </li>
              ) : null}
              {bien.floor !== null && bien.floor !== undefined && (
                <li className="text-slate-500">Étage {bien.floor}</li>
              )}
            </ul>
            {flow?.summary && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
                {flow.summary}
              </p>
            )}
          </motion.section>

          {/* SÉSAME CARD + KPI */}
          <motion.section
            {...sectionTransition(0.05)}
            className="space-y-4 px-4 py-5 md:px-6 md:py-6"
          >
            <PropertySesameCard applyToken={bien.applyToken} variant="hero" />
            <div className="grid grid-cols-3 gap-3">
              <KpiTile
                label="Candidatures"
                value={String(candidats.length)}
              />
              <KpiTile
                label="Top score"
                value={topScore > 0 ? `${topScore}/100` : '—'}
                highlight={topScore >= 75}
              />
              <KpiTile
                label="Statut"
                value={bien.flowStageLabel || 'Recherche'}
              />
            </div>
          </motion.section>

          {/* TOP CANDIDATS ou EMPTY STATE */}
          {top3.length > 0 ? (
            <motion.section
              {...sectionTransition(0.1)}
              className="border-t border-slate-100 px-4 py-5 md:px-6 md:py-6"
            >
              <SectionHeader
                eyebrow="Analyse IA"
                title="Vos meilleurs candidats"
                description="Triés par Indice de Résilience sur ce bien."
                actions={
                  candidats.length > 3 ? (
                    <span className="rounded-pill bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      {candidats.length} au total
                    </span>
                  ) : undefined
                }
                className="mb-4"
              />
              <div className="grid gap-4 md:grid-cols-3">
                {top3.map((c, i) => (
                  <TopCandidateCard
                    key={c.id}
                    rank={(i + 1) as 1 | 2 | 3}
                    candidate={c}
                    bien={bien}
                    onOpenAudit={onSelectCandidate}
                  />
                ))}
              </div>
            </motion.section>
          ) : (
            <motion.section
              {...sectionTransition(0.1)}
              className="border-t border-slate-100 px-4 py-8 md:px-6 md:py-10"
            >
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Inbox className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Aucune candidature pour ce bien
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Partagez le {PRODUCT.SESAME} ci-dessus sur LeBonCoin, WhatsApp ou par email
                  pour recevoir vos premiers dossiers analysés par l&apos;IA.
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  En 24h, 78 % des dossiers reçoivent un Grade A ou B
                </p>
              </div>
            </motion.section>
          )}

          {/* CTA SÉLECTION */}
          {top3.length > 0 && !bien.isRented && !hasSelected && (
            <motion.section
              {...sectionTransition(0.15)}
              className="border-t border-slate-100 px-4 py-5 md:px-6 md:py-6"
            >
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={onOpenTunnel}
                iconLeft={<Crown className="h-4 w-4" />}
                iconRight={<ArrowRight className="h-4 w-4" />}
              >
                Lancer le tunnel de sélection
              </Button>
              <p className="mt-2 text-center text-xs text-slate-500">
                Comparez les profils côte à côte et sélectionnez votre futur locataire.
              </p>
            </motion.section>
          )}

          {/* Confirmation sélectionné */}
          {hasSelected && !bien.isRented && (
            <motion.section
              {...sectionTransition(0.15)}
              className="border-t border-slate-100 px-4 py-5 md:px-6 md:py-6"
            >
              <div className="flex items-start gap-3 rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base font-bold text-emerald-900">
                    Un candidat est déjà sélectionné
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-800">
                    Vous pouvez relancer le tunnel de sélection pour comparer ou changer.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onOpenTunnel}>
                  Tunnel
                </Button>
              </div>
            </motion.section>
          )}
        </div>

        {/* Footer sticky */}
        <footer
          className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur md:px-6 md:py-4"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}
        >
          {onEditProperty && (
            <Button variant="outline" size="md" onClick={onEditProperty} iconLeft={<Pencil className="h-3.5 w-3.5" />}>
              Modifier le bien
            </Button>
          )}
          <Button variant="ghost" size="md" onClick={onClose}>
            Fermer
          </Button>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
