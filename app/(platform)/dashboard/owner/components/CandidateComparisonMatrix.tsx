'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Crown, ExternalLink, Lock, ShieldCheck } from 'lucide-react';

import { ActionBar, cx, InfoRow, PremiumSurface, StatusBadge } from '@/app/components/ui/premium';

type CandidateRecord = {
  id: string;
  isSealed?: boolean;
  isOwnerSelected?: boolean;
  rank?: number;
  profile?: { firstName?: string; lastName?: string };
  sealedLabel?: string;
  sealedId?: string;
  patrimometer?: { grade?: string };
  ownerInsights?: {
    decisionSummary?: {
      headline?: string;
      strengths?: string[];
      watchouts?: string[];
    };
    comparison?: {
      scoreLabel?: string;
      identityVerified?: boolean;
      identityVerifiedLabel?: string;
      monthlyIncomeLabel?: string;
      remainingIncomeLabel?: string;
      effortRateLabel?: string;
      qualityLabel?: string;
      guaranteeLabel?: string;
      readyToLease?: boolean;
      readyToLeaseLabel?: string;
      riskLabel?: string;
      auditLabel?: string;
      masked?: boolean;
    };
  } | null;
};

const ROWS = [
  { id: 'score', label: 'Score de confiance' },
  { id: 'identity', label: 'Identité vérifiée' },
  { id: 'income', label: 'Revenus mensuels' },
  { id: 'remaining', label: 'Reste à vivre' },
  { id: 'effort', label: 'Taux d’effort' },
  { id: 'quality', label: 'Qualité documentaire' },
  { id: 'guarantee', label: 'Garantie' },
  { id: 'ready', label: 'Prêt pour le bail' },
] as const;

function candidateName(candidate?: CandidateRecord | null) {
  if (!candidate) return 'Candidat';
  if (candidate.isSealed) return candidate.sealedLabel || candidate.sealedId || 'Profil masqué';
  return [candidate.profile?.firstName, candidate.profile?.lastName].filter(Boolean).join(' ').trim() || 'Candidat';
}

function rowValue(candidate: CandidateRecord, rowId: (typeof ROWS)[number]['id']) {
  const comparison = candidate.ownerInsights?.comparison;
  if (rowId === 'score') return comparison?.scoreLabel || '—';
  if (rowId === 'identity') return comparison?.identityVerifiedLabel || '—';
  if (rowId === 'income') return comparison?.monthlyIncomeLabel || '—';
  if (rowId === 'remaining') return comparison?.remainingIncomeLabel || '—';
  if (rowId === 'effort') return comparison?.effortRateLabel || '—';
  if (rowId === 'quality') return comparison?.qualityLabel || '—';
  if (rowId === 'guarantee') return comparison?.guaranteeLabel || '—';
  return comparison?.readyToLeaseLabel || '—';
}

export default function CandidateComparisonMatrix({
  propertyId,
  candidates,
  otherCandidates,
  selectedCandidateId,
  pendingCandidateId,
  selectionBusyId,
  canChangeSelection,
  onRequestChoose,
  onConfirmChoose,
  onCancelChoose,
  onUnlock,
}: {
  propertyId: string;
  candidates: CandidateRecord[];
  otherCandidates: CandidateRecord[];
  selectedCandidateId?: string | null;
  pendingCandidateId?: string | null;
  selectionBusyId?: string | null;
  canChangeSelection: boolean;
  onRequestChoose: (candidateId: string) => void;
  onConfirmChoose: () => void;
  onCancelChoose: () => void;
  onUnlock: () => void;
}) {
  const hasMasked = candidates.some((candidate) => candidate.isSealed);
  const pendingCandidate = candidates.find((candidate) => candidate.id === pendingCandidateId) || null;

  return (
    <div className="space-y-6">
      {hasMasked ? (
        <PremiumSurface padding="md" className="rounded-3xl border-amber-200 bg-amber-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100">
                <Lock className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                  Accès complet
                </div>
                <h3 className="mt-2 font-serif text-2xl tracking-tight text-amber-950">
                  Les finalistes sont comparables tout de suite
                </h3>
                <p className="mt-2 text-sm leading-6 text-amber-900/85">
                  Les indicateurs clés sont visibles ici. Ouvrez le détail complet uniquement quand vous êtes prêt à trancher.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onUnlock}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900"
            >
              <Lock className="h-4 w-4 text-amber-300" />
              Accéder aux dossiers complets
            </button>
          </div>
        </PremiumSurface>
      ) : null}

      {pendingCandidate ? (
        <PremiumSurface padding="md" className="rounded-3xl border-emerald-200 bg-emerald-50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Confirmation
              </div>
              <h3 className="mt-2 font-serif text-2xl tracking-tight text-emerald-950">
                Sélectionner {candidateName(pendingCandidate)} ?
              </h3>
              <p className="mt-2 text-sm leading-6 text-emerald-900/85">
                {pendingCandidate.ownerInsights?.decisionSummary?.headline || 'Ce choix déclenchera la suite du tunnel propriétaire.'}
              </p>
            </div>
            <ActionBar className="gap-2">
              <button
                type="button"
                onClick={onCancelChoose}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onConfirmChoose}
                disabled={selectionBusyId === pendingCandidate.id}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-55"
              >
                <Crown className="h-4 w-4 text-amber-300" />
                {selectionBusyId === pendingCandidate.id ? 'Sélection...' : 'Confirmer la sélection'}
              </button>
            </ActionBar>
          </div>
        </PremiumSurface>
      ) : null}

      <PremiumSurface padding="lg" className="rounded-3xl border-slate-200 bg-white">
        <div className="hidden lg:block">
          <div className="grid gap-4" style={{ gridTemplateColumns: `minmax(220px, 0.85fr) repeat(${candidates.length}, minmax(0, 1fr))` }}>
            <div />
            {candidates.map((candidate) => {
              const comparison = candidate.ownerInsights?.comparison;
              const selected = selectedCandidateId && selectedCandidateId === candidate.id;
              return (
                <div key={`header-${candidate.id}`} className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <ActionBar className="gap-2">
                    {candidate.rank ? (
                      <StatusBadge tone="neutral" label={`#${candidate.rank}`} className="normal-case tracking-normal text-[10px] font-semibold" />
                    ) : null}
                    {selected ? (
                      <StatusBadge tone="dark" label="Retenu" className="normal-case tracking-normal text-[10px] font-semibold" />
                    ) : null}
                    {comparison?.identityVerified ? (
                      <StatusBadge tone="success" label="Identité OK" className="normal-case tracking-normal text-[10px] font-semibold" />
                    ) : null}
                  </ActionBar>
                  <div className="mt-3 font-serif text-2xl tracking-tight text-slate-950">
                    {candidateName(candidate)}
                  </div>
                  <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">
                    {candidate.ownerInsights?.decisionSummary?.headline || 'Profil à comparer.'}
                  </p>
                  <ActionBar className="mt-4 gap-2">
                    <Link
                      href={`/dashboard/owner/property/${propertyId}/candidate/${candidate.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Analyse complète
                    </Link>
                    {candidate.isSealed ? (
                      <button
                        type="button"
                        onClick={onUnlock}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                      >
                        <Lock className="h-4 w-4 text-amber-300" />
                        Déverrouiller
                      </button>
                    ) : selected ? (
                      <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        Choisi
                      </span>
                    ) : canChangeSelection ? (
                      <button
                        type="button"
                        onClick={() => onRequestChoose(candidate.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                      >
                        <Crown className="h-4 w-4 text-amber-300" />
                        Sélectionner
                      </button>
                    ) : null}
                  </ActionBar>
                </div>
              );
            })}

            {ROWS.map((row) => (
              <div key={row.id} className="contents">
                <div className="flex items-center rounded-[1.35rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  {row.label}
                </div>
                {candidates.map((candidate) => (
                  <div key={`${row.id}-${candidate.id}`} className="flex items-center rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950">
                    {rowValue(candidate, row.id)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 lg:hidden">
          {candidates.map((candidate) => {
            const selected = selectedCandidateId && selectedCandidateId === candidate.id;
            return (
              <div key={`mobile-${candidate.id}`} className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-4">
                <ActionBar className="gap-2">
                  {candidate.rank ? (
                    <StatusBadge tone="neutral" label={`#${candidate.rank}`} className="normal-case tracking-normal text-[10px] font-semibold" />
                  ) : null}
                  {selected ? (
                    <StatusBadge tone="dark" label="Retenu" className="normal-case tracking-normal text-[10px] font-semibold" />
                  ) : null}
                </ActionBar>
                <div className="mt-3 font-serif text-2xl tracking-tight text-slate-950">
                  {candidateName(candidate)}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {candidate.ownerInsights?.decisionSummary?.headline || 'Profil à comparer.'}
                </p>
                <div className="mt-4 space-y-3">
                  {ROWS.map((row) => (
                    <InfoRow key={`${row.id}-${candidate.id}-mobile`} label={row.label} value={rowValue(candidate, row.id)} />
                  ))}
                </div>
                <ActionBar className="mt-4 gap-2">
                  <Link
                    href={`/dashboard/owner/property/${propertyId}/candidate/${candidate.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Analyse complète
                  </Link>
                  {candidate.isSealed ? (
                    <button
                      type="button"
                      onClick={onUnlock}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                    >
                      <Lock className="h-4 w-4 text-amber-300" />
                      Déverrouiller
                    </button>
                  ) : selected ? (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Choisi
                    </span>
                  ) : canChangeSelection ? (
                    <button
                      type="button"
                      onClick={() => onRequestChoose(candidate.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                    >
                      <Crown className="h-4 w-4 text-amber-300" />
                      Sélectionner
                    </button>
                  ) : null}
                </ActionBar>
              </div>
            );
          })}
        </div>
      </PremiumSurface>

      {otherCandidates.length > 0 ? (
        <PremiumSurface padding="md" className="rounded-3xl border-slate-200 bg-slate-50/75">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Autres dossiers
              </div>
              <h3 className="mt-2 font-serif text-2xl tracking-tight text-slate-950">
                Garder un plan B visible
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Les finalistes restent au centre. Les autres dossiers restent accessibles si vous souhaitez élargir la comparaison.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {otherCandidates.map((candidate) => (
              <div key={`other-${candidate.id}`} className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{candidateName(candidate)}</span>
                    <StatusBadge
                      tone={candidate.isSealed ? 'warning' : 'neutral'}
                      label={candidate.isSealed ? 'Masqué' : candidate.ownerInsights?.comparison?.scoreLabel || 'Dossier'}
                      className="normal-case tracking-normal text-[10px] font-semibold"
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {candidate.ownerInsights?.decisionSummary?.headline || 'Profil accessible en second rideau.'}
                  </p>
                </div>
                <ActionBar className="gap-2">
                  <Link
                    href={`/dashboard/owner/property/${propertyId}/candidate/${candidate.id}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Voir
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {candidate.isSealed ? (
                    <button
                      type="button"
                      onClick={onUnlock}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                    >
                      <Lock className="h-4 w-4 text-amber-300" />
                      Déverrouiller
                    </button>
                  ) : null}
                </ActionBar>
              </div>
            ))}
          </div>
        </PremiumSurface>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {candidates.map((candidate) => (
          <PremiumSurface key={`signal-${candidate.id}`} padding="md" className="rounded-3xl border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                {candidate.isSealed ? <Lock className="h-4 w-4 text-amber-700" /> : <ShieldCheck className="h-4 w-4 text-emerald-700" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-950">{candidateName(candidate)}</div>
                <div className="text-xs text-slate-500">
                  {candidate.ownerInsights?.comparison?.auditLabel || 'Lecture du dossier'}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {(candidate.ownerInsights?.decisionSummary?.strengths || []).slice(0, 3).map((item) => (
                <div key={`${candidate.id}-strength-${item}`} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
              {(candidate.ownerInsights?.decisionSummary?.watchouts || []).slice(0, 2).map((item) => (
                <div key={`${candidate.id}-watch-${item}`} className="flex items-start gap-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </PremiumSurface>
        ))}
      </div>
    </div>
  );
}
