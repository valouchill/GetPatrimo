'use client';

/**
 * <TopCandidateCard> — Carte Top 3 du hero dashboard owner, refondue
 * en cohérence avec <TenantCard> "Banque Privée" (PR #33/34).
 *
 * Garde le contexte Top 3 (rank #1 = Crown gold, #2/#3 = chip discret)
 * tout en adoptant la même grammaire visuelle : avatar monogramme
 * emerald-900/amber-500 serif, jauge SVG donut Sésame, métriques aérées,
 * smart alert conditionnelle, CTA emerald-900.
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Crown,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LocalDossier, LocalBien } from './ui';
import {
  formatPrice,
  getMetalLevel,
  METAL_BADGE_CLASS,
  METAL_LABELS,
} from '@/lib/product-lexicon';
import { labelForReason } from '@/lib/verdict-reasons';
import { resolveVerdict, VERDICT_STYLES } from '@/lib/verdict-system';
import { useReducedMotion } from '@/lib/motion';

export interface TopCandidateCardProps {
  rank: 1 | 2 | 3;
  candidate: LocalDossier;
  bien?: LocalBien;
  onOpenAudit: (c: LocalDossier) => void;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeInitials(prenom: string, nom: string): string {
  const a = (prenom || '?').trim()[0] || '?';
  const b = (nom || '').trim()[0] || '';
  return `${a}${b}`.toUpperCase();
}

function pickGradeStyle(score: number, verdict: 'recommended' | 'review' | 'risky'): {
  bg: string;
  text: string;
  ring: string;
  icon: React.ElementType;
} {
  if (verdict === 'risky') {
    return {
      bg: 'bg-red-50',
      text: 'text-red-700',
      ring: 'ring-red-200',
      icon: AlertTriangle,
    };
  }
  if (verdict === 'review') {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      ring: 'ring-amber-200',
      icon: AlertTriangle,
    };
  }
  // recommended
  if (score >= 85) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      ring: 'ring-amber-200',
      icon: Sparkles,
    };
  }
  return {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    ring: 'ring-amber-200',
    icon: ShieldCheck,
  };
}

// ─── Sub-component : Jauge Sésame SVG (identique TenantCard) ─────────────────

function SesameGauge({ score }: { score: number }): React.ReactElement {
  const safe = Math.max(0, Math.min(100, score));
  const SIZE = 96;
  const STROKE = 8;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safe / 100);
  const center = SIZE / 2;

  return (
    <div className="relative inline-flex h-24 w-24 items-center justify-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
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
        <span className="font-serif text-3xl font-bold leading-none text-emerald-900">
          {safe}
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          / 100
        </span>
      </div>
    </div>
  );
}

// ─── Sub-component : Rank badge ──────────────────────────────────────────────

function RankBadge({ rank }: { rank: 1 | 2 | 3 }): React.ReactElement {
  if (rank === 1) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-100 to-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800 ring-1 ring-amber-300 shadow-sm"
        aria-label="Top candidat — premier rang"
      >
        <Crown className="h-3 w-3" aria-hidden="true" />
        Top #1
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200"
      aria-label={`Top candidat — rang ${rank}`}
    >
      Top #{rank}
    </span>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function TopCandidateCard({
  rank,
  candidate: c,
  bien,
  onOpenAudit,
  className = '',
}: TopCandidateCardProps) {
  const reducedMotion = useReducedMotion();

  // Verdict centralisé
  const verdict = resolveVerdict(c);
  const verdictStyle = VERDICT_STYLES[verdict];
  const VerdictIcon = verdictStyle.icon;

  // Identité
  const initials = computeInitials(c.prenom, c.nom);
  const baseName = `${c.prenom || ''} ${c.nom || ''}`.trim() || 'Candidat';
  // Colocation : le nom affiché devient le label foyer (« Alice D. + 2 colocataires »).
  const fullName = c.isColocation && c.householdLabel ? c.householdLabel : baseName;
  const isSelected = c.statut === 'selectionne';
  // V6.6 — Métal institutionnel (PLATINUM/GOLD/SILVER/ALERTE) à la place
  // du legacy lettrage S/A/B/C/D. Source de vérité : product-lexicon.
  const metalLevel = getMetalLevel(c.score);
  const metalBadgeClass = METAL_BADGE_CLASS[metalLevel];
  const metalLabel = METAL_LABELS[metalLevel];
  // Style auxiliaire pour l'icône — on conserve l'icône verdict-driven
  // pour signaler la dimension "qualité du dossier" en complément du tier.
  const gradeStyle = pickGradeStyle(c.score, verdict);
  const GradeIcon = gradeStyle.icon;

  // Métriques
  const score = Math.max(0, Math.min(100, Math.round(c.score || 0)));
  const ratio = bien && bien.loyer > 0 ? c.revenus / bien.loyer : 0;
  const effortPct =
    typeof c.effortRate === 'number' && c.effortRate > 0
      ? Math.round(c.effortRate * 100)
      : bien && bien.loyer > 0 && c.revenus > 0
      ? Math.round((bien.loyer / c.revenus) * 100)
      : 0;

  // Smart alert (uniquement si verdict pas recommended)
  const firstReason =
    c.reasonCodes && c.reasonCodes.length > 0 ? labelForReason(c.reasonCodes[0]) : null;
  const showAlert = verdict !== 'recommended' && firstReason;

  // Border emphase rank #1
  const borderClass =
    isSelected
      ? 'ring-emerald-300'
      : rank === 1 && verdict === 'recommended'
      ? 'ring-amber-200/80'
      : 'ring-slate-200/60';

  return (
    <motion.button
      type="button"
      onClick={() => onOpenAudit(c)}
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: reducedMotion ? 0 : (rank - 1) * 0.1,
        duration: reducedMotion ? 0 : 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      className={[
        'group relative flex w-full flex-col overflow-hidden rounded-2xl bg-white p-6 text-left shadow-sm ring-1 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
        borderClass,
        className,
      ].join(' ')}
      aria-label={`Top candidat #${rank} — ${fullName}`}
    >
      {/* ─── A. Header — Identité + badge rank + grade ──────────────────── */}
      <header className="flex items-start gap-3">
        {/* Avatar monogramme */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-900 font-serif text-base font-bold text-amber-500 shadow-sm"
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Nom + profession + bien */}
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate font-serif text-lg font-semibold leading-tight text-emerald-900">
            {fullName}
          </h3>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {c.contrat || 'Profil'}
            {bien ? ` · ${bien.label}` : ''}
          </p>
          {c.isColocation && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
              <Users className="h-3 w-3" aria-hidden="true" /> Colocation · {c.householdSize || 2} personnes
            </span>
          )}
        </div>

        {/* Stack de badges top-right : rank + grade */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {isSelected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Locataire retenu
            </span>
          )}
          <RankBadge rank={rank} />
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${metalBadgeClass}`}
            aria-label={`Niveau ${metalLabel}`}
            title={`Niveau institutionnel : ${metalLabel}`}
          >
            {metalLevel === 'PLATINUM' && (
              <span aria-hidden="true">★</span>
            )}
            {metalLevel !== 'PLATINUM' && (
              <GradeIcon className="h-3 w-3" aria-hidden="true" />
            )}
            {metalLabel}
          </span>
        </div>
      </header>

      {/* ─── B. Jauge Sésame ─────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-col items-center">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
          Indice de Résilience
        </p>
        <SesameGauge score={score} />
      </div>

      {/* ─── C. Grille 3 métriques ──────────────────────────────────────── */}
      <div className="mt-6 rounded-xl bg-slate-50/60 px-1 py-3 ring-1 ring-slate-100">
        <div className="flex">
          <div className="flex-1 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Revenus
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {formatPrice(c.revenus || 0)}
            </p>
          </div>
          <div className="flex-1 border-l border-slate-100 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Loyer
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {bien ? formatPrice(bien.loyer || 0) : '—'}
            </p>
          </div>
          <div className="flex-1 border-l border-slate-100 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {ratio > 0 ? 'Ratio' : 'Effort'}
            </p>
            <p
              className={`mt-1 text-sm font-medium ${
                ratio >= 3
                  ? 'text-emerald-700'
                  : ratio >= 2
                  ? 'text-amber-700'
                  : effortPct > 35
                  ? 'text-red-700'
                  : 'text-slate-800'
              }`}
            >
              {ratio > 0 ? `${ratio.toFixed(1)}×` : effortPct > 0 ? `${effortPct}%` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ─── D. Smart Alert (uniquement si non-recommended) ─────────────── */}
      {showAlert && (
        <div
          className={`mt-4 flex items-start gap-3 rounded-xl border p-3 ${
            verdict === 'risky'
              ? 'border-red-100 bg-red-50/50'
              : 'border-amber-100 bg-amber-50/50'
          }`}
          role="alert"
        >
          <VerdictIcon
            className={`mt-0.5 h-4 w-4 shrink-0 ${verdictStyle.iconText}`}
            aria-hidden="true"
          />
          <p
            className={`text-xs leading-relaxed ${
              verdict === 'risky' ? 'text-red-900/90' : 'text-amber-900/90'
            }`}
          >
            {firstReason}
          </p>
        </div>
      )}

      {/* ─── E. CTA bottom ───────────────────────────────────────────────── */}
      <span
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all group-hover:bg-emerald-800"
        aria-hidden="true"
      >
        Ouvrir le dossier certifié
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </motion.button>
  );
}
