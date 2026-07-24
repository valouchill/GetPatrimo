'use client';

import { useCallback, useEffect, useState } from 'react';
import { Logo } from '@/app/components/Logo';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, ClipboardList, Clock, Copy, Download, ExternalLink, FileSignature, FileText, Home, Lock, MapPin, Menu, Plus, RefreshCw, ScrollText, Search, ShieldCheck, TrendingUp, Users, Wallet, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
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
import { CandidateAuditModal } from './components/CandidateAuditModal';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { PropertyCardMenu } from './components/PropertyCardMenu';
import { AINotificationCenter } from './components/AINotificationCenter';
import { useNotifications } from './NotificationsContext';
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
import { OwnerCandidatesStack } from './components/OwnerCandidatesStack';
import { PropertiesPortfolio, type PortfolioAsset, type AssetStatus } from '@/app/components/audit';
import { PricingTiers } from '../../pricing/PricingTiers';
import { ProOfferPanel } from '../../pricing/ProOfferPanel';
import { BauxPanel } from './components/BauxPanel';
import { EdlPanel } from './components/EdlPanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { TopCandidateCard } from './components/TopCandidateCard';
import { DashboardEmptyState } from './components/DashboardEmptyState';
import { PendingPropertiesStrip } from './components/PendingPropertiesStrip';
import { SectionHeader } from '@/app/components/ui';

export default function OwnerDashboardClient() {
  const router = useRouter();
  const { data, loading, userEmail, refresh } = useOwner();
  // V7.9 — Alerte forensic non lue -> badge NAV rouge (priorite sur pending)
  const { hasUnreadAlert } = useNotifications();
  // V7.7 — Lit `?tab=` pour determiner l'onglet initial (declenche par
  // les Liens du OwnerShell qui navigue /dashboard/owner?tab={id}).
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') as NavId | null;
  const [page, setPage] = useState<NavId>(tabParam || 'dashboard');
  useEffect(() => {
    if (tabParam && tabParam !== page) setPage(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  // Retour de paiement Stripe : la Property est activée par le webhook, qui peut
  // arriver juste après le redirect. On rafraîchit une fois en léger différé pour
  // afficher l'offre + le quota à jour sur la carte du bien.
  const checkoutSuccess = searchParams?.get('checkout') === 'success';
  useEffect(() => {
    if (!checkoutSuccess) return;
    const t = setTimeout(() => { refresh(); }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutSuccess]);
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
  // Bouton « Console d'administration » dans la sidebar pour les comptes admin.
  const { data: session } = useSession();
  const isAdminAccount = ['admin', 'superadmin'].includes(
    String((session?.user as { role?: string } | undefined)?.role || ''),
  );
  const [selectionOverrides, setSelectionOverrides] = useState<Record<string, string>>({});

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
    freeTrial?: { used: number; limit: number } | null;
    pilotPendingAudits?: number;
    accountType?: 'B2C' | 'B2B';
    hasPaidProperty?: boolean;
  }>({ financial: null, kpis: null, alerts: [], recentEvents: [], freeTrial: null, hasPaidProperty: false });

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
    e.candidatures.map((c) => {
      const dossier = toDossier(c, e.property.id, e.property.rent || 0);
      const selectedId = selectionOverrides[e.property.id];
      if (!selectedId) return dossier;
      return {
        ...dossier,
        statut: dossier.id === selectedId ? 'selectionne' : 'en_attente',
      };
    })
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dépendances volontairement limitées (chargement au montage / sur changement ciblé)
  const goToContract = (propertyId: string, applicationId?: string) => {
    // V7.2 — Le module de contractualisation est maintenant la page
    // /dashboard/owner/lease/[applicationId] (cf. PR #62). L'ancienne
    // route /properties/[id]/contract n'existe plus en prod.
    // Si applicationId absent (cas hypothétique), on retombe sur la page
    // bien (l'owner pourra cliquer "Reprendre la préparation du bail" depuis là).
    if (applicationId) {
      router.push(`/dashboard/owner/lease/${applicationId}`);
    } else {
      router.push(`/dashboard/owner/property/${propertyId}?tab=selected`);
    }
  };

  const syncSelectionMemory = useCallback((propertyId: string, applicationId: string) => {
    setSelectionOverrides((prev) => ({
      ...prev,
      [propertyId]: applicationId,
    }));
  }, []);

  const acceptCandidate = useCallback(
    async (candidate: LocalDossier, options: { goToLease?: boolean } = {}) => {
      const previousSelection = selectionOverrides[candidate.bien_id];
      syncSelectionMemory(candidate.bien_id, candidate.id);

      try {
        const res = await fetch(`/api/owner/properties/${candidate.bien_id}/selection`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: candidate.id }),
        });
        const selectionData = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(selectionData.error || 'Impossible de sélectionner ce dossier.');
        }
        await refresh();
        router.refresh();
        if (options.goToLease) {
          if (selectionData.leaseHref) {
            router.push(selectionData.leaseHref);
          } else {
            goToContract(candidate.bien_id, candidate.id);
          }
        }
      } catch (error) {
        setSelectionOverrides((prev) => {
          const next = { ...prev };
          if (previousSelection) next[candidate.bien_id] = previousSelection;
          else delete next[candidate.bien_id];
          return next;
        });
        throw error;
      }
    },
    [goToContract, refresh, router, selectionOverrides, syncSelectionMemory],
  );

  const unselectCandidate = useCallback(
    async (candidate: LocalDossier) => {
      const previousSelection = selectionOverrides[candidate.bien_id] || candidate.id;
      setSelectionOverrides((prev) => {
        const next = { ...prev };
        delete next[candidate.bien_id];
        return next;
      });

      try {
        const res = await fetch(`/api/owner/properties/${candidate.bien_id}/selection`, {
          method: 'DELETE',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Impossible de retirer la sélection.');
        }
        await refresh();
        router.refresh();
      } catch (error) {
        setSelectionOverrides((prev) => ({
          ...prev,
          [candidate.bien_id]: previousSelection,
        }));
        throw error;
      }
    },
    [refresh, router, selectionOverrides],
  );

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

  // overflow-x-clip + min-w-0 (main) : sans eux, tout enfant plus large que
  // l'écran étire la page sur mobile (défilement horizontal, contenu rogné,
  // drawer hors-écran qui réapparaît).
  return (
    <div className="flex min-h-screen overflow-x-clip bg-slate-50 font-sans">

      {/* ── SIDEBAR BACKDROP (mobile) ──────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-slate-200 bg-white/95 shadow-xl backdrop-blur-xl transition-transform duration-300 [height:100dvh] md:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Logo variant="light" className="text-lg" />
              <div className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">Propriétaire</div>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden" aria-label="Fermer le menu">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {[...new Set(NAV.filter(isNavVisible).map((n) => n.group))].map((grp) => (
            <div key={grp} className="mb-5">
              <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{grp}</p>
              {NAV.filter((n) => n.group === grp && isNavVisible(n)).map(({ id, label: navLabel, Icon, badge, href }) => {
                // Compte B2B : l'onglet tarifs devient « Mon offre Pro » (les
                // offres B2C ne sont jamais montrées à un compte pro).
                const label = id === 'tarifs' && dashData.accountType === 'B2B' ? 'Mon offre Pro' : navLabel;
                const active = page === id;
                // V7.4 — Entrées avec href (route réelle Next.js) rendues
                // comme <Link>, distinctes du dispatcher SPA `go(id)`.
                // 'profil' a son href hardcodé pour rétrocompat (avant V7.4).
                const resolvedHref = href ?? (id === 'profil' ? '/dashboard/owner/profile' : null);
                if (resolvedHref) {
                  return (
                    <Link
                      key={id}
                      href={resolvedHref}
                      onClick={() => setSidebarOpen(false)}
                      className="mb-0.5 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all"
                    >
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
                    {/* V7.9 — Rouge si alerte forensic non lue */}
                    {badge && (pending > 0 || hasUnreadAlert) && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          hasUnreadAlert
                            ? 'bg-red-100 text-red-600'
                            : 'bg-amber-100 text-amber-600'
                        }`}
                        title={
                          hasUnreadAlert
                            ? 'Alertes Forensic en attente'
                            : `${pending} candidature${pending > 1 ? 's' : ''} en attente`
                        }
                      >
                        {hasUnreadAlert ? '!' : pending}
                      </span>
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
          {isAdminAccount && (
            <Link
              href="/dashboard/admin"
              className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-900"
            >
              <ShieldCheck className="h-4 w-4 text-amber-400" aria-hidden="true" />
              Console d&rsquo;administration
            </Link>
          )}
          <div className="flex items-center gap-3">
            <Link href="/dashboard/owner/profile" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-xs font-bold text-white hover:opacity-90 transition-opacity">
              {userEmail ? userEmail[0].toUpperCase() : 'P'}
            </Link>
            <div className="min-w-0">
              <Link href="/dashboard/owner/profile" className="block truncate text-xs font-semibold text-slate-900 hover:text-amber-600 transition-colors">{userEmail || 'Propriétaire'}</Link>
              <div className="text-[11px] text-slate-400">Espace sécurisé</div>
            </div>
            {/* V7.8 — Centre de notifications IA (Bell + popover) */}
            <div className="ml-auto flex items-center gap-1">
              <AINotificationCenter popoverAnchor="right" size="sm" />
              <button type="button" onClick={refresh} aria-label="Actualiser" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1 px-4 pt-16 pb-20 md:ml-60 md:px-8 md:pt-8 md:pb-8">

        {/* Barre supérieure mobile : marque + burger (remplace l'ancien bouton
            flottant seul, peu lisible). Sous le backdrop (z-30 < z-40) pour
            disparaître proprement quand le drawer est ouvert. */}
        <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xl md:hidden">
          <Logo variant="light" className="text-base" />
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Pilote B2B : audits offerts en attente du premier bien — prioritaire
            sur la bannière d'essai gratuit (l'invité a reçu « 10 audits offerts »
            par email, il ne doit PAS voir « 1 audit » à sa première connexion). */}
        {(dashData.pilotPendingAudits ?? 0) > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-900">
              🎁 <strong>{dashData.pilotPendingAudits} audits forensic offerts</strong> vous
              attendent — ajoutez votre premier bien pour les activer (comparaison des candidats
              incluse).
            </p>
            <button
              type="button"
              onClick={() => go('depot')}
              className="shrink-0 rounded-lg bg-emerald-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
            >
              Ajouter mon premier bien
            </button>
          </div>
        )}

        {/* Essai gratuit (compte) — tant qu'aucune offre payante n'est souscrite */}
        {!(dashData.pilotPendingAudits ?? 0) && dashData.freeTrial && !dashData.hasPaidProperty && (() => {
          const { used, limit } = dashData.freeTrial;
          const left = Math.max(0, limit - used);
          return (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900">
                <strong>Essai gratuit</strong> — {Math.min(used, limit)}/{limit} audit{limit > 1 ? 's' : ''} forensic utilisé{limit > 1 ? 's' : ''} sur votre compte.{' '}
                {left > 0
                  ? `${left} restant${left > 1 ? 's' : ''}.`
                  : 'Essai épuisé — débloquez de nouveaux audits dès 19,90 €.'}
              </p>
              <button
                type="button"
                onClick={() => go('tarifs')}
                className="shrink-0 rounded-lg bg-emerald-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
              >
                Voir les offres
              </button>
            </div>
          );
        })()}

        {/* ─ DASHBOARD ─ V1.6 refonte orientée analyse candidat */}
        {page === 'dashboard' && (() => {
          // Top 3 candidats par score (non scellés)
          const top3 = [...allDossiers]
            .filter((d) => !d.isSealed)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 3);

          // Biens en attente (aucune candidature active)
          const pendingBiens = biens.filter(
            (b) => allDossiers.filter((d) => d.bien_id === b.id).length === 0,
          );

          // Score moyen du portefeuille
          const scoresWithValue = allDossiers.map((d) => d.score || 0).filter((s) => s > 0);
          const avgScore = scoresWithValue.length > 0
            ? Math.round(scoresWithValue.reduce((sum, s) => sum + s, 0) / scoresWithValue.length)
            : null;

          return (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="font-serif text-2xl md:text-3xl font-bold text-emerald-900">
                    Bonjour{userEmail ? `, ${userEmail.split('@')[0].charAt(0).toUpperCase()}${userEmail.split('@')[0].slice(1)}` : ''}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {biens.length} bien{biens.length !== 1 ? 's' : ''} · {allDossiers.length} candidature{allDossiers.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => go('depot')} className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-2 md:px-5 md:py-2.5 text-sm font-semibold text-white shadow-md transition-colors">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Ajouter un bien</span>
                </button>
              </div>

              {/* Hero : empty state ou Top 3 candidats */}
              {allDossiers.length === 0 ? (
                <DashboardEmptyState
                  biens={biens}
                  onAddBien={() => go('depot')}
                  onOpenBien={(id) => setPropertyModalId(id)}
                />
              ) : (
                <section>
                  <SectionHeader
                    eyebrow="Analyse IA"
                    title="Vos meilleurs candidats"
                    description="Triés par Indice de Résilience, mis à jour à chaque nouvelle analyse."
                    actions={
                      allDossiers.length > 3 ? (
                        <button
                          type="button"
                          onClick={() => go('candidatures')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Voir les {allDossiers.length} candidats →
                        </button>
                      ) : undefined
                    }
                    className="mb-4"
                  />
                  <div className="grid gap-4 md:grid-cols-3">
                    {top3.map((d, i) => (
                      <TopCandidateCard
                        key={d.id}
                        rank={(i + 1) as 1 | 2 | 3}
                        candidate={d}
                        bien={bienById.get(d.bien_id)}
                        onOpenAudit={(c) => setCandidateDrawerId(c.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 3 KPI minimalistes */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  icon={<Building2 className="h-5 w-5 text-amber-600" />}
                  value={biens.length}
                  label="Mes biens"
                  bg="bg-amber-50"
                />
                <StatCard
                  icon={<ClipboardList className="h-5 w-5 text-emerald-600" />}
                  value={allDossiers.length}
                  label="Candidatures"
                  bg="bg-emerald-50"
                />
                <StatCard
                  icon={<TrendingUp className="h-5 w-5 text-emerald-700" />}
                  value={avgScore !== null ? `${avgScore}/100` : '—'}
                  label="Score moyen"
                  bg="bg-emerald-50"
                />
              </div>

              {/* Biens en attente — compact, masqué si empty state global */}
              {allDossiers.length > 0 && pendingBiens.length > 0 && (
                <PendingPropertiesStrip
                  biens={pendingBiens}
                  maxVisible={3}
                  onOpenBien={(id) => setPropertyModalId(id)}
                  onViewAllBiens={pendingBiens.length > 3 ? () => go('biens') : undefined}
                />
              )}
            </motion.div>
          );
        })()}

        {/* ─ CANDIDATURES (workflow Tinder-like via OwnerCandidatesStack) ─ */}
        {page === 'candidatures' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl font-bold text-emerald-900">
                  Candidatures
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {allDossiers.filter((d) => !d.isSealed).length} dossier
                  {allDossiers.filter((d) => !d.isSealed).length !== 1 ? 's' : ''}{' '}
                  à examiner · Workflow de décision rapide
                </p>
              </div>
            </div>

            {data.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100">
                  <Users className="h-6 w-6 text-slate-400" />
                </div>
                <p className="mb-4 text-slate-500">Aucun bien en portefeuille.</p>
                <Btn variant="amber" onClick={() => go('depot')}>
                  <Plus className="h-4 w-4" /> Créer un bien
                </Btn>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <OwnerCandidatesStack
                  biens={biens}
                  candidats={allDossiers}
                  onAccept={(d) => acceptCandidate(d, { goToLease: true })}
                  /* V8.2 (Mission 3) — clic carte → modale centrale à onglets
                     (CandidateAuditModal via candidateDrawerId), pas le Sheet */
                  onOpenDetail={(id) => setCandidateDrawerId(id)}
                />
              </div>
            )}
          </motion.div>
        )}

        {/* ─ MES BIENS ─ */}
        {page === 'biens' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {checkoutSuccess && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                <span aria-hidden="true">✓</span>
                Paiement reçu — votre offre s’active à l’instant. Le quota d’analyses IA de
                votre bien apparaît sur sa carte ci-dessous.
              </div>
            )}
            {/* V5.5 — Vue "Portefeuille d'Actifs" Banque Privée.
                Remplace l'ancien design tableau + grille mixte par un seul
                composant <PropertiesPortfolio> cohérent avec le reste de l'UI
                Trust Premium (PR #41). */}
            <PropertiesPortfolio
              assets={biens.map((b): PortfolioAsset => {
                const pending = allDossiers.filter(
                  (d) => d.bien_id === b.id && !d.isSealed && d.statut === 'en_attente',
                ).length;
                const selected = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                const hasSelection = Boolean(selected || b.selectedCandidateId || b.acceptedTenantId);
                const status: AssetStatus = b.isRented
                  ? 'sealed'
                  : hasSelection
                  ? 'pending'
                  : b.status === 'VACANT'
                  ? 'vacant'
                  : b.status === 'CANDIDATE_SELECTION' || pending > 0
                  ? 'searching'
                  : 'searching';
                const statusLabel: Record<AssetStatus, string> = {
                  sealed: 'Sous scellé (Loué)',
                  searching: 'En recherche',
                  vacant: 'Vacant',
                  pending: 'En attente',
                };
                const sesameLink = b.applyToken
                  ? `${typeof window !== 'undefined' ? window.location.origin : 'https://maisonpatrimo.com'}/apply/${b.applyToken}`
                  : '';
                return {
                  id: b.id,
                  title: b.label,
                  address: b.adresse,
                  rent: b.loyer,
                  status,
                  statusLabel: hasSelection ? 'Locataire retenu' : b.leaseStatusLabel || statusLabel[status],
                  pendingApplications: pending,
                  sesameLink,
                  tier: b.tier,
                  dossiersQuota: b.dossiersQuota,
                  dossiersAnalyzedCount: b.dossiersAnalyzedCount,
                };
              })}
              onAdd={() => go('depot')}
              onManage={(id) => setPropertyModalId(id)}
            />

          </motion.div>
        )}

        {/* ─ TARIFS & OFFRES (onglet interne → menu latéral conservé) ─
            Compte B2B : vue « Mon offre Pro » (forfait + grille pro + contact),
            JAMAIS les offres B2C. */}
        {page === 'tarifs' && dashData.accountType === 'B2B' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <ProOfferPanel
              quotaTotal={biens.reduce((s, b) => s + (b.dossiersQuota || 0), 0)}
              consumed={biens.reduce((s, b) => s + (b.dossiersAnalyzedCount || 0), 0)}
            />
          </motion.div>
        )}
        {page === 'tarifs' && dashData.accountType !== 'B2B' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <PricingTiers
              variant="embedded"
              authenticated
              properties={biens.map((b) => ({
                id: b.id,
                label: b.label,
                tier: b.tier,
                dossiersQuota: b.dossiersQuota,
                dossiersAnalyzedCount: b.dossiersAnalyzedCount,
              }))}
            />
          </motion.div>
        )}

        {/* ─ NOUVEL ACTIF ─ */}
        {page === 'depot' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-8">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-emerald-900">Nouvel actif</h1>
              <p className="mt-1 text-sm text-slate-500">Ajoutez un bien à votre portefeuille Maison Patrimo</p>
            </div>
            <NouvelActifForm onDone={() => { refresh(); go('biens'); }} />
          </motion.div>
        )}

        {/* ─ BAUX ─ */}
        {page === 'baux' && isEnabled('LEASES') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-6">
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-emerald-900">Baux &amp; Signatures</h1>
              <p className="mt-1 text-sm text-slate-500">Suivi des contrats · Renouvellement · Résiliation</p>
            </div>
            <BauxPanel
              properties={biens.map((b) => {
                const selApp = allDossiers.find((d) => d.bien_id === b.id && d.statut === 'selectionne');
                return {
                  _id: b.id,
                  name: b.label,
                  address: b.adresse,
                  selectedApplicationId: selApp?.id || b.selectedCandidateId || b.acceptedTenantId || undefined,
                  selectedCandidateName: selApp ? `${selApp.prenom} ${selApp.nom}`.trim() : undefined,
                };
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
                <h1 className="font-serif text-2xl md:text-3xl font-bold text-emerald-900">Gestion locative</h1>
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
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-emerald-900">États des lieux</h1>
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
              onConfirmed={async (candidate) => {
                syncSelectionMemory(candidate.bien_id, candidate.id);
                await refresh();
                router.refresh();
              }}
              onGoToContract={goToContract}
              /* V8.3 (audit M1) — clic carte dans le tunnel → modale centrale */
              onOpenDetail={(id) => setCandidateDrawerId(id)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CANDIDATE AUDIT MODAL (centered) ──────────────────────── */}
      {candidateDrawerId && (() => {
        const c = allDossiers.find((d) => d.id === candidateDrawerId);
        const b = c ? bienById.get(c.bien_id) : null;
        if (!c || !b) return null;
        return (
          <CandidateAuditModal
            key="candidate-audit-modal"
            open={true}
            candidate={c}
            bien={b}
            onClose={() => setCandidateDrawerId(null)}
            onSelect={async (cd) => {
              await acceptCandidate(cd, { goToLease: true });
              setCandidateDrawerId(null);
            }}
            onUnselect={async (cd) => {
              await unselectCandidate(cd);
              setCandidateDrawerId(null);
            }}
            onResumeLease={(cd) => {
              setCandidateDrawerId(null);
              goToContract(cd.bien_id, cd.id);
            }}
            onOpenAudit={(cd) => {
              setCandidateDrawerId(null);
              router.push(`/dashboard/owner/property/${cd.bien_id}/candidate/${cd.id}`);
            }}
          />
        );
      })()}

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
