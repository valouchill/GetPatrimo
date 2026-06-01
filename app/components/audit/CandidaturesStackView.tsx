'use client';

/**
 * <CandidaturesStackView> — Workflow "Tinder Like" + Side-Drawer + Undo.
 *
 * V5.3 — Évolutions majeures :
 *   1. Click sur la carte → ouverture <Sheet> latéral droit avec
 *      <CandidateAiReport> complet (rapport audit IA premium)
 *   2. Historique des décisions en bas du stack (badges compacts)
 *      avec bouton "Rembobiner" (undo) pour ré-injecter dans le stack
 *
 * Spec utilisateur respectée :
 *   - State management React hooks (candidatesStack, historyLog, isDrawerOpen)
 *   - handleDecision(id, status) : push history + pop stack
 *   - handleUndo(id) : remove history + unshift stack
 *   - Sheet latéral coulissant (custom motion drawer style shadcn/ui)
 *   - Animations fluides 300ms transition-all
 *   - Badges discrets : fonds dépolis, opacité 80%
 */

import * as React from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Quote,
  ShieldCheck,
  Undo2,
  History,
} from 'lucide-react';
import { CandidateAiReport, type AiReportCandidate, type AiReportCheck, type AiReportMetrics } from './CandidateAiReport';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StackCandidate {
  id: string;
  prenom: string;
  nom: string;
  initiales?: string;
  profession: string;
  /** Indice de Résilience 0–100 */
  score: number;
  /** Label grade (ex: "GRADE B", "ALERTE") */
  grade?: string;
  /** Libellés formatés */
  revenus: string;
  loyer: string;
  effort: string;
  /** Alerte conditionnelle (encart rouge intégré) */
  alerte?: string;
  /** Synthèse IA — note de détective serif italique */
  aiSynthesis?: string;
  // ─── V5.3 — Champs étendus pour le drawer détaillé ─────────────────────
  /** Métriques détaillées affichées dans <CandidateAiReport> */
  detailMetrics?: AiReportMetrics;
  /** Contrôles audit locataire (statuts tricolores) */
  tenantChecks?: AiReportCheck[];
  /** Contrôles audit garant */
  guarantorChecks?: AiReportCheck[];
}

export type DecisionStatus = 'accepted' | 'rejected';

export interface HistoryEntry {
  id: string;
  name: string;
  initiales: string;
  decision: DecisionStatus;
  timestamp: number;
}

export interface CandidaturesStackViewProps {
  candidates: StackCandidate[];
  /** Callback quand l'utilisateur retient un candidat */
  onAccept?: (candidate: StackCandidate) => void;
  /** Callback quand l'utilisateur refuse un candidat */
  onReject?: (candidate: StackCandidate) => void;
  /** Callback optionnel quand l'utilisateur rembobine une décision */
  onUndo?: (candidate: StackCandidate, previousDecision: DecisionStatus) => void;
  /** Activer le drag swipe gestures (par défaut true) */
  enableSwipe?: boolean;
  /** Activer l'historique en bas du stack (par défaut true) */
  enableHistory?: boolean;
  /** Activer le click sur la carte → drawer (par défaut true) */
  enableDrawer?: boolean;
  /**
   * V8.2 (Mission 3) — Si fourni, le click sur une carte appelle ce callback
   * (pour ouvrir la MODALE CENTRALE <CandidateAuditModal> à onglets) au lieu
   * du Sheet latéral interne. Garantit une lecture de dossier identique
   * partout. Si absent, fallback sur le Sheet interne (rétrocompat / démo).
   */
  onOpenDetail?: (candidateId: string) => void;
  /**
   * Clé de persistance localStorage (V5.4). Si fournie, l'historique des
   * décisions est sauvegardé localement et les candidats déjà décidés
   * (acceptés OU refusés) sont filtrés du stack au chargement.
   *
   * Format suggéré : "patrimo:stack:{bienId}" (par bien).
   *
   * Note : la décision finale "accept" est toujours posée côté serveur
   * via le callback parent (POST /selection). Cette persistance locale
   * permet juste de ne pas re-proposer les candidats déjà refusés au
   * propriétaire après un reload / navigation.
   */
  persistKey?: string;
  className?: string;
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

interface PersistedState {
  history: HistoryEntry[];
  /** Version du schéma (pour migration future) */
  v?: number;
}

function loadPersistedHistory(persistKey: string | undefined): HistoryEntry[] {
  if (!persistKey || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(persistKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PersistedState;
    if (Array.isArray(parsed.history)) {
      // Valider la forme de chaque entrée
      return parsed.history.filter(
        (h) =>
          h &&
          typeof h.id === 'string' &&
          typeof h.name === 'string' &&
          (h.decision === 'accepted' || h.decision === 'rejected'),
      );
    }
  } catch {
    // Storage corrompu ou non-sérialisable — on ignore et repart de zéro
  }
  return [];
}

function savePersistedHistory(persistKey: string | undefined, history: HistoryEntry[]): void {
  if (!persistKey || typeof window === 'undefined') return;
  try {
    const payload: PersistedState = { history, v: 1 };
    window.localStorage.setItem(persistKey, JSON.stringify(payload));
  } catch {
    // Quota dépassé ou storage désactivé — on ignore (V1 best-effort)
  }
}

function clearPersistedHistory(persistKey: string | undefined): void {
  if (!persistKey || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(persistKey);
  } catch {
    // ignore
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeInitials(prenom: string, nom: string): string {
  const a = (prenom || '?').trim()[0] || '?';
  const b = (nom || '').trim()[0] || '';
  return `${a}${b}`.toUpperCase();
}

function pickGrade(score: number): string {
  if (score >= 90) return 'GRADE S';
  if (score >= 75) return 'GRADE A';
  if (score >= 60) return 'GRADE B';
  if (score >= 40) return 'GRADE C';
  return 'ALERTE';
}

function getShortName(candidate: { prenom: string; nom: string }): string {
  const last = (candidate.nom || '').trim();
  const lastInitial = last ? `${last[0].toUpperCase()}.` : '';
  return `${candidate.prenom} ${lastInitial}`.trim();
}

// ─── Sub-component : Jauge Sésame SVG ────────────────────────────────────────

function SesameGauge({ score, size = 110 }: { score: number; size?: number }): React.ReactElement {
  const safe = Math.max(0, Math.min(100, score));
  const STROKE = 9;
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safe / 100);
  const center = size / 2;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-slate-100"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="stroke-amber-500 transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-4xl font-bold leading-none text-emerald-900">
          {safe}
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          / 100
        </span>
      </div>
    </div>
  );
}

// ─── Sub-component : Top card (interactive) ──────────────────────────────────

interface TopCardProps {
  candidate: StackCandidate;
  onAccept: () => void;
  onReject: () => void;
  onClickDetails: () => void;
  enableSwipe: boolean;
  enableDrawer: boolean;
}

function TopCard({
  candidate,
  onAccept,
  onReject,
  onClickDetails,
  enableSwipe,
  enableDrawer,
}: TopCardProps): React.ReactElement {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0, 1, 1, 1, 0]);
  const acceptOverlay = useTransform(x, [0, 150], [0, 1]);
  const rejectOverlay = useTransform(x, [-150, 0], [1, 0]);

  // Anti-tap-during-swipe : on track le déplacement pendant le drag
  const dragMoved = React.useRef(false);

  const handleDragStart = () => {
    dragMoved.current = false;
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 5) dragMoved.current = true;
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 120;
    if (info.offset.x > threshold) {
      onAccept();
    } else if (info.offset.x < -threshold) {
      onReject();
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (!enableDrawer) return;
    if (dragMoved.current) return; // ignore le click si on a draggé
    // Ignore les clicks sur les boutons enfants (anti-bubble)
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    onClickDetails();
  };

  const initials = candidate.initiales || computeInitials(candidate.prenom, candidate.nom);
  const fullName = `${candidate.prenom} ${candidate.nom}`.trim();
  const grade = candidate.grade || pickGrade(candidate.score);
  const isAlert = !!candidate.alerte || candidate.score < 45;

  return (
    <motion.article
      drag={enableSwipe ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClick={handleCardClick}
      style={{ x, rotate, opacity }}
      className={`relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/60 ${
        enableDrawer ? 'cursor-pointer active:cursor-grabbing' : 'cursor-grab active:cursor-grabbing'
      }`}
      whileTap={{ scale: 0.99 }}
      role={enableDrawer ? 'button' : 'article'}
      tabIndex={enableDrawer ? 0 : -1}
      aria-label={
        enableDrawer
          ? `Voir le détail complet de ${fullName} (score ${candidate.score}/100)`
          : `${fullName}, score ${candidate.score}/100`
      }
      onKeyDown={(e) => {
        if (enableDrawer && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClickDetails();
        }
      }}
    >
      {/* Overlays decision feedback (swipe) */}
      <motion.div
        style={{ opacity: acceptOverlay }}
        className="pointer-events-none absolute right-6 top-6 z-20 rotate-12 rounded-xl border-4 border-emerald-500 px-4 py-2"
      >
        <span className="font-serif text-xl font-bold uppercase tracking-wider text-emerald-600">
          Retenu
        </span>
      </motion.div>
      <motion.div
        style={{ opacity: rejectOverlay }}
        className="pointer-events-none absolute left-6 top-6 z-20 -rotate-12 rounded-xl border-4 border-red-500 px-4 py-2"
      >
        <span className="font-serif text-xl font-bold uppercase tracking-wider text-red-600">
          Refusé
        </span>
      </motion.div>

      {/* Header — Identité + grade */}
      <header className="flex items-start gap-4 border-b border-slate-100 px-7 pt-7 pb-5">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-900 font-serif text-lg font-bold text-amber-500 shadow-sm"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="truncate font-serif text-xl font-semibold leading-tight text-emerald-900">
            {fullName}
          </h3>
          <p className="mt-0.5 truncate text-sm text-slate-500">{candidate.profession}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${
            isAlert
              ? 'bg-red-50 text-red-700 ring-red-200'
              : candidate.score >= 75
              ? 'bg-amber-50 text-amber-800 ring-amber-200'
              : 'bg-amber-100 text-amber-800 ring-amber-200'
          }`}
        >
          {isAlert ? (
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {grade}
        </span>
      </header>

      {/* Jauge Sésame centrée */}
      <div className="flex flex-col items-center px-7 pt-7">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
          Indice de Résilience
        </p>
        <SesameGauge score={candidate.score} />
      </div>

      {/* Note de Détective */}
      {candidate.aiSynthesis && (
        <div className="mx-7 mt-7 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            <Quote className="h-3.5 w-3.5" aria-hidden="true" />
            Note de l'auditeur
          </div>
          <p className="line-clamp-4 font-serif text-sm italic leading-relaxed text-emerald-900">
            {candidate.aiSynthesis}
          </p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            — Synthèse PatrimoTrust · Confidentielle
          </p>
        </div>
      )}

      {/* Grille 3 métriques */}
      <div className="mx-7 mt-5 rounded-xl bg-slate-50/60 px-1 py-3 ring-1 ring-slate-100">
        <div className="flex">
          <div className="flex-1 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Revenus
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{candidate.revenus}</p>
          </div>
          <div className="flex-1 border-l border-slate-100 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Loyer
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{candidate.loyer}</p>
          </div>
          <div className="flex-1 border-l border-slate-100 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Effort
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{candidate.effort}</p>
          </div>
        </div>
      </div>

      {/* Smart Alert */}
      {candidate.alerte && (
        <div
          className="mx-7 mt-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/60 p-3"
          role="alert"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-red-900/90">{candidate.alerte}</p>
        </div>
      )}

      {/* Hint cliquable */}
      {enableDrawer && (
        <p className="mx-7 mt-5 mb-7 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Cliquez pour le rapport d'audit complet →
        </p>
      )}
      {!enableDrawer && <div className="h-7" aria-hidden="true" />}
    </motion.article>
  );
}

// ─── Sub-component : Behind cards ────────────────────────────────────────────

function BehindCard({
  candidate,
  position,
}: {
  candidate: StackCandidate;
  position: 1 | 2 | 3 | 4;
}): React.ReactElement {
  const offsetY = position * 12;
  const scale = 1 - position * 0.05;
  const opacityValue = position === 1 ? 0.7 : position === 2 ? 0.45 : position === 3 ? 0.25 : 0.1;
  const initials = candidate.initiales || computeInitials(candidate.prenom, candidate.nom);

  return (
    <motion.div
      initial={{ y: offsetY - 8, scale: scale - 0.02, opacity: 0 }}
      animate={{ y: offsetY, scale, opacity: opacityValue }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 rounded-3xl bg-white shadow-lg ring-1 ring-slate-200/40"
      aria-hidden="true"
      style={{ zIndex: 10 - position }}
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-7 py-5 opacity-60">
        <div className="h-10 w-10 rounded-full bg-emerald-900/80 font-serif text-sm font-bold text-amber-500/80 flex items-center justify-center">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="mt-1.5 h-2 w-20 rounded bg-slate-100" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sub-component : History bar (badges + undo) ─────────────────────────────

function HistoryBar({
  history,
  onUndo,
}: {
  history: HistoryEntry[];
  onUndo: (id: string) => void;
}): React.ReactElement | null {
  if (history.length === 0) return null;

  // Plus récent en premier
  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
  const visible = sorted.slice(0, 6);
  const overflow = sorted.length - visible.length;

  return (
    <section
      aria-label="Historique des décisions récentes"
      className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <History className="h-3 w-3" aria-hidden="true" />
          Décisions récentes
        </div>
        {overflow > 0 && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            +{overflow} plus tôt
          </span>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {visible.map((entry) => {
          const isAccepted = entry.decision === 'accepted';
          return (
            <li key={entry.id} className="group">
              <div
                className={`relative inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold ring-1 backdrop-blur transition-all ${
                  isAccepted
                    ? 'bg-emerald-50/80 text-emerald-700 ring-emerald-200/80'
                    : 'bg-red-50/80 text-red-700 ring-red-200/80'
                }`}
              >
                {/* Initiales mini avatar */}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full font-serif text-[9px] font-bold ${
                    isAccepted
                      ? 'bg-emerald-700 text-amber-300'
                      : 'bg-red-700 text-white'
                  }`}
                  aria-hidden="true"
                >
                  {entry.initiales}
                </span>
                {/* Status icon + nom */}
                {isAccepted ? (
                  <Check className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <X className="h-3 w-3" aria-hidden="true" />
                )}
                <span className="max-w-[100px] truncate">{entry.name}</span>
                {/* Undo button */}
                <button
                  type="button"
                  onClick={() => onUndo(entry.id)}
                  aria-label={`Rembobiner la décision pour ${entry.name}`}
                  title={`Revenir sur ce choix (${entry.name})`}
                  className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 opacity-60 transition-all hover:bg-white hover:text-slate-900 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
                >
                  <Undo2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Sub-component : Side drawer (sheet style shadcn/ui) ─────────────────────

function DetailsSheet({
  open,
  candidate,
  onClose,
  onAccept,
  onReject,
}: {
  open: boolean;
  candidate: StackCandidate | null;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
}): React.ReactElement {
  // ESC ferme le drawer
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Mappage StackCandidate → AiReportCandidate
  const reportCandidate: AiReportCandidate | null = React.useMemo(() => {
    if (!candidate) return null;
    return {
      name: `${candidate.prenom} ${candidate.nom}`.trim(),
      job: candidate.profession,
      score: candidate.score,
      grade: candidate.grade || pickGrade(candidate.score),
      metrics: candidate.detailMetrics || {
        income: candidate.revenus,
        effortRate: Number.parseFloat(candidate.effort) || 0,
        guarantorCoverage: '—',
      },
      aiSynthesis:
        candidate.aiSynthesis ||
        "Synthèse détaillée non disponible pour ce dossier. Consultez les pièces justificatives pour analyse manuelle.",
      tenantChecks: candidate.tenantChecks || [
        {
          status: candidate.alerte ? 'warning' : 'success',
          title: 'Audit IA global',
          desc: candidate.alerte || 'Aucune anomalie détectée par l\'audit forensic.',
        },
      ],
      guarantorChecks: candidate.guarantorChecks || [
        {
          status: 'warning',
          title: 'Détails garant non chargés',
          desc: 'Cliquez sur "Voir le dossier complet" depuis la modale d\'audit pour les détails.',
        },
      ],
    };
  }, [candidate]);

  return (
    <AnimatePresence>
      {open && reportCandidate && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Sheet panel — slide depuis la droite (desktop), bottom-sheet (mobile)
              Le bouton close est positionné en absolute par rapport à CE
              conteneur (et NON à l'intérieur du score), garanti par z-30
              local (toujours en-dessous de la nav globale z-50). */}
          <motion.aside
            key="sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Rapport d'audit IA détaillé"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-[201] flex w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl md:rounded-l-3xl"
          >
            {/* Floating close button — absolute top-4 right-4 (sur le conteneur
                principal de la modale, pas dans la div du score) */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le panneau de détails"
              className="absolute right-4 top-4 z-30 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-sm backdrop-blur transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            </button>

            {/* Contenu scrollable — le pb-24 de la section Audit du
                CandidateAiReport garantit déjà que le dernier élément peut
                scroller au-dessus du footer sticky (z-10) sans être caché.
                Le CandidateAiReport ajoute aussi pr-14 sur son header pour
                que le score badge ne chevauche pas le bouton close (z-30). */}
            <div className="flex-1 overflow-y-auto">
              <CandidateAiReport
                candidate={reportCandidate}
                onValidate={() => {
                  onClose();
                  // Petite temporisation pour l'animation de fermeture
                  setTimeout(() => onAccept(), 280);
                }}
                onReject={() => {
                  onClose();
                  setTimeout(() => onReject(), 280);
                }}
              />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset?: () => void }): React.ReactElement {
  return (
    <div className="flex w-full max-w-md flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-sm ring-1 ring-slate-200/60">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
        <ShieldCheck className="h-8 w-8 text-emerald-700" aria-hidden="true" />
      </div>
      <h3 className="font-serif text-2xl font-semibold text-emerald-900">
        Toutes les candidatures sont traitées
      </h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Vous avez passé en revue l'ensemble des dossiers reçus pour ce bien.
        Utilisez l'historique en bas pour rembobiner une décision si besoin.
      </p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Rejouer la démo
        </button>
      )}
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function CandidaturesStackView({
  candidates,
  onAccept,
  onReject,
  onUndo,
  enableSwipe = true,
  enableHistory = true,
  enableDrawer = true,
  onOpenDetail,
  persistKey,
  className = '',
}: CandidaturesStackViewProps): React.ReactElement {
  // ─── Initialisation depuis localStorage (V5.4) ─────────────────────────
  // Si persistKey fourni, on hydrate l'historique depuis localStorage et
  // on filtre les candidats déjà décidés (accept ou reject) du stack initial.
  const computeInitialStack = React.useCallback(
    (sourceCandidates: StackCandidate[], history: HistoryEntry[]): StackCandidate[] => {
      if (history.length === 0) return sourceCandidates;
      const decided = new Set(history.map((h) => h.id));
      return sourceCandidates.filter((c) => !decided.has(c.id));
    },
    [],
  );

  // ─── State management ──────────────────────────────────────────────────
  const [historyLog, setHistoryLog] = React.useState<HistoryEntry[]>(() =>
    loadPersistedHistory(persistKey),
  );
  const [candidatesStack, setCandidatesStack] = React.useState<StackCandidate[]>(() =>
    computeInitialStack(candidates, loadPersistedHistory(persistKey)),
  );
  const [drawerCandidateId, setDrawerCandidateId] = React.useState<string | null>(null);
  const [exitDirection, setExitDirection] = React.useState<'left' | 'right' | null>(null);

  const isDrawerOpen = drawerCandidateId !== null;

  // Quand props.candidates OU persistKey changent (ex: changement de bien),
  // on recharge l'historique persisté et on resynchronise le stack.
  const initRef = React.useRef<{ candidates: StackCandidate[]; persistKey?: string }>({
    candidates,
    persistKey,
  });
  React.useEffect(() => {
    const changed =
      initRef.current.candidates !== candidates ||
      initRef.current.persistKey !== persistKey;
    if (!changed) return;
    initRef.current = { candidates, persistKey };
    const persisted = loadPersistedHistory(persistKey);
    setHistoryLog(persisted);
    setCandidatesStack(computeInitialStack(candidates, persisted));
    setDrawerCandidateId(null);
    setExitDirection(null);
  }, [candidates, persistKey, computeInitialStack]);

  // Persistance localStorage : à chaque changement de historyLog
  React.useEffect(() => {
    savePersistedHistory(persistKey, historyLog);
  }, [historyLog, persistKey]);

  // ─── Carte courante + behind cards ─────────────────────────────────────
  const current = candidatesStack[0];
  const behindCards = candidatesStack.slice(1, 5);

  // ─── handleDecision : push history + pop stack ─────────────────────────
  const handleDecision = React.useCallback(
    (candidateId: string, decision: DecisionStatus) => {
      const candidate = candidatesStack.find((c) => c.id === candidateId);
      if (!candidate) return;

      const entry: HistoryEntry = {
        id: candidate.id,
        name: getShortName(candidate),
        initiales:
          candidate.initiales || computeInitials(candidate.prenom, candidate.nom),
        decision,
        timestamp: Date.now(),
      };

      setExitDirection(decision === 'accepted' ? 'right' : 'left');
      setHistoryLog((prev) => [...prev, entry]);

      // Temporisation pour laisser jouer l'animation d'exit avant le pop
      setTimeout(() => {
        setCandidatesStack((prev) => prev.filter((c) => c.id !== candidateId));
        setExitDirection(null);
      }, 280);

      if (decision === 'accepted') onAccept?.(candidate);
      else onReject?.(candidate);
    },
    [candidatesStack, onAccept, onReject],
  );

  // ─── handleUndo : remove history + unshift stack ───────────────────────
  const handleUndo = React.useCallback(
    (candidateId: string) => {
      const entry = historyLog.find((h) => h.id === candidateId);
      if (!entry) return;
      const original = candidates.find((c) => c.id === candidateId);
      if (!original) return;

      setHistoryLog((prev) => prev.filter((h) => h.id !== candidateId));
      setCandidatesStack((prev) => {
        // Évite les doublons si déjà dans la pile pour une raison étrange
        if (prev.some((c) => c.id === candidateId)) return prev;
        return [original, ...prev];
      });

      onUndo?.(original, entry.decision);
    },
    [historyLog, candidates, onUndo],
  );

  // ─── Reset / replay démo ───────────────────────────────────────────────
  // Vide aussi la persistance localStorage (cohérence "rejouer la démo")
  const handleReset = React.useCallback(() => {
    clearPersistedHistory(persistKey);
    setCandidatesStack(candidates);
    setHistoryLog([]);
    setDrawerCandidateId(null);
    setExitDirection(null);
  }, [candidates, persistKey]);

  // ─── Counters ──────────────────────────────────────────────────────────
  const total = candidates.length;
  const seen = historyLog.length;
  const left = candidatesStack.length;

  // ─── Drawer candidate ───────────────────────────────────────────────────
  const drawerCandidate = React.useMemo(
    () => candidatesStack.find((c) => c.id === drawerCandidateId) || null,
    [candidatesStack, drawerCandidateId],
  );

  return (
    <div
      className={`flex min-h-screen flex-col items-center bg-slate-50 px-4 py-10 sm:py-14 ${className}`}
    >
      {/* Header / counter */}
      <header className="mb-6 w-full max-w-md text-center">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
          Revue des candidatures
        </p>
        <h1 className="font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl">
          {left > 0 ? `${left} dossier${left > 1 ? 's' : ''} à examiner` : 'Pile vide'}
        </h1>
        {total > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {seen} sur {total} traité{seen > 1 ? 's' : ''}
          </p>
        )}
      </header>

      {/* Stack container */}
      <div className="relative flex w-full max-w-md flex-1 items-start justify-center">
        <div className="relative w-full" style={{ minHeight: '32rem' }}>
          {behindCards
            .slice()
            .reverse()
            .map((bc, idx) => {
              const positionFromTop = (behindCards.length - idx) as 1 | 2 | 3 | 4;
              return <BehindCard key={bc.id} candidate={bc} position={positionFromTop} />;
            })}

          <AnimatePresence>
            {current ? (
              <motion.div
                key={current.id}
                initial={{ y: -8, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={
                  exitDirection === 'right'
                    ? {
                        x: 500,
                        opacity: 0,
                        rotate: 18,
                        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                      }
                    : exitDirection === 'left'
                    ? {
                        x: -500,
                        opacity: 0,
                        rotate: -18,
                        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                      }
                    : { opacity: 0 }
                }
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full"
                style={{ zIndex: 20 }}
              >
                <TopCard
                  candidate={current}
                  onAccept={() => handleDecision(current.id, 'accepted')}
                  onReject={() => handleDecision(current.id, 'rejected')}
                  onClickDetails={() =>
                    onOpenDetail
                      ? onOpenDetail(current.id)
                      : setDrawerCandidateId(current.id)
                  }
                  enableSwipe={enableSwipe}
                  enableDrawer={enableDrawer}
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative w-full"
              >
                <EmptyState
                  onReset={historyLog.length > 0 ? handleReset : undefined}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Boutons d'action (sticky bottom) */}
      {current && (
        <div className="sticky bottom-4 mt-8 flex w-full max-w-md items-center justify-center gap-8 sm:bottom-8">
          <motion.button
            type="button"
            onClick={() => handleDecision(current.id, 'rejected')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 text-red-600 shadow-xl ring-1 ring-red-100/50 backdrop-blur transition-colors hover:bg-red-100 hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            aria-label={`Refuser ${current.prenom} ${current.nom}`}
          >
            <X className="h-9 w-9" strokeWidth={2.5} aria-hidden="true" />
          </motion.button>

          <motion.button
            type="button"
            onClick={() => handleDecision(current.id, 'accepted')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50 text-emerald-600 shadow-xl ring-1 ring-emerald-100/50 backdrop-blur transition-colors hover:bg-emerald-100 hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            aria-label={`Retenir ${current.prenom} ${current.nom}`}
          >
            <Check className="h-10 w-10" strokeWidth={2.5} aria-hidden="true" />
          </motion.button>
        </div>
      )}

      {/* Indication swipe */}
      {current && enableSwipe && (
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Glissez la fiche · ← Refuser · Retenir →
        </p>
      )}

      {/* Historique des choix (badges + undo) */}
      {enableHistory && historyLog.length > 0 && (
        <div className="mt-8 flex w-full justify-center">
          <HistoryBar history={historyLog} onUndo={handleUndo} />
        </div>
      )}

      {/* Side drawer avec rapport d'audit complet */}
      <DetailsSheet
        open={isDrawerOpen}
        candidate={drawerCandidate}
        onClose={() => setDrawerCandidateId(null)}
        onAccept={() => {
          if (drawerCandidate) handleDecision(drawerCandidate.id, 'accepted');
        }}
        onReject={() => {
          if (drawerCandidate) handleDecision(drawerCandidate.id, 'rejected');
        }}
      />
    </div>
  );
}

// ─── Demo wrapper ────────────────────────────────────────────────────────────

const DEMO_CANDIDATES: StackCandidate[] = [
  {
    id: 'valentin-vettese',
    prenom: 'Valentin',
    nom: 'Vettese',
    initiales: 'VV',
    profession: "CDI - Période d'essai",
    score: 70,
    grade: 'GRADE B',
    revenus: '2 800 €',
    loyer: '950 €',
    effort: '33%',
    alerte: 'Risqué • Solide — Audit Forensic en alerte, vérification manuelle requise.',
    aiSynthesis:
      "Le profil présente une stabilité financière remarquable, mais une alerte a été détectée sur l'audit forensic. Les flux de revenus sont parfaitement cohérents avec l'ancienneté. Le garant présente une assise financière triplant la couverture nécessaire. Risque de défaut historiquement nul.",
    detailMetrics: { income: '2 800 €', effortRate: 33, guarantorCoverage: '3.1x' },
    tenantChecks: [
      { status: 'success', title: 'Identité biométrique', desc: 'Vérification Didit certifiée eIDAS.' },
      { status: 'success', title: 'Cohérence fiscale', desc: 'Revenus fiscaux alignés avec les bulletins.' },
      {
        status: 'warning',
        title: 'Audit Forensic',
        desc: "L'IA a détecté une légère incohérence sur la fiche de paie de janvier.",
        action: 'Appel de courtoisie à la RH recommandé pour confirmer le poste.',
      },
    ],
    guarantorChecks: [
      { status: 'success', title: 'Solvabilité', desc: 'Bulletins authentifiés via SILAE.' },
      { status: 'success', title: 'Couverture 3.1× le loyer', desc: 'Garant solide, triple la couverture nécessaire.' },
    ],
  },
  {
    id: 'louna-bernasconi',
    prenom: 'Louna',
    nom: 'Bernasconi',
    initiales: 'LB',
    profession: 'CDI - Cadre du Secteur Privé',
    score: 98,
    grade: 'GRADE S',
    revenus: '3 450 €',
    loyer: '950 €',
    effort: '27%',
    aiSynthesis:
      "Profil exemplaire. Tous les contrôles sont au vert. Dossier éligible à la contractualisation immédiate sans réserve.",
    detailMetrics: { income: '3 450 €', effortRate: 27.5, guarantorCoverage: '6.2x' },
    tenantChecks: [
      { status: 'success', title: 'Identité', desc: 'Didit eIDAS certifiée.' },
      { status: 'success', title: 'Cohérence Fiscale', desc: 'Revenus parfaitement alignés.' },
      { status: 'success', title: 'Stabilité', desc: '5 ans d\'ancienneté, CDI confirmé.' },
    ],
    guarantorChecks: [
      { status: 'success', title: 'Couverture 6.2×', desc: 'Garant patrimonial confirmé.' },
      { status: 'success', title: 'Patrimoine', desc: 'Propriétaire de sa résidence principale.' },
    ],
  },
  {
    id: 'thomas-morel',
    prenom: 'Thomas',
    nom: 'Morel',
    initiales: 'TM',
    profession: 'Indépendant',
    score: 32,
    grade: 'ALERTE',
    revenus: '2 900 €',
    loyer: '950 €',
    effort: '33%',
    alerte:
      "Incohérence détectée : écart de 8 200 € entre fiches de paie modifiées et net fiscal déclaré aux impôts.",
    aiSynthesis:
      "ATTENTION : L'analyse approfondie révèle des anomalies structurelles majeures. Les calculs des cotisations sociales sur les derniers bulletins ne correspondent pas aux taux URSSAF. La pièce d'identité du garant est expirée depuis 14 mois. Dossier non éligible en l'état.",
    detailMetrics: { income: '2 900 €', effortRate: 32.7, guarantorCoverage: '2.2x' },
    tenantChecks: [
      {
        status: 'danger',
        title: 'Incohérence fiscale majeure',
        desc: 'Écart de 8 200 € entre bulletins modifiés et net fiscal déclaré.',
      },
      { status: 'warning', title: 'Justificatif de domicile', desc: 'Plus de 3 mois.' },
    ],
    guarantorChecks: [
      {
        status: 'danger',
        title: "Pièce d'identité",
        desc: 'Expirée depuis 14 mois.',
      },
      {
        status: 'warning',
        title: 'Couverture limitée',
        desc: "Le statut retraité du garant rend son taux d'effort tendu.",
      },
    ],
  },
  {
    id: 'sarah-cohen',
    prenom: 'Sarah',
    nom: 'Cohen',
    initiales: 'SC',
    profession: 'CDI - Profession Libérale',
    score: 85,
    grade: 'GRADE A',
    revenus: '4 200 €',
    loyer: '950 €',
    effort: '22%',
    aiSynthesis:
      "Excellent profil. Revenus stables, dossier complet, garant Visale confirmé. Aucun point de vigilance détecté.",
    detailMetrics: { income: '4 200 €', effortRate: 22.6, guarantorCoverage: 'Visale ✓' },
    tenantChecks: [
      { status: 'success', title: 'Identité Didit', desc: 'Certifiée.' },
      { status: 'success', title: 'Revenus', desc: 'Stables sur 3 ans.' },
    ],
    guarantorChecks: [
      { status: 'success', title: 'Visale Action Logement', desc: 'Actif et confirmé.' },
    ],
  },
  {
    id: 'mehdi-attia',
    prenom: 'Mehdi',
    nom: 'Attia',
    initiales: 'MA',
    profession: 'CDD - Renouvellement en cours',
    score: 55,
    grade: 'GRADE C',
    revenus: '2 600 €',
    loyer: '950 €',
    effort: '36%',
    alerte: 'Pas de garant déclaré et statut CDD en renouvellement.',
    aiSynthesis:
      "Profil correct mais nécessite vigilance. Le contrat CDD est en cours de renouvellement et aucun garant n'est déclaré. Le taux d'effort à 36% est dans la zone d'attention.",
    detailMetrics: { income: '2 600 €', effortRate: 36, guarantorCoverage: '—' },
    tenantChecks: [
      { status: 'warning', title: 'CDD', desc: 'Renouvellement en cours, à confirmer.' },
      { status: 'warning', title: "Taux d'effort 36%", desc: 'Zone d\'attention.' },
    ],
    guarantorChecks: [
      {
        status: 'warning',
        title: 'Aucun garant déclaré',
        desc: 'Recommandation forte : exiger Visale avant signature.',
        action: 'Inviter le candidat à souscrire Visale (gratuit en ligne).',
      },
    ],
  },
];

export function CandidaturesStackViewDemo(): React.ReactElement {
  return <CandidaturesStackView candidates={DEMO_CANDIDATES} />;
}
