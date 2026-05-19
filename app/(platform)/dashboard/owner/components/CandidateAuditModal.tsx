'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, FileText, ArrowRight } from 'lucide-react';
import { Avatar, GuaranteeBadge } from './ui';
import type { LocalDossier, LocalBien } from './ui';
import { SelectionConfirmModal } from './SelectionConfirmModal';
import {
  DecisionVerdict,
  verdictFromScore,
  ResilienceGauge,
  ForensicAuditCard,
  AIReasoningCard,
  RemainingIncomeChart,
  CertificationRow,
  CriteriaGrid,
  deriveCriteriaFromDossier,
  PayslipsBreakdown,
} from '@/app/components/audit';
import {
  PRODUCT,
  GRADE_LABELS,
  getGrade,
  formatPrice,
} from '@/lib/product-lexicon';
import type { AuditStatus } from '@/lib/product-lexicon';

export interface CandidateAuditModalProps {
  open: boolean;
  candidate: LocalDossier;
  bien: LocalBien;
  onClose: () => void;
  onSelect: (c: LocalDossier) => void;
  onOpenAudit?: (c: LocalDossier) => void;
}

/**
 * Modale centrée premium pour le dossier candidat.
 * Desktop : max-w-4xl centrée avec scale-in.
 * Mobile : bottom-sheet plein écran avec slide-up.
 */
export function CandidateAuditModal({
  open,
  candidate: c,
  bien,
  onClose,
  onSelect,
  onOpenAudit,
}: CandidateAuditModalProps) {
  const titleId = React.useId();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // ESC ferme la modale
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll on desktop
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!c || !bien) return null;

  const ratio = bien.loyer > 0 ? c.revenus / bien.loyer : 0;
  // Phase U — Verdict serveur en source canonique, fallback verdictFromScore pour candidats anciens
  const verdict = c.verdict ?? verdictFromScore(c.score, c.auditStatus);
  const reasonCodes = c.reasonCodes;

  // Stagger pour les sections du body
  const sectionTransition = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="audit-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modale (desktop centrée / mobile bottom-sheet) */}
          <motion.div
            key="audit-modal-panel"
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
              // Desktop : modale centrée
              'md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-h-[85vh] md:w-[calc(100vw-2rem)] md:max-w-4xl md:rounded-modal',
            ].join(' ')}
          >
            {/* Mobile handle */}
            <div className="flex justify-center pt-2.5 pb-1 md:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
            </div>

            {/* Header sticky */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-6 md:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} size="sm" />
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="truncate font-serif text-base font-bold text-slate-900 md:text-lg"
                  >
                    {c.prenom} {c.nom}
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {c.contrat} · {bien.label}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer le dossier candidat"
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* HERO : Decision + Gauge + Certifs */}
              <motion.section
                {...sectionTransition(0)}
                className="border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white px-4 py-5 md:px-6 md:py-6"
              >
                <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,200px)]">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">
                        Dossier candidat
                      </span>
                      <span className="font-serif text-xs font-bold text-emerald-700">
                        {GRADE_LABELS[getGrade(c.score)]}
                      </span>
                    </div>
                    <CertificationRow
                      badges={[
                        {
                          type: 'identity',
                          label: 'Identité Didit',
                          verified: c.identityVerified === true,
                        },
                        {
                          type: 'income',
                          label: 'Revenus certifiés',
                          verified: (c.certifiedDocuments || 0) > 0,
                        },
                        {
                          type: 'forensic',
                          label: PRODUCT.AUDIT,
                          verified: c.auditStatus === 'CLEAR',
                        },
                        {
                          type: 'solvent',
                          label: 'Solvable',
                          verified: (c.remainingIncome || 0) >= 800,
                        },
                        {
                          type: 'guarantee',
                          label: c.garantie || 'Sans garant',
                          verified: ['VISALE', 'PHYSICAL'].includes(
                            String(c.guaranteeMode || ''),
                          ),
                        },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-center md:justify-end">
                    <ResilienceGauge score={c.score} size="sm" />
                  </div>
                </div>

                <div className="mt-5">
                  <DecisionVerdict
                    verdict={verdict}
                    headline={GRADE_LABELS[getGrade(c.score)].split(' — ')[1]}
                    summary={c.decisionHeadline || c.auditSummary}
                    reasonCodes={reasonCodes}
                  />
                </div>
              </motion.section>

              {/* BODY : analyses détaillées */}
              <div className="space-y-4 px-4 py-5 md:px-6 md:py-6">
                {/* Critères d'évaluation objectifs */}
                <motion.div {...sectionTransition(0.03)}>
                  <CriteriaGrid
                    criteria={deriveCriteriaFromDossier({
                      revenus: c.revenus,
                      loyer: bien.loyer,
                      effortRate: c.effortRate,
                      remainingIncome: c.remainingIncome,
                      contrat: c.contrat,
                      guaranteeMode: c.guaranteeMode,
                      garantie: c.garantie,
                      identityVerified: c.identityVerified,
                      auditStatus: c.auditStatus,
                    })}
                  />
                </motion.div>

                {/* Remaining income chart */}
                {c.monthlyIncome && c.monthlyIncome > 0 && bien.loyer > 0 && (
                  <motion.div {...sectionTransition(0.05)}>
                    <RemainingIncomeChart
                      monthlyIncome={c.monthlyIncome}
                      monthlyRent={bien.loyer}
                    />
                  </motion.div>
                )}

                {/* V1.4 — Détail bulletins de paie analysés */}
                {c.payslipsBreakdown && c.payslipsBreakdown.length > 0 && (
                  <motion.div {...sectionTransition(0.08)}>
                    <PayslipsBreakdown
                      breakdown={c.payslipsBreakdown}
                      mean={c.monthlyIncomeMean}
                      median={c.monthlyIncomeMedian}
                      stdDev={c.monthlyIncomeStdDev}
                      method={c.monthlyIncomeMethod}
                      varianceRatio={c.varianceRatio}
                      varianceHigh={c.varianceHigh}
                    />
                  </motion.div>
                )}

                {/* Forensic audit */}
                <motion.div {...sectionTransition(0.1)}>
                  <ForensicAuditCard
                    auditStatus={(c.auditStatus || 'PENDING') as AuditStatus}
                    integrityScore={c.integrityScore?.score}
                    integrityLabel={c.integrityScore?.label}
                    highlights={c.strengths}
                    alerts={c.watchouts}
                    documentsCount={
                      (c.certifiedDocuments || 0) +
                      (c.reviewDocuments || 0) +
                      (c.rejectedDocuments || 0)
                    }
                    certifiedCount={c.certifiedDocuments}
                    reviewCount={c.reviewDocuments}
                    rejectedCount={c.rejectedDocuments}
                  />
                </motion.div>

                {/* AI Reasoning : strengths / watchouts */}
                {((c.strengths && c.strengths.length > 0) ||
                  (c.watchouts && c.watchouts.length > 0)) && (
                  <motion.div {...sectionTransition(0.15)}>
                    <AIReasoningCard strengths={c.strengths} watchouts={c.watchouts} />
                  </motion.div>
                )}

                {/* Garantie + Synthèse rapide */}
                <motion.div {...sectionTransition(0.2)} className="grid gap-4 md:grid-cols-2">
                  {/* Garantie */}
                  <div
                    className={`rounded-card border px-4 py-3 ${
                      !c.guaranteeMode || c.guaranteeMode === 'NONE'
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-emerald-200 bg-emerald-50'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Garantie
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        {c.garantie || 'Aucune'}
                      </span>
                      <GuaranteeBadge mode={c.guaranteeMode} short />
                    </div>
                    {(!c.guaranteeMode || c.guaranteeMode === 'NONE') && (
                      <p className="mt-2 text-xs text-amber-800">
                        Privilégiez les profils couverts par Visale ou un garant physique.
                      </p>
                    )}
                  </div>

                  {/* Synthèse rapide */}
                  <div className="rounded-card border border-slate-200 bg-white px-4 py-3 shadow-card">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Synthèse rapide
                    </p>
                    <dl className="mt-2 divide-y divide-slate-100 text-sm">
                      <div className="flex justify-between py-1.5">
                        <dt className="text-slate-500">Revenus nets</dt>
                        <dd className="font-semibold text-emerald-700">
                          {formatPrice(c.revenus)}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-slate-500">Ratio loyer</dt>
                        <dd className="font-semibold text-slate-900">
                          {ratio.toFixed(1)}× ·{' '}
                          {c.effortRate
                            ? `${Math.round(c.effortRate * 100)}%`
                            : `${Math.round((1 / Math.max(ratio, 0.01)) * 100)}%`}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-slate-500">Qualité dossier</dt>
                        <dd className="font-semibold text-slate-900">
                          {c.qualityScore ? `${c.qualityScore}/100` : '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-slate-500">Prêt à signer</dt>
                        <dd
                          className={`font-semibold ${
                            c.contractReady ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {c.contractReady ? '✓ Oui' : 'Non'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Footer sticky */}
            <footer
              className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur md:px-6 md:py-4"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                {c.passportPreviewUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        c.passportPreviewUrl || '',
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-button border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {PRODUCT.PASSEPORT}
                  </button>
                )}
                {onOpenAudit && (
                  <button
                    type="button"
                    onClick={() => onOpenAudit(c)}
                    className="inline-flex items-center gap-1.5 rounded-button border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Voir l'audit complet
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-button bg-amber-500 px-5 text-sm font-bold text-white shadow-amber transition-colors hover:bg-amber-600 sm:flex-none sm:min-w-[200px]"
              >
                Sélectionner {c.prenom}
                <ArrowRight className="h-4 w-4" />
              </button>
            </footer>
          </motion.div>

          {/* Modale de confirmation de sélection */}
          <SelectionConfirmModal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false);
              onSelect(c);
              onClose();
            }}
            candidateName={`${c.prenom} ${c.nom}`}
            verdict={verdict}
            reasonCodes={reasonCodes}
          />
        </>
      )}
    </AnimatePresence>
  );
}
