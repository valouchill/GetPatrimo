'use client';

/**
 * <CandidateAiReport> — Vue "Analyse IA du Candidat" (Trust Premium).
 *
 * Cœur de la proposition de valeur : rapport anti-fraude de l'IA qui
 * s'affiche dans la modale CandidateAuditModal. Style banque privée /
 * cabinet d'avocats, palette émeraude profond + or brossé.
 *
 * Sections :
 *   A. Header (nom, métier, badge Indice de Résilience)
 *   B. 3 métriques financières (revenus, taux d'effort, couverture garant)
 *   C. Synthèse de l'Auditeur Virtuel (italique serif)
 *   D. Audit Forensic split locataire / garant
 *   E. Boutons sticky bottom (Valider / Écarter)
 *
 * Statuts : success (vert) / warning (jaune) / danger (rouge).
 *
 * Une variante <CandidateAiReportDemo> permet de tester avec un toggle
 * Louna (dossier idéal) / Thomas (dossier risque).
 */

import * as React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Users,
  Crown,
  Ban,
} from 'lucide-react';
import { Button } from '@/app/components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AiReportStatus = 'success' | 'warning' | 'danger';

export interface AiReportCheck {
  status: AiReportStatus;
  title: string;
  desc: string;
  /** Optionnel : action concrète recommandée (mise en avant si présent) */
  action?: string;
}

export interface AiReportMetrics {
  /** Revenus mensuels cumulés (libellé formaté, ex: "3 450 €") */
  income: string;
  /** Taux d'effort en % (number pour calcul couleur) */
  effortRate: number;
  /** Couverture garant (libellé, ex: "6.2x") */
  guarantorCoverage: string;
}

export interface AiReportCandidate {
  name: string;
  job: string;
  /** Indice de Résilience 0–100 */
  score: number;
  /** Label grade (ex: "GRADE S" ou "ALERTE") */
  grade: string;
  metrics: AiReportMetrics;
  /** Synthèse rédigée par l'IA (paragraphe complet, sans guillemets) */
  aiSynthesis: string;
  tenantChecks: AiReportCheck[];
  guarantorChecks: AiReportCheck[];
}

export interface CandidateAiReportProps {
  candidate: AiReportCandidate;
  /** Callback : valider et passer au bail */
  onValidate?: () => void;
  /** Callback : écarter ce candidat */
  onReject?: () => void;
  /** Désactiver les boutons (loading) */
  busy?: boolean;
  /** Classes additionnelles sur la racine */
  className?: string;
}

// ─── Styles statut (source de vérité) ────────────────────────────────────────

const STATUS_STYLES: Record<
  AiReportStatus,
  {
    icon: React.ElementType;
    iconColor: string;
    bg: string;
    border: string;
    text: string;
    dot: string;
    label: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-700',
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
    label: 'Validé',
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'text-amber-700',
    bg: 'bg-amber-50/60',
    border: 'border-amber-200',
    text: 'text-amber-900',
    dot: 'bg-amber-500',
    label: 'À vérifier',
  },
  danger: {
    icon: XCircle,
    iconColor: 'text-red-700',
    bg: 'bg-red-50/60',
    border: 'border-red-200',
    text: 'text-red-900',
    dot: 'bg-red-500',
    label: 'Alerte',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function effortRateColor(rate: number): string {
  if (rate < 30) return 'text-emerald-700';
  if (rate < 35) return 'text-amber-700';
  return 'text-red-700';
}

function effortRateBadge(rate: number): string {
  if (rate < 30) return 'Confortable';
  if (rate < 35) return 'À surveiller';
  return 'Élevé';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-900';
  if (score >= 60) return 'text-amber-700';
  return 'text-red-700';
}

function scoreBadgeStyle(score: number): { bg: string; text: string; border: string } {
  if (score >= 80) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-300' };
  }
  if (score >= 60) {
    return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' };
  }
  return { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300' };
}

// ─── Sub-component : Check item ──────────────────────────────────────────────

function CheckItem({ check }: { check: AiReportCheck }): React.ReactElement {
  const style = STATUS_STYLES[check.status];
  const Icon = style.icon;
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3.5 transition-colors`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${style.text}`}>{check.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{check.desc}</p>
        {check.action && (
          <p className="mt-2 inline-flex items-start gap-1.5 rounded-md bg-white/70 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
            <span className="leading-relaxed">Action requise : {check.action}</span>
          </p>
        )}
      </div>
    </li>
  );
}

// ─── Sub-component : Metric tile ─────────────────────────────────────────────

function MetricTile({
  label,
  value,
  hint,
  hintColor,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  hintColor?: string;
  icon: React.ElementType;
}): React.ReactElement {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        <Icon className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        {label}
      </div>
      <div className="font-serif text-4xl font-bold leading-none text-emerald-900">{value}</div>
      {hint && (
        <p className={`mt-3 text-xs font-semibold ${hintColor || 'text-slate-500'}`}>{hint}</p>
      )}
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function CandidateAiReport({
  candidate,
  onValidate,
  onReject,
  busy = false,
  className = '',
}: CandidateAiReportProps): React.ReactElement {
  const scoreBadge = scoreBadgeStyle(candidate.score);
  const dangerCount = [
    ...candidate.tenantChecks,
    ...candidate.guarantorChecks,
  ].filter((c) => c.status === 'danger').length;

  return (
    <div className={`flex flex-col bg-slate-50 ${className}`}>
      {/* ─── A. Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Analyse IA du candidat
            </p>
            <h1 className="font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl">
              {candidate.name}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">{candidate.job}</p>
          </div>

          {/* Indice de Résilience */}
          <div
            className={`flex shrink-0 flex-col items-center justify-center rounded-2xl border-2 ${scoreBadge.border} ${scoreBadge.bg} px-7 py-4 text-center shadow-sm`}
            aria-label={`Indice de Résilience : ${candidate.score} sur 100, ${candidate.grade}`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Indice de Résilience
            </p>
            <p className={`mt-1 font-serif text-5xl font-bold leading-none ${scoreColor(candidate.score)}`}>
              {candidate.score}
              <span className="text-2xl text-slate-400">/100</span>
            </p>
            <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider ${scoreBadge.text} ring-1 ${scoreBadge.border}`}>
              {candidate.score >= 80 ? (
                <Crown className="h-3 w-3" aria-hidden="true" />
              ) : candidate.score < 60 ? (
                <Ban className="h-3 w-3" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
              )}
              {candidate.grade}
            </p>
          </div>
        </div>
      </header>

      {/* ─── B. Métriques financières ──────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white px-6 py-8 sm:px-10">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          <MetricTile
            label="Revenus mensuels"
            value={candidate.metrics.income}
            hint="Cumulés nets / mois"
            icon={TrendingUp}
          />
          <MetricTile
            label="Taux d'effort"
            value={
              <span className={effortRateColor(candidate.metrics.effortRate)}>
                {candidate.metrics.effortRate.toFixed(1)}%
              </span>
            }
            hint={effortRateBadge(candidate.metrics.effortRate)}
            hintColor={effortRateColor(candidate.metrics.effortRate)}
            icon={ShieldCheck}
          />
          <MetricTile
            label="Couverture garant"
            value={candidate.metrics.guarantorCoverage}
            hint="du loyer mensuel"
            icon={Users}
          />
        </div>
      </section>

      {/* ─── C. Synthèse de l'Auditeur Virtuel ────────────────────────────── */}
      <section className="border-b border-slate-200 bg-slate-50 px-6 py-10 sm:px-10">
        <div className="relative mx-auto max-w-3xl">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Synthèse de l'Auditeur Virtuel
          </div>
          <blockquote className="relative">
            <span
              className="absolute -left-2 -top-4 select-none font-serif text-7xl leading-none text-amber-300"
              aria-hidden="true"
            >
              «
            </span>
            <p className="font-serif text-lg italic leading-relaxed text-emerald-900 sm:text-xl sm:leading-relaxed">
              {candidate.aiSynthesis}
            </p>
            <span
              className="absolute -bottom-8 right-0 select-none font-serif text-7xl leading-none text-amber-300"
              aria-hidden="true"
            >
              »
            </span>
          </blockquote>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            — Auditeur IA PatrimoTrust · Confidentiel
          </p>
        </div>
      </section>

      {/* ─── D. Audit Forensic split ───────────────────────────────────────── */}
      <section className="border-b border-slate-200 bg-white px-6 py-8 sm:px-10">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Audit Forensic
          </p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-emerald-900">
            Détail des contrôles
          </h2>
          {dangerCount > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {dangerCount} alerte{dangerCount > 1 ? 's' : ''} bloquante{dangerCount > 1 ? 's' : ''} détectée{dangerCount > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Locataire */}
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-serif text-lg font-bold text-emerald-900">
                Audit du Locataire
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {candidate.tenantChecks.length} contrôle{candidate.tenantChecks.length > 1 ? 's' : ''}
              </span>
            </header>
            <ul className="space-y-3">
              {candidate.tenantChecks.map((check, idx) => (
                <CheckItem key={`tenant-${idx}-${check.title}`} check={check} />
              ))}
            </ul>
          </article>

          {/* Garant */}
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-serif text-lg font-bold text-emerald-900">
                Audit de la Caution
              </h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {candidate.guarantorChecks.length} contrôle{candidate.guarantorChecks.length > 1 ? 's' : ''}
              </span>
            </header>
            <ul className="space-y-3">
              {candidate.guarantorChecks.map((check, idx) => (
                <CheckItem key={`guar-${idx}-${check.title}`} check={check} />
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* ─── E. Boutons sticky bottom ──────────────────────────────────────── */}
      <footer
        className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur sm:px-10 sm:py-5"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={onReject}
            disabled={busy}
            iconLeft={<XCircle className="h-4 w-4" />}
            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
          >
            Écarter ce candidat
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onValidate}
            disabled={busy}
            iconRight={<CheckCircle2 className="h-4 w-4" />}
            className="bg-amber-500 text-white hover:bg-amber-600 shadow-amber"
          >
            Valider ce dossier et passer au bail
          </Button>
        </div>
      </footer>
    </div>
  );
}

// ─── Demo wrapper avec toggle Louna / Thomas ─────────────────────────────────

const DEMO_DATA: Record<'louna' | 'thomas', AiReportCandidate> = {
  louna: {
    name: 'Louna Bernasconi',
    job: 'Cadre du Secteur Privé (CDI)',
    score: 98,
    grade: 'GRADE S',
    metrics: { income: '3 450 €', effortRate: 27.5, guarantorCoverage: '6.2x' },
    aiSynthesis:
      "Le profil présente une stabilité financière remarquable. Les flux de revenus sont parfaitement cohérents avec l'ancienneté. Le garant présente une assise financière triplant la couverture nécessaire. Risque de défaut historiquement nul.",
    tenantChecks: [
      {
        status: 'success',
        title: 'Identité',
        desc: 'Identité biométrique eIDAS certifiée.',
      },
      {
        status: 'success',
        title: 'Cohérence Fiscale',
        desc: 'Revenus fiscaux de référence alignés avec les fiches de paie.',
      },
      {
        status: 'warning',
        title: 'Attestation Employeur',
        desc: 'Le document est rédigé à la main.',
        action: 'Un appel de courtoisie à la RH est conseillé pour confirmer le poste.',
      },
    ],
    guarantorChecks: [
      {
        status: 'success',
        title: 'Solvabilité',
        desc: 'Bulletins de salaire authentifiés (logiciel de paie détecté : SILAE).',
      },
      {
        status: 'success',
        title: 'Patrimoine',
        desc: 'Avis de taxe foncière valide, propriétaire de sa résidence.',
      },
    ],
  },
  thomas: {
    name: 'Thomas Morel',
    job: 'Indépendant',
    score: 32,
    grade: 'ALERTE',
    metrics: { income: '2 900 €', effortRate: 32.7, guarantorCoverage: '2.2x' },
    aiSynthesis:
      "ATTENTION : L'analyse approfondie révèle des anomalies structurelles majeures. Les calculs des cotisations sociales sur les derniers bulletins ne correspondent pas aux taux URSSAF. Écart fiscal majeur constaté.",
    tenantChecks: [
      {
        status: 'danger',
        title: 'Incohérence Fiscale',
        desc: 'Écart de 8 200 € entre les fiches de paie modifiées et le net fiscal déclaré aux impôts.',
      },
      {
        status: 'warning',
        title: 'Domiciliation',
        desc: 'Justificatif de domicile de plus de 3 mois.',
        action: 'Demander un justificatif de moins de 3 mois.',
      },
    ],
    guarantorChecks: [
      {
        status: 'danger',
        title: "Pièce d'identité",
        desc: "La pièce d'identité du garant est expirée depuis 14 mois.",
      },
      {
        status: 'warning',
        title: 'Couverture',
        desc: "Le taux d'effort du garant est tendu compte tenu de son statut de retraité.",
      },
    ],
  },
};

export function CandidateAiReportDemo(): React.ReactElement {
  const [active, setActive] = React.useState<'louna' | 'thomas'>('louna');
  const candidate = DEMO_DATA[active];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toggle Démo en haut */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Démo · Vue Analyse IA
          </p>
          <div
            role="tablist"
            aria-label="Sélecteur de dossier démo"
            className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={active === 'louna'}
              onClick={() => setActive('louna')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                active === 'louna'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dossier idéal · Louna
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={active === 'thomas'}
              onClick={() => setActive('thomas')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                active === 'thomas'
                  ? 'bg-white text-red-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dossier risque · Thomas
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl">
        <CandidateAiReport
          candidate={candidate}
          onValidate={() => alert('[Démo] Validation du dossier déclenchée')}
          onReject={() => alert('[Démo] Candidat écarté')}
        />
      </div>
    </div>
  );
}
