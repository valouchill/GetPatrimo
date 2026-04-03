'use client';

import { Fragment, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  FolderOpen,
  Lock,
  Pencil,
  ScrollText,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  ScorePill,
  GuaranteeBadge,
  Btn,
  Bar,
  Avatar,
} from './ui';
import type { LocalDossier, LocalBien } from './ui';
import type { PropertyWithCandidatures } from '../OwnerContext';

// ── Types ────────────────────────────────────────────────────────────────────

type ModalTab = 'overview' | 'candidatures' | 'docs';

type VaultDocument = {
  id: string;
  label: string;
  status: string;
  kind: string;
  fileName?: string | null;
  downloadUrl?: string | null;
};

type ManagementTools = {
  leaseId?: string | null;
  signatureStatus?: string;
  edlStatus?: string;
  vaultDocuments?: VaultDocument[];
} | null;

// ── Pipeline compact ─────────────────────────────────────────────────────────

const PIPELINE = [
  { id: 'search', num: 'I', label: 'Recherche' },
  { id: 'analysis', num: 'II', label: 'Analyse' },
  { id: 'selection', num: 'III', label: 'Sélection' },
  { id: 'contract', num: 'IV', label: 'Contrat' },
  { id: 'management', num: 'V', label: 'Gestion' },
] as const;

function CompactPipeline({ currentStage }: { currentStage?: string }) {
  const idx = PIPELINE.findIndex((s) => s.id === currentStage);
  const safeIdx = idx >= 0 ? idx : 0;

  return (
    <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-100 bg-slate-50/60">
      {PIPELINE.map((stage, i) => {
        const done = i < safeIdx;
        const active = i === safeIdx;
        return (
          <Fragment key={stage.id}>
            <div className="flex items-center gap-1.5">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                done ? 'bg-emerald-500 text-white'
                : active ? 'border-2 border-orange-400 bg-white text-orange-600'
                : 'bg-slate-200 text-slate-400'
              }`}>
                {done ? <CheckCircle2 className="h-3 w-3" /> : stage.num}
              </div>
              <span className={`hidden text-[10px] font-semibold uppercase tracking-wide sm:inline ${
                active ? 'text-slate-800' : done ? 'text-emerald-700' : 'text-slate-400'
              }`}>
                {stage.label}
              </span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className={`mx-0.5 h-px flex-1 rounded-full ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v?: number | null) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible', CANDIDATE_SELECTION: 'En recherche',
  LEASE_IN_PROGRESS: 'Bail en cours', OCCUPIED: 'Occupé', VACANT: 'Vacant',
};
const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'bg-blue-50 text-blue-700 border-blue-200',
  CANDIDATE_SELECTION: 'bg-amber-50 text-amber-700 border-amber-200',
  LEASE_IN_PROGRESS: 'bg-orange-50 text-orange-700 border-orange-200',
  OCCUPIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VACANT: 'bg-red-50 text-red-700 border-red-200',
};

// ── Tab config ──────────────────────────────────────────────────────────────

const TABS: { id: ModalTab; label: string; Icon: typeof Building2 }[] = [
  { id: 'overview', label: "Vue d'ensemble", Icon: Building2 },
  { id: 'candidatures', label: 'Candidatures', Icon: Users },
  { id: 'docs', label: 'Documents', Icon: FolderOpen },
];

// ── Main component ──────────────────────────────────────────────────────────

export function PropertyDetailModal({
  bien,
  candidats,
  allData,
  onClose,
  onSelectCandidate,
  onOpenTunnel,
  onGoToContract,
  onEditProperty,
  onDeleteProperty,
}: {
  bien: LocalBien;
  candidats: LocalDossier[];
  allData: PropertyWithCandidatures[];
  onClose: () => void;
  onSelectCandidate: (c: LocalDossier) => void;
  onOpenTunnel: () => void;
  onGoToContract: (propertyId: string, applicationId?: string) => void;
  onEditProperty?: () => void;
  onDeleteProperty?: () => void;
}) {
  const [tab, setTab] = useState<ModalTab>('overview');
  const [copied, setCopied] = useState(false);
  const [mgmt, setMgmt] = useState<ManagementTools>(null);
  const [mgmtLoading, setMgmtLoading] = useState(false);

  const entry = allData.find((e) => e.property.id === bien.id);
  const flow = entry?.flow;
  const ms = flow?.managementSummary;
  const selectedCand = candidats.find((d) => d.statut === 'selectionne');
  const hasSel = !!selectedCand;
  const showTenant = flow?.stage === 'management' || bien.isRented;

  // Fetch management tools (vault docs, leaseId) on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMgmtLoading(true);
      try {
        const res = await fetch(`/api/owner/properties/${bien.id}`, { cache: 'no-store' });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMgmt(data.managementTools || null);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setMgmtLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [bien.id]);

  const handleCopy = async () => {
    if (!bien.applyToken) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/apply/${bien.applyToken}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* noop */ }
  };

  const sortedCandidats = [...candidats]
    .sort((a, b) => (a.isSealed ? 1 : 0) - (b.isSealed ? 1 : 0) || b.score - a.score);

  const enAttente = candidats.filter((d) => d.statut === 'en_attente').length;
  const selectionnes = candidats.filter((d) => d.statut === 'selectionne').length;
  const refuses = candidats.filter((d) => d.statut === 'refuse').length;
  const vaultDocs = mgmt?.vaultDocuments || [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[201] flex items-end md:items-center justify-center md:p-4"
        onClick={onClose}
      >
        <div
          className="flex h-[95vh] md:h-auto md:max-h-[92vh] w-full md:max-w-5xl flex-col overflow-hidden rounded-t-3xl md:rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="property-hub-title"
        >
          {/* ── HEADER ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50">
                <Building2 className="h-5 w-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 id="property-hub-title" className="truncate text-lg font-bold text-slate-950">
                    {bien.label}
                  </h2>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[bien.status || ''] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {STATUS_LABEL[bien.status || ''] || bien.flowStageLabel || '—'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-sm text-slate-500">{bien.adresse}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onEditProperty && (
                <button type="button" onClick={onEditProperty} title="Modifier"
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {onDeleteProperty && (
                <button type="button" onClick={onDeleteProperty} title="Archiver"
                  className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <Archive className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Fermer"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── PIPELINE ───────────────────────────────────────────── */}
          <CompactPipeline currentStage={flow?.stage} />

          {/* ── TABS ───────────────────────────────────────────────── */}
          <div className="flex gap-1 border-b border-slate-100 px-6 pt-2">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  tab === id
                    ? 'border-b-2 border-orange-500 bg-orange-50/50 text-orange-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {id === 'candidatures' && candidats.length > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    tab === id ? 'bg-orange-200/60 text-orange-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {candidats.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── TAB CONTENT (scrollable) ───────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ─── VUE D'ENSEMBLE ──────────────────────────────────── */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <KPI label="Loyer HC" value={formatCurrency(bien.loyer)} />
                  <KPI label="Candidatures" value={String(candidats.length)} />
                  <KPI label="Étape" value={bien.flowStageLabel || '—'} small />
                  <KPI label="Progression" value={`${bien.flowProgress ?? 0}%`}>
                    <Bar value={bien.flowProgress ?? 0} />
                  </KPI>
                </div>

                {/* Guidance */}
                {(flow?.guidance?.whyThisStage || flow?.summary) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Contexte</div>
                    <p className="text-sm leading-6 text-slate-700">{flow?.guidance?.whyThisStage || flow?.summary}</p>
                  </div>
                )}

                {/* Alerts */}
                {(flow?.alerts || []).length > 0 && (
                  <div className="space-y-2">
                    {flow!.alerts.map((alert, i) => (
                      <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {alert}
                      </div>
                    ))}
                  </div>
                )}

                {/* Locataire (si loué) */}
                {showTenant && ms && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-emerald-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Locataire en place</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <InfoItem label="Nom" value={ms.tenantLabel || '—'} />
                      <InfoItem label="Bail" value={ms.leaseStatusLabel || '—'} />
                      <InfoItem label="Prochaine échéance" value={ms.nextMilestone || 'Aucune'} />
                    </div>
                  </div>
                )}

                {/* Candidat sélectionné CTA */}
                {hasSel && selectedCand && (
                  <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar name={`${selectedCand.prenom} ${selectedCand.nom}`} id={selectedCand.id} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900">{selectedCand.prenom} {selectedCand.nom}</div>
                        <div className="text-xs font-semibold text-orange-700">Locataire retenu</div>
                      </div>
                      <ScorePill score={selectedCand.score} />
                    </div>
                    <Btn variant="primary" className="w-full" onClick={() => { onClose(); onGoToContract(bien.id, selectedCand.id); }}>
                      <FileSignature className="h-4 w-4" /> Rédiger le bail
                    </Btn>
                  </div>
                )}

                {/* Sésame (si non loué) */}
                {bien.applyToken && !bien.isRented && (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/50 px-5 py-4">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-orange-600">Lien Sésame candidat</div>
                    <p className="mb-3 text-sm text-slate-600">
                      Partagez ce lien pour permettre aux candidats de déposer leur dossier.
                    </p>
                    <code className="mb-3 block break-all rounded-xl border border-orange-200 bg-white px-3 py-2 font-mono text-xs text-slate-600">
                      {typeof window !== 'undefined' ? `${window.location.origin}/apply/${bien.applyToken}` : `/apply/${bien.applyToken}`}
                    </code>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleCopy}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                          copied ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}>
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? 'Copié !' : 'Copier'}
                      </button>
                      <button type="button"
                        onClick={() => window.open(`/apply/${bien.applyToken}`, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Voir la page
                      </button>
                    </div>
                  </div>
                )}

                {/* Prochaine action */}
                {flow?.nextAction?.label && (
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Prochaine action</div>
                      <div className="text-sm font-semibold text-slate-900">{flow.nextAction.label}</div>
                      {flow.nextAction.description && (
                        <div className="mt-0.5 text-xs text-slate-500">{flow.nextAction.description}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── CANDIDATURES ─────────────────────────────────────── */}
            {tab === 'candidatures' && (
              <div className="space-y-4">
                {/* Mini pipeline */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                    <div className="text-lg font-bold text-amber-600">{enAttente}</div>
                    <div className="text-[10px] font-semibold uppercase text-slate-500">En attente</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-center">
                    <div className="text-lg font-bold text-emerald-700">{selectionnes}</div>
                    <div className="text-[10px] font-semibold uppercase text-slate-500">Sélectionné{selectionnes !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                    <div className="text-lg font-bold text-slate-500">{refuses}</div>
                    <div className="text-[10px] font-semibold uppercase text-slate-500">Refusé{refuses !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                {/* Selected candidate banner */}
                {hasSel && selectedCand && (
                  <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-emerald-900">{selectedCand.prenom} {selectedCand.nom}</span>
                      <span className="ml-2 text-xs text-emerald-700">Locataire retenu</span>
                    </div>
                    <Btn variant="primary" className="shrink-0 text-xs py-1.5 px-3" onClick={() => { onClose(); onGoToContract(bien.id, selectedCand.id); }}>
                      <FileSignature className="h-3.5 w-3.5" /> Bail
                    </Btn>
                  </div>
                )}

                {/* Candidate list */}
                {sortedCandidats.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                    {sortedCandidats.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        disabled={d.isSealed}
                        onClick={() => { if (!d.isSealed) onSelectCandidate(d); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
                      >
                        {d.isSealed
                          ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Lock className="h-4 w-4 text-slate-400" /></div>
                          : <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                        }
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900">
                            {d.isSealed ? (d.sealedLabel || 'Profil scellé') : `${d.prenom} ${d.nom}`}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{d.contrat}</span>
                            {d.statut === 'selectionne' && <span className="font-semibold text-emerald-600">Retenu</span>}
                          </div>
                        </div>
                        {!d.isSealed && (
                          <div className="flex items-center gap-2 shrink-0">
                            <GuaranteeBadge mode={d.guaranteeMode} short />
                            <ScorePill score={d.score} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
                    <Users className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">Aucune candidature reçue.</p>
                    {bien.applyToken && !bien.isRented && (
                      <p className="mt-1 text-xs text-slate-400">Partagez le lien Sésame pour recevoir des dossiers.</p>
                    )}
                  </div>
                )}

                {/* Select tenant action */}
                {!hasSel && candidats.filter((d) => !d.isSealed).length > 0 && (
                  <Btn variant="amber" className="w-full" onClick={() => { onClose(); onOpenTunnel(); }}>
                    Sélectionner un locataire
                  </Btn>
                )}
              </div>
            )}

            {/* ─── DOCUMENTS & GESTION ─────────────────────────────── */}
            {tab === 'docs' && (
              <div className="space-y-5">
                {/* Coffre-fort documentaire */}
                <div>
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Coffre-fort documentaire
                  </div>
                  {mgmtLoading ? (
                    <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
                    </div>
                  ) : vaultDocs.length > 0 ? (
                    <div className="space-y-2">
                      {vaultDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{doc.label}</div>
                            <div className="mt-0.5 text-xs capitalize text-slate-400">{doc.status}</div>
                          </div>
                          {doc.downloadUrl ? (
                            <a href={doc.downloadUrl}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                              <Download className="h-3.5 w-3.5" /> Télécharger
                            </a>
                          ) : (
                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-400">
                              <Lock className="h-3.5 w-3.5" /> En attente
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-8 text-center">
                      <FileText className="mx-auto h-7 w-7 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">Aucun document disponible.</p>
                      <p className="mt-1 text-xs text-slate-400">Bail, acte de caution et EDL apparaîtront ici.</p>
                    </div>
                  )}
                </div>

                {/* Raccourcis */}
                <div>
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Raccourcis
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mgmt?.leaseId ? (
                      <a href={`/dashboard/owner/edl/${mgmt.leaseId}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                        <ScrollText className="h-4 w-4 text-slate-400" />
                        État des lieux
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed">
                        <ScrollText className="h-4 w-4" />
                        EDL (sans bail actif)
                      </span>
                    )}
                    <button type="button" onClick={onClose}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                      <FileSignature className="h-4 w-4 text-slate-400" />
                      Baux &amp; Signatures
                    </button>
                  </div>
                </div>

                {/* Info gestion si loué */}
                {showTenant && ms && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="h-4 w-4 text-emerald-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Gestion locative</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <InfoItem label="Locataire" value={ms.tenantLabel || '—'} />
                      <InfoItem label="Bail" value={ms.leaseStatusLabel || '—'} />
                      <InfoItem label="Prochaine échéance" value={ms.nextMilestone || 'Aucune'} />
                      <InfoItem label="Signature" value={mgmt?.signatureStatus || '—'} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────── */}
          <div className="border-t border-slate-100 px-4 py-3 pb-safe md:px-6 flex items-center justify-between gap-2">
            <div className="hidden text-xs text-slate-400 sm:block">
              {bien.surface > 0 && <span>{bien.surface} m²</span>}
              {bien.surface > 0 && bien.loyer > 0 && <span> · </span>}
              {bien.loyer > 0 && <span>{bien.loyer.toLocaleString('fr-FR')} €/mois</span>}
            </div>
            <div className="flex flex-1 gap-2 sm:flex-none">
              <Btn variant="secondary" onClick={onClose} className="flex-1 text-xs py-2.5 px-4 min-h-[44px] sm:flex-none">Fermer</Btn>
              {hasSel && selectedCand ? (
                <Btn variant="primary" onClick={() => { onClose(); onGoToContract(bien.id, selectedCand.id); }} className="flex-1 text-xs py-2.5 px-4 min-h-[44px] sm:flex-none">
                  <FileSignature className="h-3.5 w-3.5" /> Rédiger le bail
                </Btn>
              ) : !hasSel && candidats.filter((d) => !d.isSealed).length > 0 ? (
                <Btn variant="amber" onClick={() => { onClose(); onOpenTunnel(); }} className="flex-1 text-xs py-2.5 px-4 min-h-[44px] sm:flex-none">
                  Sélectionner un locataire
                </Btn>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function KPI({ label, value, small, children }: { label: string; value: string; small?: boolean; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
      <div className={`font-bold text-slate-900 ${small ? 'text-sm' : 'text-lg'}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase text-slate-500">{label}</div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}
