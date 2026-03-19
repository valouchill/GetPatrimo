'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Eye,
  FileStack,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import UpsellBanner from '@/app/components/UpsellBanner';
import {
  ActionBar,
  MetricTile,
  PremiumSectionHeader,
  PremiumSurface,
  StatusBadge,
} from '@/app/components/ui/premium';

interface PassportPublicData {
  state: 'draft' | 'review' | 'ready' | 'sealed';
  stateLabel: string;
  shareEnabled: boolean;
  previewUrl: string | null;
  shareUrl: string | null;
  score: number;
  grade: string;
  summary: string;
  readinessReasons: string[];
  warnings: string[];
  hero: {
    name: string;
    fullName: string;
    profession: string;
    region: string;
    gradeLabel: string;
    badge: string;
    propertyName: string;
    identityVerified: boolean;
  };
  solvency: {
    monthlyIncomeLabel: string | null;
    rentAmountLabel: string | null;
    effortRateLabel: string | null;
  };
  guarantee: {
    label: string;
    summary: string;
    status: string;
    requirement: string;
    shareBadge: string;
  };
  pillars: Array<{
    id: string;
    label: string;
    score: number;
    max: number;
    verified: boolean;
    status: string;
    summary: string;
    certifiedCount: number;
    reviewCount: number;
  }>;
  documentCoverage: {
    counts: {
      totalDocuments: number;
      certifiedDocuments: number;
      reviewDocuments: number;
      rejectedDocuments: number;
      viewCount: number;
      shareCount: number;
    };
    blocks: Array<{
      id: string;
      label: string;
      status: string;
      certifiedCount: number;
      reviewCount: number;
      rejectedCount: number;
      totalCount: number;
      latestDocumentAt: string | null;
    }>;
  };
  auditTimeline: Array<{
    id: string;
    title: string;
    status: string;
    time: string | null;
    description: string;
  }>;
  metrics: {
    passportId: string;
    generatedAt: string | null;
    validUntil: string | null;
    certificationDate: string | null;
    viewCount: number;
    shareCount: number;
  };
}

const stateStyles: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  review: 'bg-blue-100 text-blue-800 border-blue-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  sealed: 'bg-slate-200 text-slate-900 border-slate-300',
};

export default function PassportLandingClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PassportPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isPreview = searchParams.get('preview') === '1';

  useEffect(() => {
    if (slug.startsWith('PT-')) {
      window.location.href = `/apply/${slug}`;
      return;
    }

    const track = isPreview ? 'false' : 'true';
    fetch(`/api/passport/public/${slug}?track=${track}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug, isPreview]);

  const ctaUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/auth/login';
    return `${window.location.origin}/auth/login`;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F2EA]">
        <Loader2 className="h-10 w-10 animate-spin text-[#0F766E]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F2EA] p-6">
        <div className="max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-900">Ce lien de passeport est invalide ou a expiré.</p>
          <p className="mt-2 text-sm text-slate-500">Demandez au locataire de vous renvoyer son lien PatrimoTrust.</p>
        </div>
      </div>
    );
  }

  const highlights = data.readinessReasons.length > 0 ? data.readinessReasons : data.warnings;

  return (
    <div className="min-h-screen bg-[#F6F2EA] text-slate-900">
      <div className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top,#fff9e8,transparent_42%),linear-gradient(135deg,#f8fafc_0%,#f6f2ea_40%,#fefce8_100%)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,118,110,0.08),transparent_32%,rgba(180,83,9,0.08))]" />

        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
              PatrimoTrust Passport
            </div>
            <StatusBadge
              tone={data.state === 'ready' ? 'success' : data.state === 'sealed' ? 'neutral' : data.state === 'review' ? 'info' : 'warning'}
              label={
                <>
                  <BadgeCheck className="h-4 w-4" />
                  {data.stateLabel}
                </>
              }
              className={stateStyles[data.state] || stateStyles.draft}
            />
          </div>

          {isPreview && (
            <div className="mt-6 rounded-[1.5rem] border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900 shadow-sm">
              <div className="flex items-start gap-3">
                <Eye className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Aperçu candidat</p>
                  <p className="mt-1 text-blue-800">
                    Cette vue ne compte pas comme une consultation propriétaire et montre exactement la version publique qui sera partagée.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Passeport locataire partageable
              </div>
              <h1 className="mt-5 max-w-3xl break-words font-serif text-4xl tracking-tight text-slate-950 sm:text-5xl">
                {data.hero.name}
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
                {data.summary}
              </p>
              <ActionBar className="mt-6 text-sm text-slate-600">
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2">{data.hero.profession}</span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2">{data.hero.region}</span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2">{data.guarantee.shareBadge}</span>
              </ActionBar>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="min-w-0"
            >
              <PremiumSurface className="h-full" padding="lg">
                <PremiumSectionHeader eyebrow="Synthèse instantanée" title="Lecture rapide du dossier" />
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <MetricTile label="Score" value={data.score} caption={data.hero.gradeLabel} tone="dark" valueClassName="text-4xl font-black" />
                  <MetricTile label="Garantie" value={data.guarantee.label} caption={data.guarantee.status} />
                  <MetricTile label="Revenus" value={data.solvency.monthlyIncomeLabel || 'Non communiqué'} caption="Version publique masquée" />
                  <MetricTile label="Taux d'effort" value={data.solvency.effortRateLabel || 'À calculer'} caption="Selon le loyer cible communiqué" />
                </div>
              </PremiumSurface>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {highlights.length > 0 && (
          <PremiumSurface className="mb-8 border-amber-200">
            <div className="flex items-start gap-4">
              <CircleAlert className="mt-1 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-700">Lecture du passeport</p>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                  {highlights.slice(0, 4).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </PremiumSurface>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <PremiumSurface>
            <PremiumSectionHeader
              eyebrow="4 piliers"
              title="Solvabilité lisible en un coup d'œil"
              actions={
                <StatusBadge
                  tone="neutral"
                  label={`${data.documentCoverage.counts.certifiedDocuments} pièces certifiées`}
                  className="normal-case tracking-normal text-sm font-semibold"
                />
              }
            />

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {data.pillars.map((pillar) => (
                <article key={pillar.id} className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{pillar.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                        {pillar.verified ? 'Bloc couvert' : pillar.status}
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                      {pillar.score}/{pillar.max}
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-slate-600">{pillar.summary}</p>
                  <ActionBar className="mt-4 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                      Certifiées {pillar.certifiedCount}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                      En revue {pillar.reviewCount}
                    </span>
                  </ActionBar>
                </article>
              ))}
            </div>
          </PremiumSurface>

          <PremiumSurface>
            <PremiumSectionHeader eyebrow="Garantie et documents" title="Couverture dossier" />

            <div className="mt-6 rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Garantie</p>
              <p className="mt-2 text-2xl font-semibold">{data.guarantee.label}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{data.guarantee.summary}</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricTile label="Total pièces" value={data.documentCoverage.counts.totalDocuments} />
              <MetricTile label="En revue" value={data.documentCoverage.counts.reviewDocuments} />
              <MetricTile label="Consultations" value={data.metrics.viewCount} />
            </div>

            <div className="mt-6 space-y-3">
              {data.documentCoverage.blocks.map((block) => (
                <div key={block.id} className="flex flex-col gap-3 rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{block.label}</p>
                    <p className="text-xs text-slate-500">
                      Certifiées {block.certifiedCount} · En revue {block.reviewCount} · Dernière pièce {block.latestDocumentAt || 'n/a'}
                    </p>
                  </div>
                  <StatusBadge tone="neutral" label={block.status} />
                </div>
              ))}
            </div>
          </PremiumSurface>
        </div>

        <PremiumSurface className="mt-8">
          <PremiumSectionHeader
            eyebrow="Audit timeline"
            title="Chronologie du contrôle"
            actions={<StatusBadge tone="neutral" label={`Passeport ${data.metrics.passportId}`} className="normal-case tracking-normal text-sm font-semibold" />}
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {data.auditTimeline.map((event) => (
              <article key={event.id} className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                  <StatusBadge tone="neutral" label={event.status} />
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">{event.time || 'Horodatage indisponible'}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{event.description}</p>
              </article>
            ))}
          </div>
        </PremiumSurface>

        {!isPreview && (
          <section className="mt-8 overflow-hidden rounded-[2.2rem] border border-slate-200 bg-[linear-gradient(135deg,#0f172a,#111827_45%,#0f766e)] p-8 text-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.75)]">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-200">Déblocage propriétaire</p>
                <h2 className="mt-3 font-serif text-4xl tracking-tight">Accédez au dossier complet et à la protection impayés.</h2>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200">
                  Ce passeport montre déjà l’essentiel: identité vérifiée, cohérence des ressources, garantie et couverture documentaire.
                  Connectez-vous pour consulter les pièces justificatives et sécuriser votre mise en location.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <FileStack className="h-5 w-5 text-emerald-300" />
                  <p className="text-sm font-semibold">Ce que vous débloquez</p>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-slate-100">
                  <li>• Pièces justificatives brutes en lecture sécurisée</li>
                  <li>• Rapport IA et signaux anti-fraude du dossier</li>
                  <li>• Historique des consultations et conformité Alur</li>
                </ul>
                <a
                  href={ctaUrl}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-50"
                >
                  Accéder au dossier complet
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </section>
        )}

        <div className="mt-8">
          <UpsellBanner passportSlug={slug} candidateName={data.hero.name} />
        </div>
      </div>
    </div>
  );
}
