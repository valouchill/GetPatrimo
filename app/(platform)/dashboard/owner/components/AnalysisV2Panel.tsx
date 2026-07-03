'use client';

/**
 * AnalysisV2Panel — Carte d'analyse IA neuro-symbolique (V6.3).
 *
 * Appelle POST /api/owner/applications/[id]/analyze-v2 et affiche :
 *   - Indice de Résilience 0-100 + niveau Banque Privée
 *     (PLATINUM / GOLD / SILVER / ALERTE)
 *   - Décision recommandée (GO_FAST / MANUAL_CHECK / REJECT)
 *   - Breakdown par pilier (financier / authenticité / professionnel)
 *   - Hard gates appliqués (si pertinent)
 *   - Trust-List forensicAudit (3-5 contrôles techniques)
 *   - Synthèse + plan d'action LLM
 *
 * Architecture : button-driven (pas d'auto-analyse). L'analyse coûte
 * 1 appel OpenAI ⇒ le propriétaire la lance explicitement.
 *
 * Visuels par niveau (inspiration cartes Banque Privée) :
 *   - PLATINUM : carte noire mate + accent or
 *   - GOLD     : crème ambre haut de gamme
 *   - SILVER   : gris perle sobre
 *   - ALERTE   : rouge mat alerte
 */

import * as React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
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
type Level = 'PLATINUM' | 'GOLD' | 'SILVER' | 'ALERTE';
type LevelStatus = 'SUCCESS' | 'WARNING' | 'DANGER';
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
    level: Level;
    status: LevelStatus;
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
  /** Présent quand l'objet a été persisté en cache Mongo (set par POST + GET). */
  cachedAt?: string;
  /** Essai gratuit : compteur après cette analyse (POST uniquement) — rappel doux
   *  pour éviter le mur brutal au 4e dossier. */
  freeTrial?: { used: number; limit: number; pricingUrl: string } | null;
}

// ─── Maps statiques (Tailwind a besoin de classes en clair pour le purge) ─

/**
 * Style auxiliaire par niveau pour la carte conteneur et la barre de
 * pondération. Le badge lui-même utilise la chaîne `color` renvoyée par
 * l'API directement (pré-composée bg + text + ring).
 *
 * Inspiration : cartes Banque Privée — PLATINUM en noir & or, GOLD ambre,
 * SILVER gris sobre, ALERTE rouge mat.
 */
const LEVEL_STYLE: Record<
  Level,
  { containerBg: string; containerRing: string; scoreText: string; barFill: string; tagline: string }
> = {
  PLATINUM: {
    containerBg: 'bg-gradient-to-br from-slate-900 to-slate-800',
    containerRing: 'ring-amber-500/40',
    scoreText: 'text-amber-400',
    barFill: 'bg-amber-500',
    tagline: 'Dossier d’exception — validation rapide possible.',
  },
  GOLD: {
    containerBg: 'bg-amber-50',
    containerRing: 'ring-amber-200',
    scoreText: 'text-amber-800',
    barFill: 'bg-amber-400',
    tagline: 'Dossier solide — revue manuelle recommandée.',
  },
  SILVER: {
    containerBg: 'bg-slate-50',
    containerRing: 'ring-slate-200',
    scoreText: 'text-slate-800',
    barFill: 'bg-slate-400',
    tagline: 'Dossier acceptable — vérifications complémentaires.',
  },
  ALERTE: {
    containerBg: 'bg-red-50',
    containerRing: 'ring-red-200',
    scoreText: 'text-red-700',
    barFill: 'bg-red-500',
    tagline: 'Dossier à écarter — alertes critiques détectées.',
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
  /**
   * V7.13 — Notifie le parent (header de la modale) du score/niveau V2
   * dès qu'un résultat est disponible (cache au montage OU re-run).
   * Permet d'afficher l'Indice de Résilience V2 comme source de vérité.
   */
  onResult?: (r: { score: number; level: string }) => void;
  /** Identité certifiée eIDAS (Didit) → neutralise les contrôles forensic d'identité. */
  diditVerified?: boolean;
  /**
   * Endpoint POST personnalisé (ex: mode « dossier exemple »
   * `/api/owner/demo-analysis?variant=fraud`). Défaut : la route analyze-v2
   * de la candidature (`applicationId`).
   */
  endpoint?: string;
  /**
   * Si false, ne lit PAS le cache Mongo au montage (GET) — utile en mode démo
   * où il n'existe pas de candidature. Défaut : true.
   */
  autoCache?: boolean;
}

export function AnalysisV2Panel({
  applicationId,
  className = '',
  onResult,
  diditVerified,
  endpoint,
  autoCache = true,
}: AnalysisV2PanelProps): React.ReactElement {
  const analyzeUrl =
    endpoint ?? `/api/owner/applications/${applicationId}/analyze-v2`;
  const [loading, setLoading] = React.useState(false);
  const [cacheLoading, setCacheLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AnalyzeV2Response | null>(null);
  const [isCached, setIsCached] = React.useState(false);
  // V8.0 — Blocage offre FREE (402 PAYMENT_REQUIRED) → upsell
  const [paymentRequired, setPaymentRequired] = React.useState<{
    message: string;
    pricingUrl: string;
  } | null>(null);

  // V7.13 — Ref stable pour notifier le parent sans re-déclencher l'effet
  const onResultRef = React.useRef(onResult);
  React.useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  const notifyResult = React.useCallback((body: AnalyzeV2Response): void => {
    onResultRef.current?.({
      score: body.resilience.score,
      level: body.resilience.level,
    });
  }, []);

  // ─── Auto-fetch du cache au montage (GET, pas d'appel OpenAI) ──────────
  React.useEffect(() => {
    // Mode démo (autoCache=false) : pas de candidature en base → on saute le
    // GET cache et on affiche directement l'état « Lancer l'analyse ».
    if (autoCache === false) {
      setCacheLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchCached(): Promise<void> {
      try {
        const res = await fetch(
          `/api/owner/applications/${applicationId}/analyze-v2`,
          { method: 'GET' },
        );
        if (cancelled) return;
        if (res.status === 204) {
          // Pas de cache — afficher l'état initial "Lancer l'analyse"
          setIsCached(false);
          return;
        }
        if (res.ok) {
          const body = (await res.json()) as AnalyzeV2Response;
          setResult(body);
          setIsCached(true);
          notifyResult(body);
          return;
        }
        // 401/403/404/500 sur GET ne sont pas bloquants : on tombe sur l'état
        // initial avec bouton "Lancer l'analyse" qui retentera la POST.
      } catch {
        // Erreur réseau silencieuse — on laisse l'utilisateur cliquer.
      } finally {
        if (!cancelled) setCacheLoading(false);
      }
    }
    fetchCached();
    return () => {
      cancelled = true;
    };
  }, [applicationId, notifyResult, autoCache]);

  async function runAnalysis(): Promise<void> {
    setLoading(true);
    setError(null);
    setPaymentRequired(null);
    try {
      const res = await fetch(analyzeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = (await res.json().catch(() => ({}))) as
        | AnalyzeV2Response
        | { error?: string; code?: string; pricingUrl?: string };
      if (!res.ok) {
        // 402 : essai gratuit épuisé OU quota payant épuisé → upsell (pas une erreur brute).
        if (res.status === 402) {
          setPaymentRequired({
            message:
              (body as { error?: string }).error ||
              "L'analyse IA nécessite une offre payante.",
            pricingUrl:
              (body as { pricingUrl?: string }).pricingUrl || '/pricing',
          });
          return;
        }
        const message =
          (body as { error?: string }).error || `Erreur HTTP ${res.status}`;
        throw new Error(message);
      }
      setResult(body as AnalyzeV2Response);
      setIsCached(false); // Fresh re-run → état "vient d'être analysé"
      notifyResult(body as AnalyzeV2Response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  const level = result?.resilience.level;
  const levelStyle = level ? LEVEL_STYLE[level] : null;
  // Sur PLATINUM, le score est sur fond sombre → secondaires en blanc cassé.
  const isPlatinum = level === 'PLATINUM';
  const secondaryText = isPlatinum ? 'text-slate-300' : 'text-slate-700';
  const mutedText = isPlatinum ? 'text-slate-400' : 'text-slate-500';

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
        {!result && !cacheLoading && (
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
          <div className="flex shrink-0 items-center gap-2">
            {isCached && (
              <span
                className="hidden items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 sm:inline-flex"
                title="Résultat issu du cache — pas d'appel OpenAI déclenché"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                Cache
              </span>
            )}
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Re-analyse…' : 'Relancer'}
            </button>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {cacheLoading && (
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Vérification du cache d&rsquo;analyse…
          </div>
        )}

        {!cacheLoading && !result && !error && !loading && (
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

        {/* V8.0 — Offre FREE : upsell (au lieu d'une erreur) */}
        {paymentRequired && (
          <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-900 text-amber-400">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-900">
                  Débloquez tous vos candidats
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {paymentRequired.message}
                </p>
                <a
                  href={paymentRequired.pricingUrl}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
                >
                  Voir les offres
                </a>
              </div>
            </div>
          </div>
        )}

        {error && !paymentRequired && (
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

        {result && level && levelStyle && (
          <div className="space-y-5">
            {/* Score + niveau (carte métal) + décision */}
            <div
              className={`flex flex-col gap-4 rounded-xl px-4 py-4 ring-1 ${levelStyle.containerBg} ${levelStyle.containerRing} sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-1">
                  <span
                    className={`tabular-nums text-4xl font-bold leading-none ${levelStyle.scoreText}`}
                  >
                    {result.resilience.score}
                  </span>
                  <span className={`text-sm font-semibold ${levelStyle.scoreText}`}>
                    /100
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ring-1 ${result.resilience.color}`}
                  >
                    {level}
                  </span>
                  <p className={`mt-1 text-xs font-medium ${secondaryText}`}>
                    {DECISION_LABEL[result.resilience.decision]}
                  </p>
                </div>
              </div>
              <div className={`flex items-center gap-2 text-xs ${mutedText}`}>
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
                  fillCls={levelStyle.barFill}
                />
                <PillarBar
                  label="Authenticité"
                  points={result.resilience.breakdown.documentAuthenticity}
                  max={40}
                  fillCls={levelStyle.barFill}
                />
                <PillarBar
                  label="Fiabilité pro"
                  points={result.resilience.breakdown.professionalReliability}
                  max={20}
                  fillCls={levelStyle.barFill}
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
                  {result.ai.forensicAudit.map((rawItem, idx) => {
                    const item =
                      diditVerified &&
                      /(cni|identit|titre de s[eé]jour|mrz)/i.test(rawItem.checkName) &&
                      rawItem.status !== 'VERIFIED'
                        ? {
                            ...rawItem,
                            status: 'VERIFIED' as ForensicStatus,
                            details:
                              'Identité certifiée eIDAS (Didit) — vérification biométrique souveraine.',
                          }
                        : rawItem;
                    return (
                      <ForensicItem key={`${item.checkName}-${idx}`} item={item} />
                    );
                  })}
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

            {/* Rappel essai gratuit — au moment du "aha", pas au moment du mur */}
            {result.freeTrial && (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-amber-900">
                  <span className="font-semibold">
                    {result.freeTrial.limit === 1
                      ? 'Votre audit d’essai est utilisé.'
                      : `${result.freeTrial.used}/${result.freeTrial.limit} audits d’essai utilisés.`}
                  </span>{' '}
                  L&rsquo;identité et les pièces de vos candidats restent masquées — débloquez
                  tout + de nouveaux audits dès 19,90&nbsp;€.
                </p>
                <a
                  href={result.freeTrial.pricingUrl}
                  className="shrink-0 rounded-lg bg-emerald-900 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Voir les offres
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
