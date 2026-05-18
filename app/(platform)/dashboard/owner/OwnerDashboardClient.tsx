'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, ClipboardList, Clock, Copy, Download, ExternalLink, FileSignature, FileText, Home, Lock, MapPin, Menu, Plus, RefreshCw, ScrollText, Search, ShieldCheck, TrendingUp, Users, Wallet, X } from 'lucide-react';
import { LoadingSpinner } from '@/app/components/shared';
import { isEnabled } from '@/lib/features';
import { useOwner } from './OwnerContext';
import {
  Avatar, ScorePill, Tag, GuaranteeBadge, Btn, StatCard, Bar, StagePill,
  toBien, toDossier, NAV, STAGE_FR,
  type LocalBien, type LocalDossier, type NavId, type TagType,
} from './components/ui';

const isNavVisible = (n: (typeof NAV)[number]): boolean => {
  if (n.hidden) return false;
  if (n.feature && !isEnabled(n.feature)) return false;
  return true;
};
import { CandidatCard } from './components/CandidatCard';
import { TunnelSelection } from './components/TunnelSelection';
import { NouvelActifForm } from './components/NouvelActifForm';
import { CandidateDetailDrawer } from './components/CandidateDetailDrawer';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { PropertyCardMenu } from './components/PropertyCardMenu';
import { PropertyEditModal } from './components/PropertyEditModal';
import { PropertyDeleteDialog } from './components/PropertyDeleteDialog';
import { AddManagementModal } from './components/AddManagementModal';
import { LoyersPanel } from './components/LoyersPanel';
import { FinancialBanner } from './components/FinancialBanner';
import { ActivityTimeline } from './components/ActivityTimeline';
import { AlertsPanel } from './components/AlertsPanel';
import { PropertyFilters, type PropertyStatusFilter, type PropertySort, type PropertyView } from './components/PropertyFilters';
import { PropertyTable } from './components/PropertyTable';
import { ApplicationPipeline } from './components/ApplicationPipeline';
import { BauxPanel } from './components/BauxPanel';
import { EdlPanel } from './components/EdlPanel';
import { MobileBottomNav } from './components/MobileBottomNav';

export default function OwnerDashboardClient() {
  const router = useRouter();
  const { data, loading, userEmail, refresh } = useOwner();
  const [page, setPage] = useState<NavId>('dashboard');
  const [selBienId, setSelBienId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [guaranteeFilter, setGuaranteeFilter] = useState<'all' | 'with'>('all');
  const [candidateDrawerId, setCandidateDrawerId] = useState<string | null>(null);
  const [propertyModalId, setPropertyModalId] = useState<string | null>(null);
  const [editBienId, setEditBienId] = useState<string | null>(null);
  const [deleteBienId, setDeleteBienId] = useState<string | null>(null);
  const [showAddManagement, setShowAddManagement] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Biens page filters
  const [biensSearch, setBiensSearch] = useState('');
  const [biensStatusFilter, setBiensStatusFilter] = useState<PropertyStatusFilter>('all');
  const [biensSort, setBiensSort] = useState<PropertySort>('recent');
  const [biensView, setBiensView] = useState<PropertyView>('grid');

  // ── Dashboard summary data ────────────────────────────────────
  const [dashData, setDashData] = useState<{
    financial: { totalExpected: number; totalReceived: number; lateCount: number; pendingReceipts: number; collectionRate: number; remaining: number; revenueTrend: { month: number; year: number; expected: number; received: number }[] } | null;
    kpis: { totalProperties: number; occupiedProperties: number; activeLeasesCount: number } | null;
    alerts: { id: string; severity: 'critical' | 'warning' | 'info'; message: string; actionLabel: string; actionTarget: string }[];
    recentEvents: { id: string; type: string; date: string; propertyLabel: string | null; meta: Record<string, unknown> }[];
  }>({ financial: null, kpis: null, alerts: [], recentEvents: [] });

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setDashData(json.data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

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

  // ── Filtered & sorted biens ──────────────────────────────────
  const filteredBiens = (() => {
    let result = [...biens];
    // Search
    if (biensSearch.trim()) {
      const q = biensSearch.toLowerCase();
      result = result.filter((b) =>
        b.label.toLowerCase().includes(q) ||
        b.adresse.toLowerCase().includes(q) ||
        b.tenantLabel?.toLowerCase().includes(q)
      );
    }
    // Status filter
    if (biensStatusFilter !== 'all') {
      result = result.filter((b) => b.status === biensStatusFilter);
    }
    // Sort
    switch (biensSort) {
      case 'rent-asc': result.sort((a, b) => a.loyer - b.loyer); break;
      case 'rent-desc': result.sort((a, b) => b.loyer - a.loyer); break;
      default: break; // already sorted by recent from API
    }
    return result;
  })();

  const go = (p: NavId) => {
    // V1 — si la cible est cachée par feature flag, on redirige vers dashboard
    const target = NAV.find((n) => n.id === p);
    const blocked = target?.feature && !isEnabled(target.feature);
    setPage(blocked ? 'dashboard' : p);
    setExpandedId(null);
    setSidebarOpen(false);
  };
  const goToContract = (propertyId: string, applicationId?: string) => {
    const returnUrl = encodeURIComponent("/dashboard/owner");
    const url = applicationId
      ? `/properties/${propertyId}/contract?applicationId=${encodeURIComponent(applicationId)}&returnUrl=${returnUrl}`
      : `/properties/${propertyId}/contract?returnUrl=${returnUrl}`;
    router.push(url);
  };

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
    return <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{children}</th>;
  }
  function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <td className={`border-t border-slate-100 px-5 py-4 text-sm ${className}`}>{children}</td>;
  }

  // ── Loading / error ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 pt-16 pb-20 md:ml-60 md:px-8 md:pt-8 md:pb-8">
        {/* Skeleton header */}
        <div className="mb-8">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-2 h-4 w-32 animate-pulse rounded-lg bg-slate-200" />
        </div>
        {/* Skeleton stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-7 w-16 animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-2 h-4 w-20 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
        {/* Skeleton content blocks */}
        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-4 h-5 w-40 animate-pulse rounded-lg bg-slate-200" />
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="mb-3 flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex-1">
                    <div className="h-4 w-28 animate-pulse rounded-lg bg-slate-200" />
                    <div className="mt-1 h-3 w-40 animate-pulse rounded-lg bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">

      {/* ── SIDEBAR BACKDROP (mobile) ──────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-xl transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600"><ShieldCheck className="h-5 w-5 text-white" /></div>
            <div className="flex-1">
              <div className="font-serif text-base font-bold tracking-tight text-slate-950">PatrimoTrust™</div>
              <div className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">Propriétaire</div>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden" aria-label="Fermer le menu">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {[...new Set(NAV.filter(isNavVisible).map((n) => n.group))].map((grp) => (
            <div key={grp} className="mb-5">
              <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{grp}</p>
              {NAV.filter((n) => n.group === grp && isNavVisible(n)).map(({ id, label, Icon, badge }) => {
                const active = page === id;
                if (id === 'profil') {
                  return (
                    <Link key={id} href="/dashboard/owner/profile" onClick={() => setSidebarOpen(false)}
                      className="mb-0.5 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all">
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                    </Link>
                  );
                }
                return (
                  <button key={id} type="button" onClick={() => go(id)}
                    className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all ${
                      active ? 'bg-amber-50 font-medium text-amber-600' : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}>
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {badge && pending > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-600">{pending}</span>
                    )}
                  </button>
                );
              })}
              {grp === 'Mon patrimoine' && (
                <button type="button" onClick={() => go('depot')}
                  className="mt-1 flex w-full items-center gap-3 rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Ajouter un bien</span>
                </button>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/owner/profile" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-xs font-bold text-white hover:opacity-90 transition-opacity">
              {userEmail ? userEmail[0].toUpperCase() : 'P'}
            </Link>
            <div className="min-w-0">
              <Link href="/dashboard/owner/profile" className="block truncate text-xs font-semibold text-slate-900 hover:text-amber-600 transition-colors">{userEmail || 'Propriétaire'}</Link>
              <div className="text-[11px] text-slate-400">Espace sécurisé</div>
            </div>
            <button type="button" onClick={refresh} aria-label="Actualiser" className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <main className="flex-1 px-4 pt-16 pb-20 md:ml-60 md:px-8 md:pt-8 md:pb-8">

        {/* Hamburger mobile */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 shadow-md backdrop-blur-xl md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </button>

        {/* ─ DASHBOARD ─ */}
        {page === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-950">
                  Bonjour{userEmail ? `, ${userEmail.split('@')[0].charAt(0).toUpperCase()}${userEmail.split('@')[0].slice(1)}` : ''}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {biens.length} bien{biens.length !== 1 ? 's' : ''} · {allDossiers.length} candidature{allDossiers.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => go('depot')} className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 md:px-5 md:py-2.5 text-sm font-semibold text-white shadow-md transition-colors"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Ajouter un bien</span></button>
            </div>

            {/* Bandeau financier */}
            <FinancialBanner data={dashData.financial} onNavigate={(t) => go(t as NavId)} />

            {/* Alertes prioritaires */}
            <AlertsPanel alerts={dashData.alerts} onNavigate={(t) => go(t as NavId)} />

            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={<Building2 className="h-5 w-5 text-amber-500" />} value={biens.length} label="Mes biens" bg="bg-amber-50" />
              <StatCard icon={<ClipboardList className="h-5 w-5 text-blue-500" />} value={allDossiers.length} label="Candidatures" bg="bg-blue-50" />
              <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} value={dashData.kpis ? dashData.kpis.activeLeasesCount : '…'} label="Baux actifs" bg="bg-emerald-50" />
              <StatCard icon={<Home className="h-5 w-5 text-teal-500" />} value={dashData.kpis ? `${dashData.kpis.occupiedProperties}/${biens.length}` : '…'} label="Occupés" bg="bg-teal-50" />
              <StatCard icon={<Wallet className="h-5 w-5 text-violet-500" />} value={dashData.financial ? `${dashData.financial.totalExpected.toLocaleString('fr-FR')} €` : '…'} label="Loyers du mois" bg="bg-violet-50" />
              <StatCard icon={<Clock className="h-5 w-5 text-amber-500" />} value={dashData.alerts.length > 0 ? dashData.alerts.length : pending} label="Actions urgentes" bg="bg-amber-50" />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {/* Dernières candidatures */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="font-semibold text-slate-900">Dernières candidatures</div>
                  <button type="button" onClick={() => go('candidatures')} className="text-xs font-semibold text-emerald-600 hover:underline">Voir tout →</button>
                </div>
                {allDossiers.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-2 text-sm text-slate-500">Aucune candidature reçue.</p>
                    <p className="text-xs text-slate-500">Partagez le lien Sésame de vos biens pour commencer.</p>
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
                    <p className="mb-3 text-sm text-slate-500">Aucun bien enregistré.</p>
                    <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer un actif</Btn>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {biens.slice(0, 5).map((b) => (
                      <div key={b.id} className="py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-600" />
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

              {/* Timeline d'activité */}
              <div className="lg:col-span-2">
                <ActivityTimeline events={dashData.recentEvents} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ─ CANDIDATURES ─ */}
        {page === 'candidatures' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-950">Candidatures</h1>
                <p className="mt-1 text-sm text-slate-500">{allDossiers.length} dossier{allDossiers.length !== 1 ? 's' : ''} · Analyse IA activée · Pipeline</p>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100"><Users className="h-6 w-6 text-slate-400" /></div>
                <p className="mb-4 text-slate-500">Aucun bien en portefeuille.</p>
                <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer un bien</Btn>
              </div>
            ) : (
              <ApplicationPipeline
                biens={biens}
                allDossiers={allDossiers}
                onSelectCandidate={(d) => setSelBienId(d.bien_id)}
                onDetailCandidate={(id) => setCandidateDrawerId(id)}
                onViewProperty={(id) => setPropertyModalId(id)}
              />
            )}
          </motion.div>
        )}

        {/* ─ MES BIENS ─ */}
        {page === 'biens' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-950">Mes biens</h1>
                <p className="mt-1 text-sm text-slate-500">{biens.length} bien{biens.length !== 1 ? 's' : ''} en portefeuille</p>
              </div>
              <button onClick={() => go('depot')} className="hidden items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors md:flex"><Plus className="h-4 w-4" /> Ajouter un bien</button>
            </div>

            {/* FAB mobile — Ajouter un bien */}
            <button
              onClick={() => go('depot')}
              className="fixed bottom-28 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg hover:bg-amber-600 active:scale-95 transition-all md:hidden"
              aria-label="Ajouter un bien"
            >
              <Plus className="h-6 w-6" />
            </button>

            <PropertyFilters
              search={biensSearch}
              onSearchChange={setBiensSearch}
              statusFilter={biensStatusFilter}
              onStatusChange={setBiensStatusFilter}
              sort={biensSort}
              onSortChange={setBiensSort}
              view={biensView}
              onViewChange={setBiensView}
            />

            {filteredBiens.length === 0 && biens.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100"><Search className="h-6 w-6 text-slate-400" /></div>
                <p className="mb-2 text-slate-500">Aucun bien ne correspond à vos filtres.</p>
                <button type="button" onClick={() => { setBiensSearch(''); setBiensStatusFilter('all'); }} className="text-sm font-semibold text-amber-500 hover:underline">Réinitialiser les filtres</button>
              </div>
            ) : biens.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100"><Building2 className="h-6 w-6 text-slate-400" /></div>
                <p className="mb-4 text-slate-500">Aucun bien enregistré.</p>
                <Btn variant="amber" onClick={() => go('depot')}><Plus className="h-4 w-4" /> Créer votre premier bien</Btn>
              </div>
            ) : biensView === 'list' ? (
              <PropertyTable
                biens={filteredBiens}
                onViewProperty={(id) => setPropertyModalId(id)}
                onEditProperty={(id) => setEditBienId(id)}
                onDeleteProperty={(id) => setDeleteBienId(id)}
              />
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {filteredBiens.map((b) => {
                  const selTenant = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                  const candCount = allDossiers.filter((d) => d.bien_id === b.id).length;
                  const statusLabel: Record<string, string> = {
                    OCCUPIED: 'Occupé', VACANT: 'Vacant', AVAILABLE: 'Disponible',
                    CANDIDATE_SELECTION: 'En recherche', LEASE_IN_PROGRESS: 'Bail en cours',
                  };
                  const statusColor: Record<string, string> = {
                    OCCUPIED: 'text-emerald-600', VACANT: 'text-red-500', AVAILABLE: 'text-blue-500',
                    CANDIDATE_SELECTION: 'text-amber-600', LEASE_IN_PROGRESS: 'text-amber-500',
                  };
                  return (
                    <div key={b.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md active:scale-[0.98] cursor-pointer" onClick={() => setPropertyModalId(b.id)} role="button" tabIndex={0}>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50"><Building2 className="h-5 w-5 text-amber-500" /></div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${b.status === 'OCCUPIED' ? 'bg-emerald-500' : b.status === 'VACANT' ? 'bg-red-500' : 'bg-amber-500'}`} />
                            <span className={`text-xs font-semibold ${statusColor[b.status || ''] || 'text-slate-500'}`}>
                              {statusLabel[b.status || ''] || b.flowStageLabel || '—'}
                            </span>
                          </div>
                          <PropertyCardMenu
                            bienId={b.id}
                            bienLabel={b.label}
                            onEdit={() => setEditBienId(b.id)}
                            onDelete={() => setDeleteBienId(b.id)}
                          />
                        </div>
                      </div>
                      <div className="font-bold text-slate-950">{b.label}</div>
                      <div className="mt-0.5 mb-3 flex items-center gap-1 text-sm text-slate-500 line-clamp-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />{b.adresse}
                      </div>

                      {/* Property details */}
                      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Loyer</span>
                          <span className="font-semibold text-slate-900">{b.loyer.toLocaleString('fr-FR')} €</span>
                        </div>
                        {b.surface > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Surface</span>
                            <span className="font-semibold text-slate-900">{b.surface} m²</span>
                          </div>
                        )}
                        {b.rooms && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Pièces</span>
                            <span className="font-semibold text-slate-900">{b.rooms}</span>
                          </div>
                        )}
                        {b.floor !== null && b.floor !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Étage</span>
                            <span className="font-semibold text-slate-900">{b.floor === 0 ? 'RDC' : `${b.floor}e`}</span>
                          </div>
                        )}
                      </div>

                      {/* Tenant or vacancy info */}
                      {selTenant || b.tenantLabel ? (
                        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm">
                          <span className="text-slate-500">Locataire · </span>
                          <b className="text-slate-900">{selTenant ? `${selTenant.prenom} ${selTenant.nom}` : b.tenantLabel}</b>
                        </div>
                      ) : b.status === 'VACANT' && b.vacantSince ? (
                        <div className="mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                          Vacant depuis le {new Date(b.vacantSince).toLocaleDateString('fr-FR')}
                        </div>
                      ) : null}

                      {/* Yield if available */}
                      {b.grossYield && (
                        <div className="mb-3 flex items-center gap-1.5 text-sm">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          <span className="text-slate-500">Rentabilité brute :</span>
                          <span className="font-bold text-emerald-600">{b.grossYield}%</span>
                        </div>
                      )}

                      {/* Tags */}
                      <div className="mb-3 flex flex-wrap gap-2">
                        <Tag>{candCount} candidature{candCount !== 1 ? 's' : ''}</Tag>
                      </div>

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
                      <div className="mt-auto flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                        <Btn variant="secondary" className="flex-1 py-2 text-xs" onClick={() => setPropertyModalId(b.id)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Voir la fiche
                        </Btn>
                        {!b.isRented && (() => {
                          const selTenantForBtn = allDossiers.find(d => d.bien_id === b.id && d.statut === 'selectionne');
                          if (selTenantForBtn) {
                            return (
                              <Btn variant="primary" className="flex-1 py-2 text-xs" onClick={() => goToContract(b.id, selTenantForBtn.id)}>
                                <FileSignature className="h-3.5 w-3.5" /> Rédiger le bail
                              </Btn>
                            );
                          }
                          const hasUnlocked = allDossiers.filter(d => d.bien_id === b.id && !d.isSealed).length > 0;
                          if (hasUnlocked) {
                            return (
                              <Btn variant="amber" className="flex-1 py-2 text-xs" onClick={() => setSelBienId(b.id)}>
                                Sélectionner →
                              </Btn>
                            );
                          }
                          return null;
                        })()}
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
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-950">Nouvel actif</h1>
              <p className="mt-1 text-sm text-slate-500">Ajoutez un bien à votre portefeuille PatrimoTrust</p>
            </div>
            <NouvelActifForm onDone={() => { refresh(); go('biens'); }} />
          </motion.div>
        )}

        {/* ─ BAUX ─ */}
        {page === 'baux' && isEnabled('LEASES') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-950">Baux &amp; Signatures</h1>
              <p className="mt-1 text-sm text-slate-500">Suivi des contrats · Renouvellement · Résiliation</p>
            </div>
            <BauxPanel
              properties={biens.map((b) => {
                const selApp = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                return { _id: b.id, name: b.label, address: b.adresse, selectedApplicationId: selApp?.id };
              })}
              onNavigate={(target, id, applicationId) => {
                if (target === 'contract' && id) {
                  goToContract(id, applicationId);
                } else {
                  go(target as NavId);
                }
              }}
            />
          </motion.div>
        )}

        {/* ─ GESTION LOCATIVE ─ */}
        {page === 'gestion' && isEnabled('MANAGEMENT') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-950">Gestion locative</h1>
                <p className="mt-1 text-sm text-slate-500">Suivi des locataires actifs</p>
              </div>
              <Btn variant="primary" className="gap-2" onClick={() => setShowAddManagement(true)}>
                <Plus className="h-4 w-4" /> Ajouter un bien
              </Btn>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon={<Building2 className="h-5 w-5 text-amber-500" />} value={biensGeres.length}   label="Biens en gestion"    bg="bg-amber-50" />
              <StatCard icon={<ClipboardList className="h-5 w-5 text-blue-500" />} value={allDossiers.length}  label="Candidatures totales" bg="bg-blue-50" />
              <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}  value={selectionnes}        label="Locataires actifs"   bg="bg-emerald-50" />
              <StatCard icon={<Clock className="h-5 w-5 text-amber-500" />} value={pending}             label="En attente"          bg="bg-amber-50" />
            </div>
            {biensGeres.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
                <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100"><Building2 className="h-6 w-6 text-slate-400" /></div>
                <p className="font-medium text-slate-700">Aucun bien en gestion active</p>
                <p className="mt-1 text-sm text-slate-500">Ajoutez votre premier bien pour commencer le suivi locatif.</p>
                <button
                  onClick={() => setShowAddManagement(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-amber-600 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Ajouter un bien en gestion
                </button>
              </div>
            ) : (
              <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
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

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {biensGeres.map((entry) => {
                  const b = bienById.get(entry.property.id)!;
                  const selCand = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                  const tenantName = b.tenantLabel || (selCand ? `${selCand.prenom} ${selCand.nom}` : '—');
                  return (
                    <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4 active:scale-[0.98] transition-transform cursor-pointer" onClick={() => setPropertyModalId(b.id)} role="button" tabIndex={0}>
                      <div className="flex items-center gap-3">
                        <Avatar name={tenantName} id={b.id} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900">{tenantName}</div>
                          <div className="truncate text-xs text-slate-500">{b.label}</div>
                        </div>
                        <Tag type="green">{b.isRented ? 'Occupé' : 'En gestion'}</Tag>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-emerald-700">{b.loyer.toLocaleString()} €<span className="text-xs font-normal text-slate-500">/mois</span></span>
                        <Btn variant="ghost" className="py-1.5 text-xs" onClick={() => setPropertyModalId(b.id)}>
                          <ScrollText className="h-3.5 w-3.5" /> Détail →
                        </Btn>
                      </div>
                      {(b.leaseStatusLabel || entry.flow.managementSummary?.summary) && (
                        <p className="mt-2 text-xs text-slate-500 line-clamp-2">{b.leaseStatusLabel || entry.flow.managementSummary?.summary}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </motion.div>
        )}

        {/* ─ LOYERS & QUITTANCES ─ */}
        {page === 'loyers' && isEnabled('RECEIPTS') && <LoyersPanel />}

        {/* ─ ÉTATS DES LIEUX ─ */}
        {page === 'edl' && isEnabled('EDL') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-slate-950">États des lieux</h1>
              <p className="mt-1 text-sm text-slate-500">Entrées &amp; sorties · Pièce par pièce · Compteurs · Comparaison</p>
            </div>
            <EdlPanel />
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
              onGoToContract={goToContract}
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

      {/* ── ADD MANAGEMENT MODAL ──────────────────────────────────── */}
      <AddManagementModal
        open={showAddManagement}
        onClose={() => setShowAddManagement(false)}
        onSuccess={() => { setShowAddManagement(false); refresh(); }}
      />

      {/* ── PROPERTY HUB MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {propertyModalId && (() => {
          const b = bienById.get(propertyModalId);
          if (!b) return null;
          const modalCands = allDossiers.filter((d) => d.bien_id === propertyModalId);
          return (
            <PropertyDetailModal
              key="property-hub"
              bien={b}
              candidats={modalCands}
              allData={data}
              onClose={() => setPropertyModalId(null)}
              onSelectCandidate={(c) => { setPropertyModalId(null); setCandidateDrawerId(c.id); }}
              onOpenTunnel={() => { setPropertyModalId(null); setSelBienId(propertyModalId); }}
              onGoToContract={goToContract}
              onEditProperty={() => { setPropertyModalId(null); setEditBienId(propertyModalId); }}
              onDeleteProperty={() => { setPropertyModalId(null); setDeleteBienId(propertyModalId); }}
            />
          );
        })()}
      </AnimatePresence>

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────────── */}
      <MobileBottomNav page={page} onNavigate={go} />

      {/* ── EDIT / DELETE MODALS ───────────────────────────────────── */}
      <AnimatePresence>
        {editBienId && (() => {
          const b = bienById.get(editBienId);
          if (!b) return null;
          return (
            <PropertyEditModal
              key="edit-modal"
              bien={b}
              onClose={() => setEditBienId(null)}
              onSaved={() => { setEditBienId(null); refresh(); }}
            />
          );
        })()}
        {deleteBienId && (() => {
          const b = bienById.get(deleteBienId);
          if (!b) return null;
          return (
            <PropertyDeleteDialog
              key="delete-dialog"
              bien={b}
              onClose={() => setDeleteBienId(null)}
              onDeleted={() => { setDeleteBienId(null); refresh(); }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
