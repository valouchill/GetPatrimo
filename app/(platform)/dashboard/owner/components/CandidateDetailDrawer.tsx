'use client';

/**
 * @deprecated Remplacé par CandidateAuditModal (modale centrée premium).
 * Conservé temporairement pour rollback rapide. À supprimer après validation prod.
 * Voir : /opt/doc2loc/app/(platform)/dashboard/owner/components/CandidateAuditModal.tsx
 */

import { motion } from 'framer-motion';
import { X, FileText, ExternalLink } from 'lucide-react';
import {
  ScorePill,
  GradeBadge,
  Tag,
  GuaranteeBadge,
  Btn,
  Avatar,
} from './ui';
import type { TagType, LocalDossier, LocalBien } from './ui';
import {
  AUDIT_LABELS,
  PRODUCT,
  formatResilience,
  formatPrice,
  getMetalLevel,
  METAL_LABELS,
  METAL_DESCRIPTIONS,
} from '@/lib/product-lexicon';
import type { AuditStatus } from '@/lib/product-lexicon';
import {
  DecisionVerdict,
  ForensicAuditCard,
  AIReasoningCard,
  RemainingIncomeChart,
  CertificationRow,
} from '@/app/components/audit';
import { resolveVerdict } from '@/lib/verdict-system';

// ── Stage labels (local copy) ─────────────────────────────────────────────────

const STAGE_FR: Record<string, string> = {
  search:     'Recherche',
  analysis:   'Analyse',
  selection:  'Sélection',
  contract:   'Contrat',
  management: 'Gestion',
};

// ── StagePill ─────────────────────────────────────────────────────────────────

export function StagePill({ stage, stageLabel }: { stage?: string; stageLabel?: string }) {
  const label = stageLabel || STAGE_FR[stage || ''] || stage || 'Inconnu';
  const type: TagType = stage === 'management' ? 'green' : stage === 'contract' ? 'indigo' : stage === 'selection' ? 'amber' : 'slate';
  return <Tag type={type}>{label}</Tag>;
}

// ── CandidateDetailDrawer ─────────────────────────────────────────────────────

export function CandidateDetailDrawer({ c, bien, onClose, onSelect }: {
  c: LocalDossier; bien: LocalBien; onClose: () => void; onSelect: (c: LocalDossier) => void;
}) {
  const ratio = bien.loyer > 0 ? c.revenus / bien.loyer : 0;
  const ratioColor = ratio >= 3 ? 'text-emerald-600' : ratio >= 2 ? 'text-amber-600' : 'text-red-600';

  const pillars = c.pillars || [
    { id: 'identity', label: 'Identité', score: c.score >= 70 ? 36 : c.score >= 45 ? 28 : 16, max: 40, status: c.auditStatus === 'CLEAR' ? 'verified' : 'review', summary: '' },
    { id: 'income', label: 'Revenus', score: Math.min(Math.round((ratio / 3) * 20), 20), max: 20, status: ratio >= 3 ? 'strong' : 'weak', summary: '' },
    { id: 'activity', label: 'Activité', score: c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 10 : 5, max: 10, status: 'ok', summary: '' },
    { id: 'receipts', label: 'Quittances', score: 0, max: 5, status: 'neutral', summary: '' },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-[201] flex h-screen flex-col bg-white shadow-2xl"
        style={{ width: 'min(520px, 95vw)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-drawer-title"
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 md:px-6 md:py-5">
          <div className="flex items-center gap-3">
            <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} />
            <div>
              <div id="candidate-drawer-title" className="font-bold text-slate-950 flex items-center gap-2">
                {c.prenom} {c.nom}
                <GradeBadge score={c.score} size="sm" />
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{c.contrat} · {bien.label}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ScorePill score={c.score} showGrade />
            <button type="button" onClick={onClose} aria-label="Fermer le panneau candidat" className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-safe md:px-6 md:py-5 space-y-4">

          {/* Verdict d'audit en hero (V6.6 : niveau institutionnel métal) */}
          <DecisionVerdict
            verdict={resolveVerdict(c)}
            headline={`Niveau ${METAL_LABELS[getMetalLevel(c.score)]}`}
            summary={
              c.decisionHeadline ||
              c.auditSummary ||
              METAL_DESCRIPTIONS[getMetalLevel(c.score)]
            }
            reasonCodes={c.reasonCodes}
          />

          {/* Certifications */}
          <CertificationRow
            badges={[
              { type: 'identity', label: 'Identité Didit', verified: c.identityVerified === true },
              { type: 'income', label: 'Revenus certifiés', verified: (c.certifiedDocuments || 0) > 0 },
              { type: 'forensic', label: PRODUCT.AUDIT, verified: c.auditStatus === 'CLEAR' },
              { type: 'solvent', label: 'Solvable', verified: (c.remainingIncome || 0) >= 800 },
              {
                type: 'guarantee',
                label: c.garantie || 'Sans garant',
                verified: ['VISALE', 'PHYSICAL'].includes(String(c.guaranteeMode || '')),
              },
            ]}
          />

          {/* Guarantee section (alerte si NONE) */}
          {(!c.guaranteeMode || c.guaranteeMode === 'NONE') && (
            <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-900">Garantie absente</span>
                <GuaranteeBadge mode={c.guaranteeMode} />
              </div>
              <p className="mt-1.5 text-xs text-amber-700">
                Privilégiez les profils couverts par Visale ou un garant physique.
              </p>
            </div>
          )}

          {/* Reste-à-vivre (si données dispo) */}
          {c.monthlyIncome && c.monthlyIncome > 0 && bien.loyer > 0 && (
            <RemainingIncomeChart
              monthlyIncome={c.monthlyIncome}
              monthlyRent={bien.loyer}
            />
          )}

          {/* Forensic Audit */}
          <ForensicAuditCard
            auditStatus={(c.auditStatus || 'PENDING') as AuditStatus}
            integrityScore={c.integrityScore?.score}
            integrityLabel={c.integrityScore?.label}
            highlights={c.strengths}
            alerts={c.watchouts}
            documentsCount={(c.certifiedDocuments || 0) + (c.reviewDocuments || 0) + (c.rejectedDocuments || 0)}
            certifiedCount={c.certifiedDocuments}
            reviewCount={c.reviewDocuments}
            rejectedCount={c.rejectedDocuments}
          />

          {/* AI Reasoning : Strengths / Watchouts détaillés */}
          {((c.strengths && c.strengths.length > 0) || (c.watchouts && c.watchouts.length > 0)) && (
            <AIReasoningCard
              strengths={c.strengths}
              watchouts={c.watchouts}
            />
          )}

          {/* Key info rows */}
          <div className="divide-y divide-slate-100 rounded-card border border-slate-200 bg-white shadow-card">
            {([
              ['Revenus nets', formatPrice(c.revenus)],
              ['Ratio loyer', `${ratio.toFixed(1)}× (${(c.effortRate ? (c.effortRate * 100).toFixed(0) : (1 / ratio * 100).toFixed(0))}%)`],
              ['Contrat', c.contrat],
              ['Niveau', METAL_LABELS[getMetalLevel(c.score)]],
              ['Qualité dossier', c.qualityScore ? `${c.qualityScore}/100` : '—'],
              ['Prêt à signer', c.contractReady ? '✓ Oui' : 'Non'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold text-slate-900">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-4 py-4 pb-safe md:px-6">
          {c.passportDownloadUrl && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => window.open(c.passportDownloadUrl || '', '_blank', 'noopener,noreferrer')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                title="Télécharger le Passeport Locatif PDF"
              >
                <FileText className="h-4 w-4" /> Télécharger le {PRODUCT.PASSEPORT}
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={onClose} className="flex-1 min-h-[44px]">Fermer</Btn>
            <Btn variant="amber" onClick={() => { onSelect(c); onClose(); }} className="flex-[2] min-h-[44px]">
              Sélectionner {c.prenom} →
            </Btn>
          </div>
        </div>
      </motion.div>
    </>
  );
}
