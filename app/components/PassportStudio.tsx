'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Share2,
  Sparkles,
} from 'lucide-react';
import {
  ActionBar,
  MetricTile,
  PremiumSectionHeader,
  PremiumSurface,
  StatusBadge,
} from '@/app/components/ui/premium';

interface PassportStudioData {
  state: 'draft' | 'review' | 'ready' | 'sealed';
  stateLabel: string;
  shareEnabled: boolean;
  previewUrl: string | null;
  shareUrl: string | null;
  downloadUrl: string | null;
  score: number;
  grade: string;
  summary: string;
  readinessReasons: string[];
  warnings: string[];
  hero: {
    fullName: string;
    profession: string;
    region: string;
    gradeLabel: string;
    badge: string;
    identityVerified: boolean;
  };
  solvency: {
    exactMonthlyIncomeLabel: string | null;
    rentAmountLabel: string | null;
    effortRateLabel: string | null;
  };
  guarantee: {
    label: string;
    status: string;
    summary: string;
  };
  pillars: Array<{
    id: string;
    label: string;
    score: number;
    max: number;
    verified: boolean;
    status: string;
    certifiedCount: number;
    reviewCount: number;
  }>;
  metrics: {
    passportId: string;
    generatedAt: string | null;
    validUntil: string | null;
  };
}

const stateClasses: Record<string, string> = {
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  review: 'border-blue-200 bg-blue-50 text-blue-700',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  sealed: 'border-slate-200 bg-slate-100 text-slate-800',
};

export default function PassportStudio({
  applicationId,
  refreshKey,
  fallbackName,
  fallbackSummary,
  fallbackWarnings,
  onStateChange,
}: {
  applicationId: string | null;
  refreshKey: string;
  fallbackName: string;
  fallbackSummary: string;
  fallbackWarnings: string[];
  onStateChange?: (value: {
    state: 'draft' | 'review' | 'ready' | 'sealed';
    readinessReasons: string[];
    summary: string;
  }) => void;
}) {
  const [passport, setPassport] = useState<PassportStudioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done'>('idle');

  useEffect(() => {
    if (!applicationId) {
      setPassport(null);
      onStateChange?.({
        state: 'draft',
        readinessReasons: fallbackWarnings,
        summary: fallbackSummary,
      });
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/passport/application/${applicationId}`)
      .then((res) => {
        if (!res.ok) throw new Error('passport-fetch-failed');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setPassport(data);
          onStateChange?.({
            state: data.state,
            readinessReasons: data.readinessReasons || [],
            summary: data.summary,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPassport(null);
          onStateChange?.({
            state: 'draft',
            readinessReasons: fallbackWarnings,
            summary: fallbackSummary,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, fallbackSummary, fallbackWarnings, onStateChange, refreshKey]);

  const highlights = useMemo(() => {
    if (!passport) return fallbackWarnings.slice(0, 4);
    return (passport.readinessReasons.length > 0 ? passport.readinessReasons : passport.warnings).slice(0, 4);
  }, [passport, fallbackWarnings]);

  const handleOpenPreview = () => {
    const url = passport?.previewUrl || passport?.shareUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async () => {
    const url = passport?.downloadUrl;
    if (!url) return;
    setDownloadLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('pdf-download-failed');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `Passeport_PatrimoTrust_${passport?.hero.fullName || 'Dossier'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!passport?.shareUrl || !passport.shareEnabled) return;
    await navigator.clipboard.writeText(passport.shareUrl);
    setCopyState('done');
    window.setTimeout(() => setCopyState('idle'), 2200);
  };

  const handleNativeShare = async () => {
    if (!passport?.shareUrl || !passport.shareEnabled) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Passeport locataire ${passport.hero.fullName}`,
          text: passport.summary,
          url: passport.shareUrl,
        });
        return;
      } catch {
        // Ignore user cancellation and fall back to copy.
      }
    }
    await handleCopy();
  };

  const state = passport?.state || 'draft';
  const stateLabel = passport?.stateLabel || 'Brouillon';
  const stateClass = stateClasses[state] || stateClasses.draft;
  const canShare = Boolean(passport?.shareEnabled && passport?.shareUrl);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <PremiumSurface tone="dark" padding="lg" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-emerald-200">
            <Sparkles className="h-4 w-4" />
            Passport Studio
          </div>
          <StatusBadge
            tone={state === 'ready' ? 'success' : state === 'sealed' ? 'dark' : state === 'review' ? 'info' : 'warning'}
            label={loading ? 'Synchronisation' : stateLabel}
            className={state === 'sealed' ? 'border-white/10 bg-white/10 text-white' : stateClass}
          />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-emerald-200/80">Aperçu web</p>
            <h3 className="mt-4 break-words font-serif text-4xl tracking-tight sm:text-5xl">
              {passport?.hero.fullName || fallbackName}
            </h3>
            <p className="mt-3 break-anywhere text-sm uppercase tracking-[0.22em] text-slate-300">
              {passport?.hero.profession || 'Profil locataire'} · {passport?.hero.region || 'Région masquée'}
            </p>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-200">
              {passport?.summary || fallbackSummary}
            </p>

            <ActionBar className="mt-6">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100">
                {passport?.hero.gradeLabel || 'Score en calcul'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100">
                {passport?.guarantee.label || 'Garantie à qualifier'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100">
                {passport?.hero.badge || 'Passeport en préparation'}
              </span>
            </ActionBar>
          </div>

          <div className="min-w-0 rounded-[1.8rem] border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Panneau rapide</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MetricTile label="Score" value={passport?.score ?? '--'} tone="dark" valueClassName="text-3xl font-black" />
              <MetricTile
                label="Identité"
                value={passport?.hero.identityVerified ? 'Vérifiée' : 'À confirmer'}
                tone="dark"
                valueClassName="text-base sm:text-lg"
              />
              <MetricTile
                label="Revenus"
                value={passport?.solvency.exactMonthlyIncomeLabel || 'En attente'}
                tone="dark"
                valueClassName="text-sm"
              />
              <MetricTile
                label="Taux d'effort"
                value={passport?.solvency.effortRateLabel || 'À calculer'}
                tone="dark"
                valueClassName="text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(passport?.pillars || []).slice(0, 4).map((pillar) => (
            <div key={pillar.id} className="min-w-0 rounded-[1.3rem] border border-white/10 bg-white/10 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">{pillar.label}</p>
              <p className="mt-2 text-xl font-bold">{pillar.score}/{pillar.max}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-300">
                {pillar.verified ? 'Bloc couvert' : pillar.status}
              </p>
            </div>
          ))}
        </div>
      </PremiumSurface>

      <PremiumSurface>
        <PremiumSectionHeader
          eyebrow="Actions"
          title="Prévisualisez et transmettez"
          description="Les actions restent disponibles à chaque étape, mais le partage externe n’est activé que pour un passeport réellement prêt."
          actions={loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : null}
        />

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleOpenPreview}
            disabled={!passport?.previewUrl && !passport?.shareUrl}
            className="flex w-full flex-col items-start justify-between gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-row sm:items-center"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Voir la page web</p>
              <p className="mt-1 text-sm text-slate-500">Ouvre l’aperçu public du passeport dans un nouvel onglet.</p>
            </div>
            <ArrowUpRight className="h-5 w-5 flex-shrink-0 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!passport?.downloadUrl || downloadLoading}
            className="flex w-full flex-col items-start justify-between gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-row sm:items-center"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Télécharger le PDF</p>
              <p className="mt-1 text-sm text-slate-500">Version multi-pages avec filigrane adapté à l’état du dossier.</p>
            </div>
            {downloadLoading ? <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-slate-400" /> : <Download className="h-5 w-5 flex-shrink-0 text-slate-400" />}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!canShare}
            className="flex w-full flex-col items-start justify-between gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-row sm:items-center"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Copier le lien</p>
              <p className="mt-1 text-sm text-slate-500">
                {canShare ? 'Lien public prêt à être partagé.' : 'Le lien externe s’active uniquement quand le passeport est prêt ou scellé.'}
              </p>
            </div>
            {copyState === 'done' ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" /> : <Copy className="h-5 w-5 flex-shrink-0 text-slate-400" />}
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            disabled={!canShare}
            className="flex w-full flex-col items-start justify-between gap-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-row sm:items-center"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Partager</p>
              <p className="mt-1 text-sm text-slate-500">Utilise le partage natif si disponible, sinon copie le lien.</p>
            </div>
            <Share2 className="h-5 w-5 flex-shrink-0 text-slate-400" />
          </button>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Pourquoi ce statut</p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            {highlights.length > 0 ? (
              highlights.map((item) => <li key={item}>• {item}</li>)
            ) : (
              <li>• Le passeport est cohérent et synchronisé avec la page web et le PDF.</li>
            )}
          </ul>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <MetricTile
            label="Passeport ID"
            value={passport?.metrics.passportId || 'En génération'}
            caption={`Dernière génération ${passport?.metrics.generatedAt || 'en attente'}`}
            tone="default"
            valueClassName="text-sm sm:text-base"
          />
          <MetricTile
            label="Validité indicative"
            value={passport?.metrics.validUntil || 'À calculer'}
            caption="Toute modification documentaire régénère le passeport."
            tone="default"
            valueClassName="text-sm sm:text-base"
          />
        </div>
      </PremiumSurface>
    </div>
  );
}
