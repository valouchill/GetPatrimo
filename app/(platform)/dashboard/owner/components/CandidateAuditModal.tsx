'use client';

import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  Sparkles,
  Folder,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type { LocalDossier, LocalBien } from './ui';
import { SelectionConfirmModal } from './SelectionConfirmModal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Button } from '@/app/components/ui/Button';
import { Overlay } from '@/app/components/ui/Overlay';
import {
  CandidateAiReport,
  type AiReportCandidate,
  type AiReportCheck,
  type AiReportStatus,
  ReanalyzeButton,
  CandidateDossier,
  type DossierDocument,
} from '@/app/components/audit';
import {
  PRODUCT,
  formatPrice,
  getMetalLevel,
  METAL_BADGE_CLASS,
  METAL_LABELS,
} from '@/lib/product-lexicon';
import { resolveVerdict } from '@/lib/verdict-system';
import { AnalysisV2Panel } from './AnalysisV2Panel';

export interface CandidateAuditModalProps {
  open: boolean;
  candidate: LocalDossier;
  bien: LocalBien;
  onClose: () => void;
  /**
   * Handler de confirmation de sélection. Peut retourner une Promise :
   * pendant qu'elle est en cours, la modale de confirmation affiche un
   * spinner + bouton désactivé et ne se ferme qu'au succès (le rejet
   * laisse la modale ouverte pour retry).
   */
  onSelect: (c: LocalDossier) => void | Promise<void>;
  /**
   * V7.12.1 — Si le candidat est deja selectionne et qu'on veut permettre
   * a l'owner de RETIRER la selection (toggle off).
   * Si non fournie, le bouton "Ecarter" ferme juste la modale.
   */
  onUnselect?: (c: LocalDossier) => void | Promise<void>;
  /**
   * V7.12.1 — Si fourni ET candidat selectionne, le bouton primaire
   * devient "Reprendre la preparation du bail" -> redirige vers /lease.
   */
  onResumeLease?: (c: LocalDossier) => void;
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
  // V6.6 — Métal institutionnel
  const gradeLabel = METAL_LABELS[getMetalLevel(c.score)];

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
  onUnselect,
  onResumeLease,
}: CandidateAuditModalProps) {
  const titleId = React.useId();
  const bodyScrollRef = React.useRef<HTMLDivElement>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmLoading, setConfirmLoading] = React.useState(false);
  // V7.12.1 — Etat dedie a l'action "retirer la selection"
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // V5.6 — État des pièces du dossier (fetch on open)
  const [docs, setDocs] = React.useState<DossierDocument[]>([]);
  const [docsLoading, setDocsLoading] = React.useState(false);
  const [docsError, setDocsError] = React.useState<string | null>(null);

  // V7.13 — Indice de Résilience V2 (source de vérité du header).
  // Fetché depuis le cache aiAuditV2 au montage ; mis à jour live par
  // <AnalysisV2Panel> (onResult) si l'owner relance l'analyse.
  const [v2Resilience, setV2Resilience] = React.useState<{
    score: number;
    level: string;
  } | null>(null);

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

  // Fetch des pièces dès que la modale s'ouvre (par candidat)
  React.useEffect(() => {
    if (!open || !c?.id) return;
    let cancelled = false;
    setDocsLoading(true);
    setDocsError(null);
    setDocs([]);
    fetch(`/api/owner/applications/${c.id}/documents`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Erreur ${res.status}`);
        }
        return res.json();
      })
      .then((data: { documents: DossierDocument[] }) => {
        if (cancelled) return;
        setDocs(Array.isArray(data.documents) ? data.documents : []);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setDocsError(err.message || 'Erreur réseau');
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, c?.id]);

  // V7.13 — Fetch du cache aiAuditV2 au montage (GET, pas d'appel OpenAI)
  // pour afficher l'Indice de Résilience V2 dans le header dès l'ouverture.
  React.useEffect(() => {
    if (!open || !c?.id) return;
    let cancelled = false;
    setV2Resilience(null);
    fetch(`/api/owner/applications/${c.id}/analyze-v2`, { cache: 'no-store' })
      .then(async (res) => {
        if (res.status !== 200) return null;
        return res.json();
      })
      .then((data: { resilience?: { score?: number; level?: string } } | null) => {
        if (cancelled || !data?.resilience) return;
        if (
          typeof data.resilience.score === 'number' &&
          typeof data.resilience.level === 'string'
        ) {
          setV2Resilience({
            score: data.resilience.score,
            level: data.resilience.level,
          });
        }
      })
      .catch(() => {
        /* pas de cache V2 ou erreur réseau → fallback score legacy */
      });
    return () => {
      cancelled = true;
    };
  }, [open, c?.id]);

  const effectiveResilience = React.useMemo(() => {
    const score = v2Resilience
      ? Math.max(0, Math.min(100, Math.round(v2Resilience.score)))
      : Math.max(0, Math.min(100, Math.round(c?.score || 0)));
    const level = (v2Resilience?.level || getMetalLevel(score)) as keyof typeof METAL_BADGE_CLASS;
    return { score, level, isV2: Boolean(v2Resilience) };
  }, [c?.score, v2Resilience]);

  // V7.12.1 — useMemo defensif (null-safe) avant le early return
  const reportCandidate = React.useMemo(
    () => (c && bien ? dossierToAiReport({ ...c, score: effectiveResilience.score }, bien) : null),
    [c, bien, effectiveResilience.score],
  );

  if (!c || !bien || !reportCandidate) return null;

  // V7.12.1 — Etat metier de la selection
  const isSelected = c.statut === 'selectionne';
  const canChangeSelection = !['LEASE_IN_PROGRESS', 'OCCUPIED'].includes(
    String(bien.status || '').toUpperCase(),
  );
  const canRenderUnselect = isSelected && Boolean(onUnselect);
  const isBusy = confirmLoading || actionLoading;

  const handleUnselect = async (): Promise<void> => {
    if (!onUnselect) return;
    if (!canChangeSelection) {
      setActionError('Le bail est engagé, la sélection ne peut plus être modifiée.');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await Promise.resolve(onUnselect(c));
      onClose();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Impossible de retirer la sélection.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const decisionButtons = (
    <>
      <Button
        variant="outline"
        size="md"
        onClick={canRenderUnselect ? handleUnselect : onClose}
        disabled={isBusy}
        loading={canRenderUnselect && actionLoading}
        iconLeft={<XCircle className="h-4 w-4" />}
        className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 sm:flex-none"
      >
        {canRenderUnselect ? 'Retirer la sélection' : 'Écarter'}
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={isSelected ? () => onResumeLease?.(c) : () => setConfirmOpen(true)}
        disabled={isBusy || (isSelected && !onResumeLease)}
        iconRight={<CheckCircle2 className="h-4 w-4" />}
        className="flex-1 bg-amber-500 text-white hover:bg-amber-600 shadow-amber sm:flex-1"
      >
        {isSelected ? 'Reprendre le bail' : 'Retenir ce locataire'}
      </Button>
    </>
  );

  return (
    <>
      <Overlay
        open={open}
        onClose={onClose}
        variant="fullscreen"
        size="5xl"
        zToken="modal"
        ariaLabelledBy={titleId}
      >
            {/* ─── STICKY HEADER (identite + score V2 + actions) ──── */}
            <header
              className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl md:px-6 md:pb-5 md:pt-5"
              id={titleId}
            >
              {/* Ligne 1 : identite + score + close */}
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                    Dossier Candidat
                  </p>
                  <h2 className="mt-0.5 truncate font-serif text-xl font-bold leading-tight text-emerald-900 sm:text-3xl">
                    {c.isColocation && c.householdLabel
                      ? c.householdLabel
                      : `${(c.prenom || '').trim()} ${(c.nom || '').trim()}`.trim()}
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {c.contrat || 'Profil'}
                    {bien?.label ? ` · ${bien.label}` : ''}
                  </p>
                  {/* Colocation — composition du foyer + statut d'identité par colocataire */}
                  {c.isColocation && Array.isArray(c.coTenants) && c.coTenants.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        <Users className="h-3 w-3" aria-hidden="true" /> Foyer ·{' '}
                        {c.householdSize || 1 + c.coTenants.length} personnes
                      </span>
                      {c.coTenants.map((m) => (
                        <span
                          key={m.slot}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
                            m.identityVerified
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : 'bg-amber-50 text-amber-700 ring-amber-200'
                          }`}
                          title={m.identityVerified ? 'Identité certifiée (eIDAS)' : 'Identité en attente'}
                        >
                          {m.identityVerified ? (
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Clock className="h-3 w-3" aria-hidden="true" />
                          )}
                          {`${m.firstName || 'Colocataire'} ${m.lastName || ''}`.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score + niveau (SOURCE UNIQUE DE VÉRITÉ = Indice de
                    Résilience V2 si disponible, sinon fallback score legacy).
                    V7.13 — le header reflète exactement le score de l'onglet
                    "Audit Forensic" (computeResilienceIndex). */}
                {(() => {
                  // V2 prioritaire ; le `level` V2 est déjà PLATINUM/GOLD/…
                  const { score, level, isV2 } = effectiveResilience;
                  return (
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        Indice de Résilience
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="tabular-nums font-serif text-2xl font-bold leading-none text-emerald-900 sm:text-4xl">
                          {score}
                        </span>
                        <span className="text-sm font-semibold text-slate-500">
                          /100
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${METAL_BADGE_CLASS[level]}`}
                        aria-label={`Niveau ${METAL_LABELS[level]}`}
                        title={
                          isV2
                            ? 'Indice de Résilience V2 (analyse neuro-symbolique)'
                            : "Score legacy — lancez l'analyse V2 dans l'onglet Audit Forensic"
                        }
                      >
                        {level === 'PLATINUM' && (
                          <span aria-hidden="true" className="mr-1">★</span>
                        )}
                        {METAL_LABELS[level]}
                      </span>
                    </div>
                  );
                })()}

                {/* PDF + Re-analyze + Close (compact top-right) */}
                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                  {c.passportDownloadUrl && (
                    <a
                      href={c.passportDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-100"
                      title={`Télécharger le ${PRODUCT.PASSEPORT} PDF`}
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">PDF</span>
                    </a>
                  )}
                  <ReanalyzeButton
                    applicationId={c.id}
                    documentsCount={
                      (c.certifiedDocuments || 0) +
                      (c.reviewDocuments || 0) +
                      (c.rejectedDocuments || 0)
                    }
                    alreadyReanalyzed={c.reanalyzed === true}
                    variant="ghost"
                    size="sm"
                    onSuccess={() => {
                      if (typeof window !== 'undefined')
                        window.location.reload();
                    }}
                  />
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer le dossier candidat"
                    className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Ligne 2 : actions principales (state-aware, toujours visibles).
                  V7.12.1 — Si candidat selectionne ET onResumeLease fourni,
                  bascule en "Reprendre la preparation du bail" + bouton
                  rouge devient "Retirer la selection" si onUnselect dispo. */}
              <div className="mt-4 hidden gap-2 sm:flex sm:flex-row sm:items-center">
                {decisionButtons}
              </div>
            </header>

            {/* AIPD §2.4 / M9 — art. 22 RGPD : la sortie IA est une aide à la décision,
                jamais une décision. Mention systématique sur l'écran où l'owner tranche. */}
            <p className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-1.5 text-[10px] leading-snug text-slate-500 md:px-6 md:py-2 md:text-[11px]">
              Analyse générée par IA — <strong className="font-semibold text-slate-600">résultat indicatif</strong> nécessitant
              votre vérification humaine des pièces. La décision de location vous appartient ; le candidat peut
              signaler une erreur d&apos;analyse et obtenir un réexamen. Maison Patrimo ne garantit
              pas la solvabilité future du locataire.
            </p>

            {/* V7.12.1 — Banners metier (erreur + info "deja selectionne") */}
            {actionError && (
              <div
                role="alert"
                className="shrink-0 border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 md:px-6"
              >
                {actionError}
              </div>
            )}
            {isSelected && !actionError && (
              <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 md:px-6">
                Locataire retenu pour ce bien. Vous pouvez reprendre le bail
                ou retirer la sélection tant que le bail n&apos;est pas engagé.
              </div>
            )}

            {/* ─── TABS (Synthese / Forensic / Coffre-fort) ──────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <Tabs
                defaultValue="synthesis"
                onValueChange={() =>
                  bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
                }
                className="flex flex-1 flex-col overflow-hidden"
              >
                <div className="shrink-0 px-4 pt-2 pb-2 md:px-6 md:pt-4">
                  <TabsList className="w-full">
                    <TabsTrigger value="synthesis">
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        Synthèse &amp; IA
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="forensic">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Audit Forensic
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="documents">
                      <span className="inline-flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5" aria-hidden="true" />
                        Coffre-fort
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Zone scroll independante (le header reste fixe) */}
                <div
                  ref={bodyScrollRef}
                  className="flex-1 overflow-y-auto overscroll-contain bg-slate-50 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
                >
                  <TabsContent value="synthesis">
                    {/* CandidateAiReport sans son footer d'actions :
                        Onclick onValidate/onReject = undefined -> footer masqué.
                        Les actions sont dans notre sticky header. */}
                    <CandidateAiReport candidate={reportCandidate} />
                  </TabsContent>

                  <TabsContent value="forensic">
                    {/* V2 algo neuro-symbolique : score V2 + breakdown par
                        pilier + Trust-List forensicAudit + hard gates */}
                    <AnalysisV2Panel
                      applicationId={c.id}
                      onResult={(r) => setV2Resilience(r)}
                      diditVerified={c.identityVerified === true}
                    />
                  </TabsContent>

                  <TabsContent value="documents">
                    {/* V5.8 — Trust-List documentaire adaptee au profil + Didit */}
                    <CandidateDossier
                      candidateName={`${c.prenom} ${c.nom}`.trim()}
                      candidateJob={c.contrat}
                      diditVerified={c.identityVerified === true}
                      score={c.score}
                      documents={docs}
                      loading={docsLoading}
                      error={docsError}
                      showScoring={false}
                      showHeader={false}
                      viewerIdentity={`Propriétaire · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Barre d'action mobile (pouce) — la décision migre en bas sur
                mobile pour alléger l'en-tête fixe. Masquée en desktop (boutons
                dans le header). */}
            <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur-xl sm:hidden">
              {decisionButtons}
            </div>
      </Overlay>

      {/* Modale de confirmation déclenchée par "Valider".
          La modale reste ouverte pendant l'appel API (onSelect peut être
          async) ; on affiche le spinner via le prop `loading`. Au succès,
          on ferme. À l'échec, on garde la modale pour permettre le retry. */}
      <SelectionConfirmModal
        open={confirmOpen}
        onClose={() => {
          if (confirmLoading) return; // bloque la fermeture pendant l'API
          setConfirmOpen(false);
        }}
        onConfirm={async () => {
          if (confirmLoading) return;
          setConfirmLoading(true);
          try {
            await Promise.resolve(onSelect(c));
            setConfirmOpen(false);
          } catch {
            // L'erreur est gérée côté parent (toast / alert).
            // On garde juste la modale ouverte pour retry.
          } finally {
            setConfirmLoading(false);
          }
        }}
        candidateName={`${c.prenom} ${c.nom}`}
        verdict={resolveVerdict(c)}
        reasonCodes={c.reasonCodes}
        loading={confirmLoading}
      />
    </>
  );
}
