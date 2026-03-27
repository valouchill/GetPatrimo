'use client';

import { Fragment, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Copy, Download, ExternalLink, FileSignature, Lock, Plus, RefreshCw, ScrollText, ShieldCheck } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/shared';
import { useOwner } from './OwnerContext';
import {
  Avatar, ScorePill, Tag, GuaranteeBadge, Btn, StatCard, Bar, StagePill,
  toBien, toDossier, NAV, STAGE_FR,
  type LocalBien, type LocalDossier, type NavId, type TagType,
} from './components/ui';
import { CandidatCard } from './components/CandidatCard';
import { TunnelSelection } from './components/TunnelSelection';
import { NouvelActifForm } from './components/NouvelActifForm';
import { CandidateDetailDrawer } from './components/CandidateDetailDrawer';
import { PropertyDetailModal } from './components/PropertyDetailModal';

export default function OwnerDashboardClient() {
  const { data, loading, userEmail, refresh } = useOwner();
  const [page, setPage] = useState<NavId>('dashboard');
  const [selBienId, setSelBienId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [guaranteeFilter, setGuaranteeFilter] = useState<'all' | 'with'>('all');
  const [candidateDrawerId, setCandidateDrawerId] = useState<string | null>(null);
  const [propertyModalId, setPropertyModalId] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────
  const biens = data.map(toBien);
  const bienById = new Map(biens.map((b) => [b.id, b]));
  const allDossiers: LocalDossier[] = data.flatMap((e) =>
    e.candidatures.map((c) => toDossier(c, e.property.id, e.property.rent || 0))
  );
  const pending = allDossiers.filter((d) => !d.isSealed && d.statut === 'en_attente').length;
  const selectionnes = biens.filter((b) => b.isRented || b.flowStage === 'management').length;
  // Baux: contract OR management stage
  const biensAvecBail = data.filter((e) => e.flow.stage === 'contract' || e.flow.stage === 'management');
  // EDL / Gestion: management stage
  const biensGeres = data.filter((e) => e.flow.stage === 'management' || e.property.isRented);

  const go = (p: NavId) => { setPage(p); setExpandedId(null); };

  const copyLink = async (token: string, id: string) => {
    const url = `${window.location.origin}/apply/${token}`;
    try { await navigator.clipboard.writeText(url); }
    catch { /* fallback: select/copy */ const el = document.createElement('textarea'); el.value = url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const selBien = selBienId ? bienById.get(selBienId) ?? null : null;
  const selCands = selBienId ? allDossiers.filter((d) => d.bien_id === selBienId) : [];

  // ── Table helpers (local, stable refs) ────────────────────────
  function Th({ children }: { children?: React.ReactNode }) {
    return <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</th>;
  }
  function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`border-t border-slate-100 px-5 py-4 text-sm ${className}`}>{children}</td>;
  }

  // ── Loading / error ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner label="Chargement de votre espace…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 font-sans">

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-600 text-lg">🛡️</div>
            <div>
              <div className="font-serif text-base font-bold tracking-tight text-slate-950">PatrimoTrust™</div>
              <div className="mt-0.5 inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Propriétaire</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {[...new Set(NAV.map((n) => n.group))].map((grp) => (
            <div key={grp} className="mb-4">
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{grp}</div>
              {NAV.filter((n) => n.group === grp).map(({ id, label, Icon, badge }) => {
                const active = page === id;
                return (
                  <button key={id} type="button" onClick={() => go(id)}
                    className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                      active ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {badge && pending > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{pending}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-800 to-emerald-600 text-xs font-bold text-white">
              {userEmail ? userEmail[0].toUpperCase() : 'P'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-900">{userEmail || 'Propriétaire'}</div>
              <div className="text-[11px] text-slate-400">Espace sécurisé</div>
            </div>
            <button type="button" onClick={refresh} aria-label="Actualiser" className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <main className="ml-60 flex-1 px-8 py-8">

        {/* ─ DASHBOARD ─ */}
        {page === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">
                  Bonjour{userEmail ? ` ${userEmail.split('@')[0]}` : ''} 👋
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {biens.length} bien{biens.length !== 1 ? 's' : ''} · {allDossiers.length} candidature{allDossiers.length !== 1 ? 's' : ''}
                </p>
              </div>
              <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Nouvel actif</Btn>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon="🏠" value={biens.length}    label="Actifs en portefeuille" bg="bg-emerald-50" />
              <StatCard icon="📋" value={allDossiers.length} label="Candidatures reçues"  bg="bg-teal-50" />
              <StatCard icon="✓"  value={selectionnes}    label="Locataires sélectionnés" bg="bg-blue-50" />
              <StatCard icon="⏳" value={pending}         label="En attente d'examen"    bg="bg-amber-50" />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {/* Dernières candidatures */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Dernières candidatures</div>
                  <button type="button" onClick={() => go('candidatures')} className="text-xs font-semibold text-emerald-600 hover:underline">Voir tout →</button>
                </div>
                {allDossiers.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-2 text-sm text-slate-400">Aucune candidature reçue.</p>
                    <p className="text-xs text-slate-400">Partagez le lien Sésame de vos biens pour commencer.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {[...allDossiers]
                      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
                      .slice(0, 5)
                      .map((d) => {
                        const bien = bienById.get(d.bien_id);
                        return (
                          <button key={d.id} type="button" onClick={() => d.isSealed ? setPropertyModalId(d.bien_id) : setCandidateDrawerId(d.id)}
                            className="-mx-1 flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-slate-50">
                            <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-slate-900">{d.prenom} {d.nom}</div>
                              <div className="truncate text-xs text-slate-500">{bien?.label || '—'} · {d.contrat}</div>
                            </div>
                            <ScorePill score={d.score} />
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Biens avec prochaine action */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Prochaines actions</div>
                  <button type="button" onClick={() => go('biens')} className="text-xs font-semibold text-emerald-600 hover:underline">Tous les actifs →</button>
                </div>
                {biens.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-3 text-sm text-slate-400">Aucun bien enregistré.</p>
                    <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer un actif</Btn>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {biens.slice(0, 5).map((b) => (
                      <div key={b.id} className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-base">🏠</span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{b.label}</div>
                              <div className="text-xs text-slate-500">{b.loyer.toLocaleString()} €/mois</div>
                            </div>
                          </div>
                          <StagePill stage={b.flowStage} stageLabel={b.flowStageLabel} />
                        </div>
                        {b.flowSummary && (
                          <p className="mt-2 text-xs text-slate-500 line-clamp-2">{b.flowSummary}</p>
                        )}
                        {b.nextActionLabel && (
                          <button type="button" onClick={() => setPropertyModalId(b.id)}
                            className="mt-2 text-xs font-semibold text-emerald-600 hover:underline">
                            → {b.nextActionLabel}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─ CANDIDATURES ─ */}
        {page === 'candidatures' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">Candidatures</h1>
                <p className="mt-1 text-sm text-slate-500">{allDossiers.length} dossier{allDossiers.length !== 1 ? 's' : ''} · Analyse IA activée</p>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
                <button type="button" onClick={() => setGuaranteeFilter('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${guaranteeFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  Tous
                </button>
                <button type="button" onClick={() => setGuaranteeFilter('with')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${guaranteeFilter === 'with' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  Avec garant
                </button>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">📭</div>
                <p className="mb-4 text-slate-500">Aucun bien en portefeuille.</p>
                <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer un actif</Btn>
              </div>
            ) : (
              <div className="space-y-5">
                {data.map((entry) => {
                  const b = bienById.get(entry.property.id)!;
                  const candsAll = allDossiers.filter((d) => d.bien_id === b.id);
                  const cands = guaranteeFilter === 'with'
                    ? candsAll.filter((d) => d.guaranteeMode === 'VISALE' || d.guaranteeMode === 'PHYSICAL')
                    : candsAll;
                  const hasSel = candsAll.some((d) => d.statut === 'selectionne');
                  return (
                    <div key={b.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">🏠</div>
                          <div>
                            <div className="font-semibold text-slate-900">{b.label}</div>
                            <div className="text-xs text-slate-500">
                              {b.loyer.toLocaleString()} €/mois · {cands.length} candidature{cands.length !== 1 ? 's' : ''}
                              {cands.filter(c => !c.isSealed).length > 0 && ` · ${cands.filter(c => !c.isSealed).length} déverrouillé${cands.filter(c => !c.isSealed).length !== 1 ? 's' : ''}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setPropertyModalId(b.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            <ExternalLink className="h-3.5 w-3.5" /> Fiche complète
                          </button>
                          {hasSel ? (
                            <Tag type="green">✓ Locataire sélectionné</Tag>
                          ) : cands.filter(c => !c.isSealed).length > 0 ? (
                            <Btn variant="amber" onClick={() => setSelBienId(b.id)}>Sélectionner <ArrowRight className="h-4 w-4" /></Btn>
                          ) : null}
                        </div>
                      </div>

                      {cands.length > 0 ? (
                        <table className="w-full border-collapse">
                          <thead className="bg-slate-50">
                            <tr>
                              <Th>Candidat</Th><Th>Revenus</Th><Th>Score IA</Th><Th>Statut</Th><Th>Garantie</Th><Th></Th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...cands].sort((a, b) => (a.isSealed ? 1 : 0) - (b.isSealed ? 1 : 0) || b.score - a.score).map((d) => (
                              <Fragment key={d.id}>
                                <tr onClick={() => !d.isSealed && setExpandedId(expandedId === d.id ? null : d.id)}
                                  className={`transition-colors ${d.isSealed ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                                  <Td>
                                    <div className="flex items-center gap-3">
                                      {d.isSealed
                                        ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Lock className="h-4 w-4 text-slate-400" /></div>
                                        : <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                                      }
                                      <div>
                                        <div className="font-semibold text-slate-900">
                                          {d.isSealed ? (d.sealedLabel || 'Candidat scellé') : `${d.prenom} ${d.nom}`}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                          {d.submittedAt ? new Date(d.submittedAt).toLocaleDateString('fr-FR') : '—'}
                                        </div>
                                      </div>
                                    </div>
                                  </Td>
                                  <Td>{d.isSealed ? <span className="text-slate-300">—</span> : <b className="text-slate-900">{d.revenus.toLocaleString()} €</b>}</Td>
                                  <Td>{d.isSealed ? <span className="text-slate-300">—</span> : <ScorePill score={d.score} />}</Td>
                                  <Td>
                                    {d.isSealed
                                      ? <Tag type="slate">🔒 Scellé</Tag>
                                      : <Tag type={d.statut === 'selectionne' ? 'green' : 'indigo'}>
                                          {d.statut === 'selectionne' ? '✓ Sélectionné' : 'En attente'}
                                        </Tag>
                                    }
                                  </Td>
                                  <Td>{d.isSealed ? <span className="text-slate-300">—</span> : <GuaranteeBadge mode={d.guaranteeMode} short />}</Td>
                                  <Td>
                                    {!d.isSealed && (
                                      <button type="button"
                                        onClick={(e) => { e.stopPropagation(); setCandidateDrawerId(d.id); }}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                        Voir →
                                      </button>
                                    )}
                                  </Td>
                                </tr>
                                {expandedId === d.id && !d.isSealed && (
                                  <tr>
                                    <td colSpan={6} className="border-t border-slate-100 bg-slate-50/80 px-5 py-5">
                                      <div className="grid gap-5 xl:grid-cols-2">
                                        <div>
                                          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Analyse IA</div>
                                          {([
                                            ['Solvabilité', b.loyer > 0 ? Math.min((d.revenus / b.loyer / 3) * 100, 100) : 0, d.revenus / (b.loyer || 1) >= 3 ? 'bg-emerald-500' : 'bg-amber-500'],
                                            ['Qualité dossier', d.qualityScore ?? 50, (d.qualityScore ?? 0) >= 70 ? 'bg-emerald-500' : 'bg-amber-500'],
                                            ['Audit IA', d.auditStatus === 'CLEAR' ? 100 : d.auditStatus === 'ALERT' ? 15 : 60, d.auditStatus === 'CLEAR' ? 'bg-emerald-500' : d.auditStatus === 'ALERT' ? 'bg-red-500' : 'bg-amber-500'],
                                          ] as [string, number, string][]).map(([l, v, c]) => (
                                            <div key={l} className="mb-3">
                                              <div className="mb-1 flex justify-between text-xs font-semibold">
                                                <span className="text-slate-500">{l}</span><span className="text-slate-700">{Math.round(v)}%</span>
                                              </div>
                                              <Bar value={v} color={c} />
                                            </div>
                                          ))}
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                          {([
                                            ['Contrat', d.contrat],
                                            ['Revenus', `${d.revenus.toLocaleString()} €`],
                                            ['Ratio', `${(d.revenus / (b.loyer || 1)).toFixed(1)}×`],
                                            ['Reste à vivre', d.remainingIncomeLabel || '—'],
                                            ['Effort locatif', d.effortRateLabel || '—'],
                                          ] as [string, string][]).map(([k, v]) => (
                                            <div key={k} className="flex justify-between py-2 text-sm">
                                              <span className="text-slate-500">{k}</span>
                                              <span className="font-semibold text-slate-900">{v}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      {d.auditSummary && (
                                        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs italic text-slate-600">{d.auditSummary}</div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex items-center justify-between px-5 py-4">
                          <p className="text-sm text-slate-400">Aucune candidature reçue — partagez le lien Sésame.</p>
                          {b.applyToken && (
                            <button type="button" onClick={() => copyLink(b.applyToken!, b.id)}
                              aria-label="Copier le lien candidature"
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                              <Copy className="h-3.5 w-3.5" />
                              {copiedId === b.id ? 'Copié !' : 'Copier le lien Sésame'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ─ MES ACTIFS ─ */}
        {page === 'biens' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-3xl font-bold text-slate-950">Mes actifs</h1>
                <p className="mt-1 text-sm text-slate-500">{biens.length} bien{biens.length !== 1 ? 's' : ''} en portefeuille</p>
              </div>
              <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Nouvel actif</Btn>
            </div>
            {biens.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">🏠</div>
                <p className="mb-4 text-slate-500">Aucun bien enregistré.</p>
                <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer votre premier actif</Btn>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {biens.map((b) => {
                  const selTenant = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                  const candCount = allDossiers.filter((d) => d.bien_id === b.id).length;
                  return (
                    <div key={b.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">🏠</div>
                        <StagePill stage={b.flowStage} stageLabel={b.flowStageLabel} />
                      </div>
                      <div className="font-bold text-slate-950">{b.label}</div>
                      <div className="mt-0.5 mb-3 text-sm text-slate-500 line-clamp-1">{b.adresse}</div>
                      <div className="mb-3 text-[1.75rem] font-bold text-emerald-700">
                        {b.loyer.toLocaleString()} <span className="text-sm font-normal text-slate-400">€/mois</span>
                      </div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {b.surface > 0 && <Tag>{b.surface} m²</Tag>}
                        <Tag>{candCount} candidature{candCount !== 1 ? 's' : ''}</Tag>
                      </div>
                      {selTenant && (
                        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                          <span className="text-slate-500">Locataire · </span>
                          <b className="text-slate-900">{selTenant.prenom} {selTenant.nom}</b>
                        </div>
                      )}
                      {b.flowSummary && (
                        <p className="mb-3 text-xs leading-5 text-slate-500 line-clamp-2">{b.flowSummary}</p>
                      )}
                      {typeof b.flowProgress === 'number' && (
                        <div className="mb-4">
                          <div className="mb-1 flex justify-between text-xs text-slate-400">
                            <span>Progression</span><span>{b.flowProgress}%</span>
                          </div>
                          <Bar value={b.flowProgress} />
                        </div>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2">
                        <Btn variant="secondary" className="flex-1 py-2 text-xs" onClick={() => setPropertyModalId(b.id)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Voir la fiche
                        </Btn>
                        {!b.isRented && allDossiers.filter(d => d.bien_id === b.id && !d.isSealed).length > 0 && (
                          <Btn variant="amber" className="flex-1 py-2 text-xs" onClick={() => setSelBienId(b.id)}>
                            Sélectionner →
                          </Btn>
                        )}
                        {b.applyToken && !b.isRented && (
                          <button type="button" onClick={() => copyLink(b.applyToken!, b.id)} title="Copier le lien Sésame" aria-label="Copier le lien Sésame"
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              copiedId === b.id
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}>
                            {copiedId === b.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ─ NOUVEL ACTIF ─ */}
        {page === 'depot' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Nouvel actif</h1>
              <p className="mt-1 text-sm text-slate-500">Ajoutez un bien à votre portefeuille PatrimoTrust</p>
            </div>
            <NouvelActifForm onDone={() => { refresh(); go('biens'); }} />
          </motion.div>
        )}

        {/* ─ BAUX ─ */}
        {page === 'baux' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Baux &amp; Signatures</h1>
              <p className="mt-1 text-sm text-slate-500">Suivi des contrats · Signature électronique</p>
            </div>
            {biensAvecBail.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">📄</div>
                <p className="mb-2 text-slate-500">Aucun bail en cours.</p>
                <p className="text-xs text-slate-400">Sélectionnez un locataire depuis vos candidatures pour démarrer la rédaction.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Loyer</Th><Th>Étape</Th><Th>Statut bail</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {biensAvecBail.map((entry) => {
                      const b = bienById.get(entry.property.id)!;
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      const tenantName = b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={tenantName} id={b.id} size="sm" />
                              <b className="text-slate-900">{tenantName}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-600">{b.label}</span></Td>
                          <Td><b className="text-emerald-700">{b.loyer.toLocaleString()} €</b></Td>
                          <Td><StagePill stage={b.flowStage} stageLabel={b.flowStageLabel} /></Td>
                          <Td>
                            <Tag type={b.leaseStatusLabel?.toLowerCase().includes('signé') ? 'green' : 'amber'}>
                              {b.leaseStatusLabel || (entry.flow.stage === 'contract' ? 'En cours de rédaction' : 'En gestion')}
                            </Tag>
                          </Td>
                          <Td>
                            <Btn variant="ghost" className="py-1.5 text-xs" onClick={() => setPropertyModalId(b.id)}>
                              <FileSignature className="h-3.5 w-3.5" /> Gérer →
                            </Btn>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* ─ GESTION LOCATIVE ─ */}
        {page === 'gestion' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">Gestion locative</h1>
              <p className="mt-1 text-sm text-slate-500">Suivi des locataires actifs</p>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon="🏠" value={biensGeres.length}   label="Biens en gestion"    bg="bg-emerald-50" />
              <StatCard icon="📋" value={allDossiers.length}  label="Candidatures totales" bg="bg-teal-50" />
              <StatCard icon="✓"  value={selectionnes}        label="Locataires actifs"   bg="bg-blue-50" />
              <StatCard icon="⏳" value={pending}             label="En attente"          bg="bg-amber-50" />
            </div>
            {biensGeres.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
                <div className="mb-3 text-4xl">📊</div>
                <p className="text-slate-500">Aucun bien en gestion active pour le moment.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Loyer</Th><Th>Statut</Th><Th>Résumé</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {biensGeres.map((entry) => {
                      const b = bienById.get(entry.property.id)!;
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      const tenantName = b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={tenantName} id={b.id} size="sm" />
                              <b>{tenantName}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-600">{b.label}</span></Td>
                          <Td><b className="text-emerald-700">{b.loyer.toLocaleString()} €</b></Td>
                          <Td><Tag type="green">{b.isRented ? 'Occupé' : 'En gestion'}</Tag></Td>
                          <Td><span className="text-xs text-slate-500 line-clamp-2">{b.leaseStatusLabel || entry.flow.managementSummary?.summary || '—'}</span></Td>
                          <Td>
                            <Btn variant="ghost" className="py-1.5 text-xs" onClick={() => setPropertyModalId(b.id)}>
                              <ScrollText className="h-3.5 w-3.5" /> Détail →
                            </Btn>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* ─ ÉTATS DES LIEUX ─ */}
        {page === 'edl' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-3xl font-bold text-slate-950">États des lieux</h1>
              <p className="mt-1 text-sm text-slate-500">Entrées &amp; sorties · Rapport numérique · Signature</p>
            </div>
            {biensGeres.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 text-4xl">🔑</div>
                <p className="text-slate-500">Aucun bien en gestion avec un état des lieux.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr><Th>Locataire</Th><Th>Bien</Th><Th>Type</Th><Th>Étape</Th><Th>Actions</Th></tr>
                  </thead>
                  <tbody>
                    {biensGeres.map((entry) => {
                      const b = bienById.get(entry.property.id)!;
                      const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                      const tenantName = b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—');
                      return (
                        <tr key={b.id} className="transition-colors hover:bg-slate-50">
                          <Td>
                            <div className="flex items-center gap-3">
                              <Avatar name={tenantName} id={b.id} size="sm" />
                              <b>{tenantName}</b>
                            </div>
                          </Td>
                          <Td><span className="text-slate-600">{b.label}</span></Td>
                          <Td><Tag type="indigo">Entrée</Tag></Td>
                          <Td>
                            <Tag type={entry.flow.stage === 'management' ? 'green' : 'amber'}>
                              {entry.flow.stage === 'management' ? 'EDL réalisé' : 'À planifier'}
                            </Tag>
                          </Td>
                          <Td>
                            <Btn variant="ghost" className="py-1.5 text-xs" onClick={() => setPropertyModalId(b.id)}>
                              <Download className="h-3.5 w-3.5" /> Voir l&apos;EDL →
                            </Btn>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* ── TUNNEL SÉLECTION ────────────────────────────────────── */}
      <AnimatePresence>
        {selBienId && selBien && (
          <motion.div key="tunnel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TunnelSelection
              bien={selBien}
              candidats={selCands}
              onClose={() => setSelBienId(null)}
              onConfirmed={() => refresh()}
              onGoToProperty={() => setPropertyModalId(selBienId)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CANDIDATE DETAIL DRAWER ───────────────────────────────── */}
      <AnimatePresence>
        {candidateDrawerId && (() => {
          const c = allDossiers.find((d) => d.id === candidateDrawerId);
          const b = c ? bienById.get(c.bien_id) : null;
          if (!c || !b) return null;
          return (
            <CandidateDetailDrawer
              key="candidate-drawer"
              c={c}
              bien={b}
              onClose={() => setCandidateDrawerId(null)}
              onSelect={(cd) => { setSelBienId(cd.bien_id); setCandidateDrawerId(null); }}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── PROPERTY DETAIL MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {propertyModalId && (() => {
          const b = bienById.get(propertyModalId);
          if (!b) return null;
          const modalCands = allDossiers.filter((d) => d.bien_id === propertyModalId);
          return (
            <PropertyDetailModal
              key="property-modal"
              bien={b}
              candidats={modalCands}
              allData={data}
              onClose={() => setPropertyModalId(null)}
              onSelectCandidate={(c) => { setPropertyModalId(null); setCandidateDrawerId(c.id); }}
              onOpenTunnel={() => { setPropertyModalId(null); setSelBienId(propertyModalId); }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
