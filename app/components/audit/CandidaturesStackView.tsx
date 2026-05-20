'use client';

/**
 * <CandidaturesStackView> — Workflow "Tinder Like" pour la revue des
 * candidatures locataires. Stack de fiches premium superposées avec
 * boutons d'action ronds Refuser/Retenir.
 *
 * Philosophie UX : forcer une décision rapide, statutaire, élégante.
 * Seule la fiche du dessus est interactive ; les cartes derrière créent
 * de la profondeur visuelle.
 *
 * Fonctionnalités :
 *   - Stack de 5 fiches max visibles (decay shadow + scale + offset)
 *   - Top card : <TenantCard> Banque Privée + Note de Détective (synthèse IA serif italique)
 *   - Boutons d'action ronds géants (sticky bottom desktop, mobile inline)
 *   - Swipe drag (framer-motion) : left = refuser, right = retenir
 *   - État vide premium quand pile vidée
 *   - Callbacks onAccept/onReject (intégration backend ultérieure)
 *
 * Spec utilisateur respectée à la lettre :
 * - Couleurs : emerald-900 + amber-500 + slate-50 fond global
 * - Typographie : font-serif titres/score, sans-serif métriques
 * - Note IA italique encadrée comme "Note de Détective"
 * - Boutons décision ronds avec X / Check massifs
 */

import * as React from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  X,
  Inbox,
  RotateCcw,
  Sparkles,
  Quote,
  ShieldCheck,
} from 'lucide-react';

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
}

export interface CandidaturesStackViewProps {
  candidates: StackCandidate[];
  /** Callback quand l'utilisateur retient un candidat */
  onAccept?: (candidate: StackCandidate) => void;
  /** Callback quand l'utilisateur refuse un candidat */
  onReject?: (candidate: StackCandidate) => void;
  /** Démarrer à un index spécifique (par défaut 0) */
  initialIndex?: number;
  /** Activer le drag swipe gestures (par défaut true) */
  enableSwipe?: boolean;
  className?: string;
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

// ─── Sub-component : Top card (fiche active interactive) ─────────────────────

interface TopCardProps {
  candidate: StackCandidate;
  onAccept: () => void;
  onReject: () => void;
  enableSwipe: boolean;
}

function TopCard({ candidate, onAccept, onReject, enableSwipe }: TopCardProps): React.ReactElement {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0, 1, 1, 1, 0]);

  // Overlay teints selon direction du drag
  const acceptOverlay = useTransform(x, [0, 150], [0, 1]);
  const rejectOverlay = useTransform(x, [-150, 0], [1, 0]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 120;
    if (info.offset.x > threshold) {
      onAccept();
    } else if (info.offset.x < -threshold) {
      onReject();
    }
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
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity }}
      className="relative w-full max-w-md cursor-grab overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/60 active:cursor-grabbing"
      whileTap={{ scale: 0.98 }}
    >
      {/* Overlays decision feedback */}
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

      {/* Note de Détective — Synthèse IA serif italique */}
      {candidate.aiSynthesis && (
        <div className="mx-7 mt-7 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            <Quote className="h-3.5 w-3.5" aria-hidden="true" />
            Note de l'auditeur
          </div>
          <p className="font-serif text-sm italic leading-relaxed text-emerald-900">
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

      {/* Smart Alert (si présente) */}
      {candidate.alerte && (
        <div
          className="mx-7 mt-5 mb-7 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/60 p-3"
          role="alert"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-red-900/90">{candidate.alerte}</p>
        </div>
      )}

      {/* Spacer si pas d'alerte (pour aérer en bas) */}
      {!candidate.alerte && <div className="h-7" aria-hidden="true" />}
    </motion.article>
  );
}

// ─── Sub-component : Behind cards (cartes en fond) ───────────────────────────

function BehindCard({
  candidate,
  position,
}: {
  candidate: StackCandidate;
  position: 1 | 2 | 3 | 4;
}): React.ReactElement {
  // Décalage / scale / opacity selon la profondeur
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
      {/* Aperçu minimal pour donner l'illusion de profondeur */}
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

// ─── Sub-component : Empty state ─────────────────────────────────────────────

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
        La pile est vide.
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
  initialIndex = 0,
  enableSwipe = true,
  className = '',
}: CandidaturesStackViewProps): React.ReactElement {
  const [index, setIndex] = React.useState(initialIndex);
  const [direction, setDirection] = React.useState<'left' | 'right' | null>(null);

  const remaining = candidates.slice(index);
  const current = remaining[0];
  const behindCards = remaining.slice(1, 5); // 4 cartes max derrière

  const handleAccept = React.useCallback(() => {
    if (!current) return;
    setDirection('right');
    onAccept?.(current);
    // Légère temporisation pour laisser l'animation d'exit jouer
    setTimeout(() => {
      setIndex((i) => i + 1);
      setDirection(null);
    }, 280);
  }, [current, onAccept]);

  const handleReject = React.useCallback(() => {
    if (!current) return;
    setDirection('left');
    onReject?.(current);
    setTimeout(() => {
      setIndex((i) => i + 1);
      setDirection(null);
    }, 280);
  }, [current, onReject]);

  const handleReset = React.useCallback(() => {
    setIndex(0);
    setDirection(null);
  }, []);

  // Counters
  const total = candidates.length;
  const seen = index;
  const left = Math.max(0, total - seen);

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
          {/* Behind cards (deepest first → so top card stacks correctly) */}
          {behindCards
            .slice()
            .reverse()
            .map((bc, idx) => {
              const positionFromTop = (behindCards.length - idx) as 1 | 2 | 3 | 4;
              return <BehindCard key={bc.id} candidate={bc} position={positionFromTop} />;
            })}

          {/* Top card */}
          <AnimatePresence custom={direction}>
            {current ? (
              <motion.div
                key={current.id}
                initial={{ y: -8, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={
                  direction === 'right'
                    ? {
                        x: 500,
                        opacity: 0,
                        rotate: 18,
                        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                      }
                    : direction === 'left'
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
                  onAccept={handleAccept}
                  onReject={handleReject}
                  enableSwipe={enableSwipe}
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
                <EmptyState onReset={onAccept ? undefined : handleReset} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Boutons d'action ronds géants (sticky bottom) */}
      {current && (
        <div className="sticky bottom-4 mt-8 flex w-full max-w-md items-center justify-center gap-8 sm:bottom-8">
          <motion.button
            type="button"
            onClick={handleReject}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 text-red-600 shadow-xl ring-1 ring-red-100/50 backdrop-blur transition-colors hover:bg-red-100 hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            aria-label={`Refuser ${current.prenom} ${current.nom}`}
          >
            <X className="h-9 w-9" strokeWidth={2.5} aria-hidden="true" />
          </motion.button>

          <motion.button
            type="button"
            onClick={handleAccept}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50 text-emerald-600 shadow-xl ring-1 ring-emerald-100/50 backdrop-blur transition-colors hover:bg-emerald-100 hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            aria-label={`Retenir ${current.prenom} ${current.nom}`}
          >
            <Check className="h-10 w-10" strokeWidth={2.5} aria-hidden="true" />
          </motion.button>
        </div>
      )}

      {/* Indication swipe (subtile, sous les boutons) */}
      {current && enableSwipe && (
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Glissez la fiche · ← Refuser · Retenir →
        </p>
      )}
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
      "Le profil présente une stabilité financière remarquable. Les flux de revenus sont parfaitement cohérents avec l'ancienneté. Le garant présente une assise financière triplant la couverture nécessaire. Risque de défaut historiquement nul. Dossier éligible à la contractualisation immédiate.",
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
      'Excellent profil. Revenus stables, dossier complet, garant Visale confirmé. Aucun point de vigilance détecté par l\'audit forensic. Dossier solide et fiable pour une contractualisation immédiate.',
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
      "Profil correct mais nécessite vigilance. Le contrat CDD est en cours de renouvellement et aucun garant n'est déclaré. Le taux d'effort à 36% est dans la zone d'attention. Recommandation : exiger une caution Visale avant signature.",
  },
];

export function CandidaturesStackViewDemo(): React.ReactElement {
  const [history, setHistory] = React.useState<
    { candidate: StackCandidate; decision: 'accept' | 'reject' }[]
  >([]);

  return (
    <CandidaturesStackView
      candidates={DEMO_CANDIDATES}
      onAccept={(c) => setHistory((h) => [...h, { candidate: c, decision: 'accept' }])}
      onReject={(c) => setHistory((h) => [...h, { candidate: c, decision: 'reject' }])}
    />
  );
}
