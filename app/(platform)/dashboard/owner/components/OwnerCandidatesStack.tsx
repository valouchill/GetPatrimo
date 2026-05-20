'use client';

/**
 * <OwnerCandidatesStack> — Container qui adapte LocalDossier → StackCandidate
 * et orchestre le workflow "Tinder Like" pour les candidatures owner.
 *
 * Pipeline :
 *   1. Filtre les candidats selon le bien sélectionné (si plusieurs biens)
 *   2. Map LocalDossier → StackCandidate (avec smart alert + synthèse IA)
 *   3. Rend <CandidaturesStackView> avec callbacks
 *   4. Sur "Retenir" → ouvre <SelectionConfirmModal>
 *   5. Sur "Refuser" → enregistre localement le skip (passe au suivant)
 *
 * Utilisé dans :
 *   - TunnelSelection (mode 1-bien, plein écran overlay)
 *   - Page candidatures du dashboard (mode multi-biens, tabs sélecteur)
 */

import * as React from 'react';
import { Building2, X } from 'lucide-react';
import {
  CandidaturesStackView,
  type StackCandidate,
  type AiReportCheck,
  type AiReportStatus,
} from '@/app/components/audit';
import { SelectionConfirmModal } from './SelectionConfirmModal';
import type { LocalDossier, LocalBien } from './ui';
import { formatPrice, getGrade, GRADE_SHORT } from '@/lib/product-lexicon';
import { resolveVerdict, labelForReason } from '@/lib/verdict-system';

// ─── Mapping LocalDossier → StackCandidate ───────────────────────────────────

function buildAlerte(c: LocalDossier): string | undefined {
  if (c.auditStatus === 'ALERT') {
    return c.auditSummary || 'Audit Forensic en alerte — vérification manuelle requise.';
  }
  const rejected = c.rejectedDocuments || 0;
  if (rejected > 0) {
    return `${rejected} pièce${rejected > 1 ? 's' : ''} rejetée${rejected > 1 ? 's' : ''} par l'audit IA.`;
  }
  if (c.watchouts && c.watchouts.length > 0) {
    return c.watchouts[0];
  }
  if (!c.guaranteeMode || c.guaranteeMode === 'NONE') {
    return 'Aucune garantie détectée — Visale fortement recommandée.';
  }
  return undefined;
}

function buildAiSynthesis(c: LocalDossier): string {
  if (c.decisionHeadline && c.decisionHeadline.length > 30) {
    return c.decisionHeadline;
  }
  if (c.auditSummary && c.auditSummary.length > 30) {
    return c.auditSummary;
  }
  const verdict = resolveVerdict(c);
  if (verdict === 'recommended') {
    return "Le profil présente une stabilité financière remarquable. Les flux de revenus sont parfaitement cohérents avec l'ancienneté. Risque de défaut historiquement nul. Dossier éligible à la contractualisation immédiate.";
  }
  if (verdict === 'review') {
    return "Le profil est globalement solide mais nécessite quelques vérifications complémentaires. L'IA recommande de croiser visuellement certaines pièces avant signature.";
  }
  return "ATTENTION : L'analyse approfondie révèle des écarts significatifs entre les documents fournis. Plusieurs points bloquants doivent être levés avant toute contractualisation.";
}

function statusFromAudit(audit?: string): AiReportStatus {
  if (audit === 'CLEAR') return 'success';
  if (audit === 'ALERT') return 'danger';
  return 'warning';
}

/**
 * Construit la liste de contrôles "locataire" pour le drawer détaillé.
 */
function buildTenantChecks(c: LocalDossier): AiReportCheck[] {
  const checks: AiReportCheck[] = [];
  const auditStatus = statusFromAudit(c.auditStatus);
  const verdict = resolveVerdict(c);

  // Identité Didit
  if (c.identityVerified) {
    checks.push({
      status: 'success',
      title: 'Identité biométrique',
      desc: "Vérification Didit certifiée eIDAS.",
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Identité',
      desc: "Vérification biométrique Didit en attente.",
      action: "Inviter le candidat à compléter la vérification d'identité.",
    });
  }

  // Audit Forensic
  if (auditStatus === 'success') {
    checks.push({
      status: 'success',
      title: 'Cohérence fiscale & documents',
      desc:
        c.auditSummary ||
        "Aucune incohérence détectée par l'audit forensic IA.",
    });
  } else if (auditStatus === 'warning') {
    checks.push({
      status: 'warning',
      title: 'Vérifications complémentaires',
      desc: c.auditSummary || 'Quelques points méritent un examen visuel.',
      action: c.watchouts && c.watchouts.length > 0 ? c.watchouts[0] : undefined,
    });
  } else {
    checks.push({
      status: 'danger',
      title: 'Anomalie détectée',
      desc:
        c.auditSummary ||
        "L'IA a détecté des incohérences majeures dans les documents fournis.",
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

  // Watchouts résiduelles
  if (c.watchouts && c.watchouts.length > 0 && auditStatus !== 'warning') {
    checks.push({
      status: verdict === 'risky' ? 'danger' : 'warning',
      title: 'Vigilance',
      desc: c.watchouts[0],
    });
  }

  return checks;
}

/**
 * Construit la liste de contrôles "garant" pour le drawer détaillé.
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
      desc: "Pièce d'identité et justificatifs du garant transmis.",
    });
    checks.push({
      status: 'warning',
      title: 'Solvabilité du garant',
      desc: 'Vérifier que les revenus du garant couvrent au moins 3× le loyer.',
      action: "Examiner les fiches de paie ou avis d'imposition du garant.",
    });
  } else {
    checks.push({
      status: 'warning',
      title: 'Aucune garantie déclarée',
      desc:
        'Le candidat ne dispose ni de Visale ni de garant physique. Risque accru.',
      action: 'Proposer au candidat de souscrire à Visale (gratuit, en ligne).',
    });
  }

  return checks;
}

function mapDossierToStackCandidate(c: LocalDossier, bien: LocalBien): StackCandidate {
  const grade = getGrade(c.score);
  const effortPct =
    typeof c.effortRate === 'number' && c.effortRate > 0
      ? Math.round(c.effortRate * 100)
      : bien.loyer > 0 && c.revenus > 0
      ? Math.round((bien.loyer / c.revenus) * 100)
      : 0;

  // Si reasonCodes présents, on enrichit l'alerte
  let alerte = buildAlerte(c);
  if (!alerte && c.reasonCodes && c.reasonCodes.length > 0) {
    const verdict = resolveVerdict(c);
    if (verdict !== 'recommended') {
      alerte = labelForReason(c.reasonCodes[0]);
    }
  }

  // Couverture garant pour les métriques détaillées
  const guarantorCoverage =
    c.guaranteeMode === 'VISALE'
      ? 'Visale ✓'
      : c.guaranteeMode === 'PHYSICAL'
      ? '3×+'
      : '—';

  return {
    id: c.id,
    prenom: c.prenom || '',
    nom: c.nom || '',
    profession: c.contrat || 'Profil',
    score: Math.max(0, Math.min(100, Math.round(c.score || 0))),
    grade: c.score < 45 ? 'ALERTE' : `GRADE ${GRADE_SHORT[grade]}`,
    revenus: formatPrice(c.revenus || 0),
    loyer: formatPrice(bien.loyer || 0),
    effort: `${effortPct}%`,
    alerte,
    aiSynthesis: buildAiSynthesis(c),
    // ─── V5.3 — Champs étendus pour le drawer détaillé ────────────────────
    detailMetrics: {
      income: formatPrice(c.revenus || 0),
      effortRate: effortPct,
      guarantorCoverage,
    },
    tenantChecks: buildTenantChecks(c),
    guarantorChecks: buildGuarantorChecks(c),
  };
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface OwnerCandidatesStackProps {
  /** Mode 1-bien : bien obligatoire + candidats filtrés à ce bien */
  bien?: LocalBien;
  /** Mode multi-biens : tous les biens du portefeuille */
  biens?: LocalBien[];
  /** Tous les candidats (non-scellés). Filtrés ici selon le bien sélectionné. */
  candidats: LocalDossier[];
  /** Callback quand l'utilisateur retient un candidat (après confirmation modale) */
  onAccept: (c: LocalDossier) => void;
  /** Callback quand l'utilisateur refuse (par défaut : skip silencieux local) */
  onReject?: (c: LocalDossier) => void;
  /** Affiche le header avec bouton fermer (mode overlay) */
  showCloseButton?: boolean;
  onClose?: () => void;
  className?: string;
}

// ─── Composant principal ────────────────────────────────────────────────────

export function OwnerCandidatesStack({
  bien,
  biens,
  candidats,
  onAccept,
  onReject,
  showCloseButton = false,
  onClose,
  className = '',
}: OwnerCandidatesStackProps): React.ReactElement {
  // Mode multi-biens : sélecteur de bien si > 1 bien avec candidatures
  const biensWithCandidates = React.useMemo(() => {
    if (bien) return [bien];
    if (!biens) return [];
    const counts = new Map<string, number>();
    candidats.forEach((c) => {
      if (!c.isSealed) counts.set(c.bien_id, (counts.get(c.bien_id) || 0) + 1);
    });
    return biens.filter((b) => (counts.get(b.id) || 0) > 0);
  }, [bien, biens, candidats]);

  const [selectedBienId, setSelectedBienId] = React.useState<string | null>(
    biensWithCandidates[0]?.id || null,
  );

  const activeBien = React.useMemo(
    () => biensWithCandidates.find((b) => b.id === selectedBienId) || biensWithCandidates[0],
    [biensWithCandidates, selectedBienId],
  );

  // Filtre des candidats pour le bien actif
  const filteredCandidats = React.useMemo(() => {
    if (!activeBien) return [];
    return candidats.filter(
      (c) => c.bien_id === activeBien.id && !c.isSealed,
    );
  }, [candidats, activeBien]);

  // Mapping vers StackCandidate
  const stackCandidates = React.useMemo(() => {
    if (!activeBien) return [];
    return filteredCandidats.map((c) => mapDossierToStackCandidate(c, activeBien));
  }, [filteredCandidats, activeBien]);

  // État de la modale de confirmation
  const [pendingAccept, setPendingAccept] = React.useState<LocalDossier | null>(null);

  const handleStackAccept = React.useCallback(
    (stack: StackCandidate) => {
      const real = filteredCandidats.find((c) => c.id === stack.id);
      if (real) setPendingAccept(real);
    },
    [filteredCandidats],
  );

  const handleStackReject = React.useCallback(
    (stack: StackCandidate) => {
      const real = filteredCandidats.find((c) => c.id === stack.id);
      if (real) onReject?.(real);
    },
    [filteredCandidats, onReject],
  );

  // Empty state
  if (biensWithCandidates.length === 0) {
    return (
      <div
        className={`flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 ${className}`}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <Building2 className="h-8 w-8 text-slate-400" aria-hidden="true" />
        </div>
        <p className="font-serif text-xl font-semibold text-emerald-900">
          Aucune candidature reçue
        </p>
        <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
          Partagez votre Sésame sur LeBonCoin pour recevoir vos premières
          candidatures déjà analysées par l'IA.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Header avec bouton close (mode overlay) */}
      {showCloseButton && onClose && (
        <div className="sticky top-0 z-30 flex items-center justify-end border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la revue des candidatures"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Sélecteur de bien (mode multi-biens) */}
      {!bien && biensWithCandidates.length > 1 && (
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur md:px-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Bien sélectionné
          </p>
          <div className="flex flex-wrap gap-2">
            {biensWithCandidates.map((b) => {
              const count = candidats.filter(
                (c) => c.bien_id === b.id && !c.isSealed,
              ).length;
              const active = b.id === activeBien?.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBienId(b.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-emerald-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="truncate max-w-[180px]">{b.label}</span>
                  <span
                    className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                      active
                        ? 'bg-amber-500 text-emerald-900'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stack view — persistance localStorage par bien (V5.4) */}
      {activeBien && stackCandidates.length > 0 ? (
        <CandidaturesStackView
          key={activeBien.id}
          candidates={stackCandidates}
          onAccept={handleStackAccept}
          onReject={handleStackReject}
          persistKey={`patrimo:stack:${activeBien.id}`}
        />
      ) : (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
          <p className="font-serif text-xl font-semibold text-emerald-900">
            Pile vide pour ce bien
          </p>
          <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
            Toutes les candidatures de ce bien ont été examinées.
          </p>
        </div>
      )}

      {/* Modale de confirmation au "Retenir" */}
      {pendingAccept && (
        <SelectionConfirmModal
          open={!!pendingAccept}
          onClose={() => setPendingAccept(null)}
          onConfirm={() => {
            onAccept(pendingAccept);
            setPendingAccept(null);
          }}
          candidateName={`${pendingAccept.prenom} ${pendingAccept.nom}`}
          verdict={resolveVerdict(pendingAccept)}
          reasonCodes={pendingAccept.reasonCodes}
        />
      )}
    </div>
  );
}
