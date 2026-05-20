'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, RotateCcw } from 'lucide-react';
import type { LocalDossier, LocalBien } from './ui';
import { SelectionConfirmModal } from './SelectionConfirmModal';
import {
  CandidateAiReport,
  type AiReportCandidate,
  type AiReportCheck,
  type AiReportStatus,
  ReanalyzeButton,
} from '@/app/components/audit';
import { PRODUCT, formatPrice, getGrade, GRADE_SHORT } from '@/lib/product-lexicon';
import { resolveVerdict } from '@/lib/verdict-system';

export interface CandidateAuditModalProps {
  open: boolean;
  candidate: LocalDossier;
  bien: LocalBien;
  onClose: () => void;
  onSelect: (c: LocalDossier) => void;
  onOpenAudit?: (c: LocalDossier) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Mapping LocalDossier → AiReportCandidate
// ────────────────────────────────────────────────────────────────────────────

function statusFromAudit(audit?: string): AiReportStatus {
  if (audit === 'CLEAR') return 'success';
  if (audit === 'ALERT') return 'danger';
  return 'warning';
}

/**
 * Construit la liste de contrôles "locataire" depuis les données disponibles.
 * Privilégie les watchouts (alertes IA) puis les strengths (validés).
 */
function buildTenantChecks(c: LocalDossier): AiReportCheck[] {
  const checks: AiReportCheck[] = [];
  const verdict = resolveVerdict(c);
  const auditStatus = statusFromAudit(c.auditStatus);

  // Identité Didit
  if (c.identityVerified) {
    checks.push({
      status: 'success',
      title: 'Identité',
      desc: 'Identité biométrique Didit certifiée (eIDAS).',
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Identité',
      desc: 'Vérification biométrique Didit en attente.',
      action: 'Inviter le candidat à compléter la vérification d\'identité.',
    });
  }

  // Audit Forensic global
  if (auditStatus === 'success') {
    checks.push({
      status: 'success',
      title: 'Cohérence fiscale & documents',
      desc:
        c.auditSummary ||
        'Aucune incohérence détectée. Fiches de paie, avis d\'imposition et justificatifs alignés.',
    });
  } else if (auditStatus === 'warning') {
    checks.push({
      status: 'warning',
      title: 'Vérifications complémentaires',
      desc: c.auditSummary || 'Quelques points secondaires à examiner avant validation.',
      action: c.watchouts && c.watchouts.length > 0 ? c.watchouts[0] : undefined,
    });
  } else {
    checks.push({
      status: 'danger',
      title: 'Anomalie détectée',
      desc:
        c.auditSummary ||
        'L\'IA a détecté une ou plusieurs incohérences majeures dans les documents fournis.',
    });
  }

  // Watchouts résiduelles (max 1 supplémentaire pour éviter la surcharge)
  if (c.watchouts && c.watchouts.length > 0 && auditStatus !== 'warning') {
    checks.push({
      status: verdict === 'risky' ? 'danger' : 'warning',
      title: 'Vigilance',
      desc: c.watchouts[0],
    });
  }

  // Documents
  const rejected = c.rejectedDocuments || 0;
  const review = c.reviewDocuments || 0;
  if (rejected > 0) {
    checks.push({
      status: 'danger',
      title: 'Documents rejetés',
      desc: `${rejected} pièce${rejected > 1 ? 's' : ''} rejetée${rejected > 1 ? 's' : ''} par l'audit IA.`,
    });
  } else if (review > 0) {
    checks.push({
      status: 'warning',
      title: 'Documents à revoir',
      desc: `${review} pièce${review > 1 ? 's' : ''} en attente de vérification visuelle.`,
      action: 'Examiner manuellement chaque pièce en revue.',
    });
  }

  return checks;
}

/**
 * Contrôles "garant" depuis le mode de garantie et les données disponibles.
 */
function buildGuarantorChecks(c: LocalDossier): AiReportCheck[] {
  const checks: AiReportCheck[] = [];
  const mode = c.guaranteeMode;

  if (mode === 'VISALE') {
    checks.push({
      status: 'success',
      title: 'Garantie Visale',
      desc: 'Visale Action Logement actif. Couverture impayés et dégradations confirmée.',
    });
    checks.push({
      status: 'success',
      title: 'Plafond couverture',
      desc: 'Loyer candidaté dans les limites du plafond Visale.',
    });
  } else if (mode === 'PHYSICAL') {
    checks.push({
      status: 'success',
      title: 'Garant physique identifié',
      desc: 'Pièce d\'identité et justificatifs du garant transmis.',
    });
    checks.push({
      status: 'warning',
      title: 'Solvabilité du garant',
      desc: 'Vérifier que les revenus du garant couvrent au moins 3× le loyer.',
      action: 'Examiner les fiches de paie ou avis d\'imposition du garant.',
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Aucune garantie déclarée',
      desc:
        'Le candidat ne dispose ni de Visale ni de garant physique. Risque locatif accru.',
      action: 'Proposer au candidat de souscrire à Visale (gratuit, en ligne).',
    });
  }

  return checks;
}

/**
 * Synthèse de l'auditeur — privilégie decisionHeadline puis auditSummary,
 * sinon génère un texte par défaut adapté au verdict.
 */
function buildAiSynthesis(c: LocalDossier): string {
  if (c.decisionHeadline && c.decisionHeadline.length > 20) {
    return c.decisionHeadline;
  }
  if (c.auditSummary && c.auditSummary.length > 20) {
    return c.auditSummary;
  }
  const verdict = resolveVerdict(c);
  if (verdict === 'recommended') {
    return 'Le profil présente une cohérence remarquable entre revenus déclarés, fiches de paie et justificatifs. L\'analyse forensic ne révèle aucune anomalie. Le dossier est éligible à la contractualisation immédiate.';
  }
  if (verdict === 'review') {
    return 'Le dossier est globalement solide mais nécessite quelques vérifications complémentaires avant signature. L\'IA recommande de croiser visuellement certaines pièces et de confirmer manuellement les points marqués en vigilance.';
  }
  return 'ATTENTION : L\'analyse approfondie révèle des écarts significatifs entre les documents fournis. Plusieurs points bloquants doivent être levés avant toute contractualisation.';
}

function dossierToAiReport(c: LocalDossier, bien: LocalBien): AiReportCandidate {
  const grade = getGrade(c.score);
  const gradeLabel =
    c.score < 45 ? 'ALERTE' : `GRADE ${GRADE_SHORT[grade]}`;

  // Taux d'effort en % (effortRate est stocké en 0-1 dans toDossier)
  const effortRatePct =
    typeof c.effortRate === 'number' && c.effortRate > 0
      ? c.effortRate * 100
      : bien.loyer > 0 && c.revenus > 0
      ? (bien.loyer / c.revenus) * 100
      : 0;

  // Couverture garant : indicatif depuis revenus garant si dispo, sinon "—"
  const guarantorCoverage =
    c.guaranteeMode === 'VISALE'
      ? 'Visale ✓'
      : c.guaranteeMode === 'PHYSICAL'
      ? '3×+'
      : '—';

  return {
    name: `${c.prenom || ''} ${c.nom || ''}`.trim() || 'Candidat',
    job: c.contrat || 'Profil',
    score: Math.max(0, Math.min(100, Math.round(c.score || 0))),
    grade: gradeLabel,
    metrics: {
      income: formatPrice(c.revenus || 0),
      effortRate: effortRatePct,
      guarantorCoverage,
    },
    aiSynthesis: buildAiSynthesis(c),
    tenantChecks: buildTenantChecks(c),
    guarantorChecks: buildGuarantorChecks(c),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Modale d'audit candidat — body remplacé par <CandidateAiReport>
// ────────────────────────────────────────────────────────────────────────────

/**
 * Modale centrée premium pour le dossier candidat.
 * Desktop : max-w-5xl centrée avec scale-in.
 * Mobile : bottom-sheet plein écran avec slide-up.
 *
 * V5.0 : le corps de la modale est désormais la vue <CandidateAiReport>
 * (analyse IA Trust premium — header avec score, métriques, synthèse IA,
 * audit forensic split locataire/garant, boutons Valider/Écarter sticky).
 */
export function CandidateAuditModal({
  open,
  candidate: c,
  bien,
  onClose,
  onSelect,
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
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!c || !bien) return null;

  // Mapping vers la structure attendue par <CandidateAiReport>
  const reportCandidate = React.useMemo(
    () => dossierToAiReport(c, bien),
    [c, bien],
  );

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
              'fixed z-[201] flex flex-col overflow-hidden bg-slate-50 shadow-premium',
              // Mobile : bottom sheet
              'inset-x-0 bottom-0 max-h-[94vh] rounded-t-modal',
              // Desktop : modale centrée
              'md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-h-[92vh] md:w-[calc(100vw-2rem)] md:max-w-5xl md:rounded-modal',
            ].join(' ')}
          >
            {/* Mobile handle */}
            <div className="flex justify-center bg-white pt-2.5 pb-1 md:hidden">
              <div className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
            </div>

            {/* Floating actions top-right (close + PDF + reanalyze) */}
            <div className="pointer-events-none absolute right-3 top-3 z-30 flex items-center gap-2 md:right-5 md:top-5">
              {c.passportDownloadUrl && (
                <a
                  href={c.passportDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50/95 px-3 py-1.5 text-[11px] font-bold text-amber-800 shadow-sm backdrop-blur transition-colors hover:bg-amber-100"
                  title={`Télécharger le ${PRODUCT.PASSEPORT} PDF`}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">PDF</span>
                </a>
              )}
              <div className="pointer-events-auto">
                <ReanalyzeButton
                  applicationId={c.id}
                  documentsCount={
                    (c.certifiedDocuments || 0) +
                    (c.reviewDocuments || 0) +
                    (c.rejectedDocuments || 0)
                  }
                  variant="ghost"
                  size="sm"
                  onSuccess={() => {
                    if (typeof window !== 'undefined') window.location.reload();
                  }}
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer le dossier candidat"
                className="pointer-events-auto rounded-full border border-slate-200 bg-white/95 p-2 text-slate-500 shadow-sm backdrop-blur transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Body scrollable contenant <CandidateAiReport> */}
            <div id={titleId} className="flex-1 overflow-y-auto">
              <CandidateAiReport
                candidate={reportCandidate}
                onValidate={() => setConfirmOpen(true)}
                onReject={onClose}
              />
            </div>
          </motion.div>
        </>
      )}

      {/* Modale de confirmation déclenchée par "Valider" */}
      <SelectionConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onSelect(c);
        }}
        candidateName={`${c.prenom} ${c.nom}`}
        verdict={resolveVerdict(c)}
        reasonCodes={c.reasonCodes}
      />
    </AnimatePresence>
  );
}
