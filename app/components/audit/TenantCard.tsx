'use client';

/**
 * <TenantCard> — Carte candidat locataire "Banque Privée / Luxe".
 *
 * Refonte premium de la carte de résumé candidat. Inspire prestige,
 * fiabilité, clarté. Palette : émeraude profond + or brossé.
 *
 * Structure :
 *   A. Header — Avatar monogramme + nom serif + statut + badge grade
 *   B. Centre — Jauge "Sésame" SVG donut (anneau gold sur fond slate-100)
 *   C. Grille 3 métriques (Revenus / Loyer / Effort) divisée par séparateurs
 *   D. Smart Alert intégrée (si alerte) — bg-red-50/50 discret + AlertTriangle
 *   E. Bouton bottom emerald-900 — "Ouvrir le dossier certifié"
 *
 * Une variante <TenantCardDemo> permet de tester avec des données mock.
 */

import * as React from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Briefcase,
  Building2,
  GraduationCap,
  Coffee,
  HelpCircle,
} from 'lucide-react';
import { normalizeProfile, getProfileLabel, type CandidateProfile } from './CandidateDossier';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TenantCardData {
  prenom: string;
  nom: string;
  /** Initiales du monogramme (calcul auto si absent) */
  initiales?: string;
  /** Profession / statut professionnel (ex: "CDI - Période d'essai") */
  profession: string;
  /** Indice de Résilience 0–100 */
  score: number;
  /** Label du grade (ex: "GRADE B") */
  grade: string;
  /** Revenus mensuels formatés (ex: "2 800 €") */
  revenus: string;
  /** Loyer formaté (ex: "950 €") */
  loyer: string;
  /** Taux d'effort formaté (ex: "33%") */
  effort: string;
  /** Message d'alerte affiché en encart si présent */
  alerte?: string;
  /** Couleur du grade (auto-calculée si absente) */
  gradeColor?: 'gold' | 'emerald' | 'amber' | 'red';
}

export interface TenantCardProps {
  candidat: TenantCardData;
  /** Callback sur le clic du CTA principal */
  onOpen?: () => void;
  /** Désactive le CTA (loading) */
  busy?: boolean;
  /** Classes additionnelles */
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeInitials(prenom: string, nom: string): string {
  const a = (prenom || '?').trim()[0] || '?';
  const b = (nom || '').trim()[0] || '';
  return `${a}${b}`.toUpperCase();
}

/** Style + icône du profil candidat — pour mise en évidence sur la carte */
function getProfileStyle(profile: CandidateProfile): {
  icon: React.ElementType;
  bg: string;
  text: string;
  ring: string;
} {
  switch (profile) {
    case 'SALARIE':
      return {
        icon: Building2,
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        ring: 'ring-emerald-200',
      };
    case 'INDEPENDANT':
      return {
        icon: Briefcase,
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        ring: 'ring-amber-200',
      };
    case 'ETUDIANT':
      return {
        icon: GraduationCap,
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        ring: 'ring-blue-200',
      };
    case 'RETRAITE':
      return {
        icon: Coffee,
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        ring: 'ring-slate-200',
      };
    case 'AUTRE':
    default:
      return {
        icon: HelpCircle,
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        ring: 'ring-slate-200',
      };
  }
}

function pickGradeStyle(score: number): {
  bg: string;
  text: string;
  ring: string;
  icon: React.ElementType;
} {
  if (score >= 85) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      ring: 'ring-amber-200',
      icon: Sparkles,
    };
  }
  if (score >= 60) {
    return {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      ring: 'ring-amber-200',
      icon: ShieldCheck,
    };
  }
  if (score >= 40) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      ring: 'ring-amber-200',
      icon: ShieldCheck,
    };
  }
  return {
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-200',
    icon: AlertTriangle,
  };
}

// ─── Sub-component : Donut Gauge SVG ─────────────────────────────────────────

function SesameGauge({ score }: { score: number }): React.ReactElement {
  const safe = Math.max(0, Math.min(100, score));
  const SIZE = 96; // 24 * 4
  const STROKE = 8;
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  // dashoffset = circumference * (1 - score/100)
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
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-slate-100"
        />
        {/* Value */}
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
      {/* Score au centre */}
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

// ─── Composant principal ─────────────────────────────────────────────────────

export function TenantCard({
  candidat,
  onOpen,
  busy = false,
  className = '',
}: TenantCardProps): React.ReactElement {
  const initials = candidat.initiales || computeInitials(candidat.prenom, candidat.nom);
  const fullName = `${candidat.prenom || ''} ${candidat.nom || ''}`.trim() || 'Candidat';
  const gradeStyle = pickGradeStyle(candidat.score);
  const GradeIcon = gradeStyle.icon;

  // V5.8 — Profil candidat mis en évidence (icône + label + couleur)
  const profile = React.useMemo(
    () => normalizeProfile(candidat.profession),
    [candidat.profession],
  );
  const profileStyle = getProfileStyle(profile);
  const ProfileIcon = profileStyle.icon;
  const profileLabel = getProfileLabel(profile);

  return (
    <article
      className={`relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/60 transition-shadow hover:shadow-md hover:ring-slate-200 ${className}`}
      aria-label={`Carte candidat ${fullName}`}
    >
      {/* ─── A. Header — Identité + badge grade ──────────────────────────── */}
      <header className="flex items-start gap-3">
        {/* Avatar monogramme */}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-900 font-serif text-base font-bold text-amber-500 shadow-sm"
          aria-label={`Monogramme ${initials}`}
        >
          {initials}
        </div>

        {/* Nom + profile badge (mis en évidence) */}
        <div className="min-w-0 flex-1 pt-0.5">
          <h3
            className="truncate font-serif text-lg font-semibold leading-tight text-emerald-900"
            title={fullName}
          >
            {fullName}
          </h3>
          {/* V5.8 — Badge profil mis en évidence (icône + label coloré) */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 ${profileStyle.bg} ${profileStyle.text} ${profileStyle.ring}`}
              aria-label={`Profil : ${profileLabel}`}
            >
              <ProfileIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {profileLabel}
            </span>
            <span
              className="truncate text-xs text-slate-500"
              title={candidat.profession}
            >
              · {candidat.profession}
            </span>
          </div>
        </div>

        {/* Badge grade en top-right */}
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full ${gradeStyle.bg} px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 ${gradeStyle.ring} ${gradeStyle.text}`}
          aria-label={candidat.grade}
        >
          <GradeIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {candidat.grade}
        </span>
      </header>

      {/* ─── B. Jauge Sésame ─────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-col items-center">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
          Indice de Résilience
        </p>
        <SesameGauge score={candidat.score} />
      </div>

      {/* ─── C. Grille 3 métriques ──────────────────────────────────────── */}
      <div className="mt-6 divide-x divide-slate-100 rounded-xl bg-slate-50/60 px-1 py-3 ring-1 ring-slate-100">
        <div className="flex">
          <div className="flex-1 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Revenus
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{candidat.revenus}</p>
          </div>
          <div className="flex-1 border-l border-slate-100 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Loyer
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{candidat.loyer}</p>
          </div>
          <div className="flex-1 border-l border-slate-100 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Effort
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{candidat.effort}</p>
          </div>
        </div>
      </div>

      {/* ─── D. Smart Alert (conditionnelle) ────────────────────────────── */}
      {candidat.alerte && (
        <div
          className="mt-4 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3"
          role="alert"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
            aria-hidden="true"
          />
          <p className="text-xs leading-relaxed text-red-900/90">{candidat.alerte}</p>
        </div>
      )}

      {/* ─── E. CTA bottom ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={`Ouvrir le dossier certifié de ${fullName}`}
      >
        Ouvrir le dossier certifié
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </article>
  );
}

// ─── Demo wrapper ────────────────────────────────────────────────────────────

const DEMO_DATA: TenantCardData = {
  prenom: 'Valentin',
  nom: 'Vettese',
  initiales: 'VV',
  profession: "CDI - Période d'essai",
  score: 70,
  grade: 'GRADE B',
  revenus: '2 800 €',
  loyer: '950 €',
  effort: '33%',
  alerte: 'Revenus fiscaux N-1 inférieurs aux fiches de paie actuelles.',
};

/**
 * Variante démo affichant la nouvelle carte sur un fond gris-perle avec
 * 3 variations (idéal, à vérifier, alerte) pour tester les statuts.
 */
export function TenantCardDemo(): React.ReactElement {
  const [hovered, setHovered] = React.useState<number | null>(null);

  const variants: TenantCardData[] = [
    {
      prenom: 'Louna',
      nom: 'Bernasconi',
      initiales: 'LB',
      profession: 'CDI - Cadre du Secteur Privé',
      score: 98,
      grade: 'GRADE S',
      revenus: '3 450 €',
      loyer: '950 €',
      effort: '27%',
    },
    DEMO_DATA,
    {
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
        'Incohérence détectée : écart de 8 200 € entre fiches de paie modifiées et net fiscal déclaré.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-6xl px-6">
        {/* Hero démo */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Composant · Carte candidat
          </p>
          <h1 className="font-serif text-4xl font-bold text-emerald-900 sm:text-5xl">
            TenantCard — Banque Privée
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
            Refonte premium de la carte de résumé d&apos;un candidat locataire.
            Émeraude profond + or brossé. Jauge Sésame SVG circulaire,
            métriques aérées, alertes intégrées avec élégance.
          </p>
        </div>

        {/* Grille de 3 variations */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {variants.map((variant, idx) => (
            <div
              key={`${variant.prenom}-${variant.nom}`}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
              className={`transition-transform ${
                hovered === idx ? 'scale-[1.02]' : ''
              }`}
            >
              <TenantCard
                candidat={variant}
                onOpen={() =>
                  alert(`[Démo] Ouverture du dossier ${variant.prenom} ${variant.nom}`)
                }
              />
            </div>
          ))}
        </div>

        {/* Légende */}
        <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Notes de design
          </p>
          <h2 className="mt-1 font-serif text-xl font-bold text-emerald-900">
            Principes appliqués
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              Avatar monogramme cercle parfait emerald-900 / amber-500
              (Playfair Display).
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              Jauge &quot;Sésame&quot; en SVG circulaire (donut), stroke or sur fond
              slate-100, transition douce 700ms.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              Métriques séparées par <code className="rounded bg-slate-100 px-1 text-[11px]">divide-x divide-slate-100</code>,
              labels uppercase tracked tight.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              Smart Alert intégrée — bg-red-50/50 + AlertTriangle red-500,
              jamais agressif.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              CTA bottom emerald-900 — &quot;Ouvrir le dossier certifié&quot;.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              Ombres bannies — uniquement <code className="rounded bg-slate-100 px-1 text-[11px]">shadow-sm</code>{' '}
              + <code className="rounded bg-slate-100 px-1 text-[11px]">ring-1 ring-slate-200/60</code>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
