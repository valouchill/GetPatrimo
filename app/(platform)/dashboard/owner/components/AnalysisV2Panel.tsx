'use client';

/**
 * AnalysisV2Panel — Carte d'analyse IA neuro-symbolique (V6.2).
 *
 * Appelle POST /api/owner/applications/[id]/analyze-v2 et affiche :
 *   - Indice de Résilience 0-100 + grade institutionnel (S/A/B/ALERTE)
 *   - Décision recommandée (GO_FAST / MANUAL_CHECK / REJECT)
 *   - Breakdown par pilier (financier / authenticité / professionnel)
 *   - Hard gates appliqués (si pertinent)
 *   - Trust-List forensicAudit (3-5 contrôles techniques)
 *   - Synthèse + plan d'action LLM
 *
 * Architecture : button-driven (pas d'auto-analyse). L'analyse coûte
 * 1 appel OpenAI ⇒ le propriétaire la lance explicitement.
 */

import * as React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

// ─── Types miroirs de l'API (pas d'import server pour rester client-pur) ──

type ForensicStatus = 'VERIFIED' | 'WARNING' | 'ALERT';
type DecisionAdvice = 'GO_FAST' | 'MANUAL_CHECK' | 'REJECT';
type Grade = 'GRADE S' | 'GRADE A' | 'GRADE B' | 'ALERTE';
type GradeStatus = 'SUCCESS' | 'WARNING' | 'DANGER';
type FinalVerdict = 'recommended' | 'review' | 'risky';

interface AnalyzeV2Response {
  ai: {
    flags: {
      isFraudDetected: boolean;
      isDossierComplete: boolean;
      isIncomeSufficient: boolean;
    };
    subScores: {
      financialStability: number;
      documentAuthenticity: number;
      professionalReliability: number;
    };
    synthesis: {
      title: string;
      executiveSummary: string;
      anomaliesFound: string[];
    };
    ownerRecommendation: {
      decisionAdvice: DecisionAdvice;
      actionPlan: string[];
    };
    forensicAudit: Array<{
      checkName: string;
      status: ForensicStatus;
      details: string;
    }>;
  };
  resilience: {
    score: number;
    grade: Grade;
    status: GradeStatus;
    color: string;
    decision: DecisionAdvice;
    finalVerdict: FinalVerdict;
    breakdown: {
      financialStability: number;
      documentAuthenticity: number;
      professionalReliability: number;
      rawScore: number;
    };
    hardGates: string[];
  };
  meta: { model: string; analyzedAt: string; applicationId?: string };
}

// ─── Maps statiques (Tailwind a besoin de classes en clair pour le purge) ─

const GRADE_STYLE: Record<
  Grade,
  { text: string; bg: string; ring: string; barFill: string; chip: string }
> = {
  'GRADE S': {
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    barFill: 'bg-emerald-500',
    chip: 'bg-emerald-600 text-white',
  },
  'GRADE A': {
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    barFill: 'bg-emerald-400',
    chip: 'bg-emerald-500 text-white',
  },
  'GRADE B': {
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    barFill: 'bg-amber-500',
    chip: 'bg-amber-500 text-white',
  },
  ALERTE: {
    text: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-200',
    barFill: 'bg-red-500',
    chip: 'bg-red-600 text-white',
  },
};

const FORENSIC_STYLE: Record<
  ForensicStatus,
  { Icon: typeof ShieldCheck; iconCls: string; bg: string; border: string; title: string }
> = {
  VERIFIED: {
    Icon: ShieldCheck,
    iconCls: 'text-emerald-600',
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200',
    title: 'Vérifié',
  },
  WARNING: {
    Icon: AlertTriangle,
    iconCls: 'text-amber-600',
    bg: 'bg-amber-50/60',
    border: 'border-amber-200',
    title: 'À surveiller',
  },
  ALERT: {
    Icon: AlertOctagon,
    iconCls: 'text-red-600',
    bg: 'bg-red-50/60',
    border: 'border-red-200',
    title: 'Alerte',
  },
};

const DECISION_LABEL: Record<DecisionAdvice, string> = {
  GO_FAST: 'Validation rapide recommandée',
  MANUAL_CHECK: 'Revue manuelle conseillée',
  REJECT: 'Dossier à écarter',
};

// ─── Sous-composants ──────────────────────────────────────────────────────

function PillarBar({
  label,
  points,
  max,
  fillCls,
}: {
  label: string;
  points: number;
  max: number;
  fillCls: string;
}): React.ReactElement {
  const pct = Math.max(0, Math.min(100, (points / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">
          {points} / {max}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${fillCls}`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function ForensicItem({
  item,
}: {
  item: AnalyzeV2Response['ai']['forensicAudit'][number];
}): React.ReactElement {
  const cfg = FORENSIC_STYLE[item.status];
  const { Icon } = cfg;
  return (
    <li
      className={`flex items-start gap-3 rounded-lg border ${cfg.border} ${cfg.bg} px-3 py-2.5`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.iconCls}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {item.checkName}
          </p>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.iconCls}`}
          >
            {cfg.title}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
          {item.details}
        </p>
      </div>
    </li>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────

export interface AnalysisV2PanelProps {
  applicationId: string;
  className?: string;
}

export function AnalysisV2Panel({
  applicationId,
  className = '',
}: AnalysisV2PanelProps): React.ReactElement {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AnalyzeV2Response | null>(null);

  async function runAnalysis(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/owner/applications/${applicationId}/analyze-v2`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const body = (await res.json().catch(() => ({}))) as
        | AnalyzeV2Response
        | { error?: string };
      if (!res.ok) {
        const message =
          (body as { error?: string }).error || `Erreur HTTP ${res.status}`;
        throw new Error(message);
      }
      setResult(body as AnalyzeV2Response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  const grade = result?.resilience.grade;
  const gradeStyle = grade ? GRADE_STYLE[grade] : null;

  return (
    <section
      className={`mx-4 my-4 rounded-xl border border-slate-200 bg-white shadow-sm sm:mx-6 ${className}`}
      aria-labelledby="analysis-v2-title"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slate-900 p-2 text-white">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3
              id="analysis-v2-title"
              className="text-sm font-semibold text-slate-900"
            >
              Analyse IA — Indice de Résilience V2
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Architecture neuro-symbolique : observations LLM + scoring
              déterministe garanti sans hallucination.
            </p>
          </div>
        </div>
        {!result && (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Analyse en cours…
              </span>
            ) : (
              'Lancer l’analyse'
            )}
          </button>
        )}
        {result && (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={loading}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Re-analyse…' : 'Relancer'}
          </button>
        )}
      </header>

      {/* Body */}
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {!result && !error && !loading && (
          <p className="text-sm leading-relaxed text-slate-600">
            Lancez l&rsquo;analyse pour obtenir l&rsquo;Indice de Résilience
            déterministe, la décision recommandée et la Trust-List des
            contrôles anti-fraude effectués sur les pièces du dossier.
          </p>
        )}

        {loading && !result && (
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Analyse forensique en cours, cela peut prendre une dizaine de
            secondes…
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
          >
            <ShieldAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Analyse impossible</p>
              <p className="mt-0.5 text-xs leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {result && grade && gradeStyle && (
          <div className="space-y-5">
            {/* Score + grade + decision */}
            <div
              className={`flex flex-col gap-4 rounded-xl ${gradeStyle.bg} px-4 py-4 ring-1 ${gradeStyle.ring} sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-1">
                  <span
                    className={`tabular-nums text-4xl font-bold leading-none ${gradeStyle.text}`}
                  >
                    {result.resilience.score}
                  </span>
                  <span className={`text-sm font-semibold ${gradeStyle.text}`}>
                    /100
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${gradeStyle.chip}`}
                  >
                    {grade}
                  </span>
                  <p className="mt-1 text-xs font-medium text-slate-700">
                    {DECISION_LABEL[result.resilience.decision]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Brut : {result.resilience.breakdown.rawScore} (avant règles
                  défensives)
                </span>
              </div>
            </div>

            {/* Hard gates */}
            {result.resilience.hardGates.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Règles défensives appliquées
                </p>
                <ul className="mt-1 space-y-1 text-xs text-amber-900">
                  {result.resilience.hardGates.map((g) => (
                    <li key={g} className="flex items-start gap-1.5">
                      <span aria-hidden="true">▸</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Breakdown par pilier */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Détail par pilier
              </h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <PillarBar
                  label="Stabilité financière"
                  points={result.resilience.breakdown.financialStability}
                  max={40}
                  fillCls={gradeStyle.barFill}
                />
                <PillarBar
                  label="Authenticité"
                  points={result.resilience.breakdown.documentAuthenticity}
                  max={40}
                  fillCls={gradeStyle.barFill}
                />
                <PillarBar
                  label="Fiabilité pro"
                  points={result.resilience.breakdown.professionalReliability}
                  max={20}
                  fillCls={gradeStyle.barFill}
                />
              </div>
            </div>

            {/* Trust-List forensic */}
            {result.ai.forensicAudit.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Trust-List anti-fraude ({result.ai.forensicAudit.length}{' '}
                  contrôles)
                </h4>
                <ul className="space-y-1.5">
                  {result.ai.forensicAudit.map((item, idx) => (
                    <ForensicItem key={`${item.checkName}-${idx}`} item={item} />
                  ))}
                </ul>
              </div>
            )}

            {/* Synthèse LLM */}
            {result.ai.synthesis.executiveSummary && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {result.ai.synthesis.title}
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  {result.ai.synthesis.executiveSummary}
                </p>
                {result.ai.synthesis.anomaliesFound.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                    {result.ai.synthesis.anomaliesFound.map((a) => (
                      <li key={a} className="flex items-start gap-1.5">
                        <AlertTriangle
                          className="mt-0.5 h-3 w-3 shrink-0 text-amber-500"
                          aria-hidden="true"
                        />
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Plan d'action */}
            {result.ai.ownerRecommendation.actionPlan.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Plan d&rsquo;action
                </h4>
                <ol className="mt-1.5 space-y-1.5 text-sm text-slate-700">
                  {result.ai.ownerRecommendation.actionPlan.map((step, i) => (
                    <li key={`${step}-${i}`} className="flex items-start gap-2">
                      <span
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Meta */}
            <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>
                Analysé par {result.meta.model} le{' '}
                {new Date(result.meta.analyzedAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              {result.resilience.decision === 'GO_FAST' && (
                <CheckCircle2
                  className="ml-1 h-3 w-3 text-emerald-500"
                  aria-hidden="true"
                />
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
