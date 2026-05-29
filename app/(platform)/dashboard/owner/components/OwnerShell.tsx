'use client';

/**
 * <OwnerShell> — Layout client unifié pour toutes les routes /dashboard/owner/*.
 *
 * Avant V7.7, seul OwnerDashboardClient rendait la sidebar. Les routes
 * sœurs (/contracts, /lease/[id], /property/[id], etc.) étaient orphelines :
 * pleine page sans le menu de gauche.
 *
 * Ce shell fournit :
 *   - Sidebar desktop fixe (md:left-0) + overlay mobile (drawer)
 *   - Hamburger mobile + MobileBottomNav
 *   - Padding main correct (md:ml-60) pour éviter le chevauchement
 *
 * NAVIGATION : URL-driven plutôt que SPA pour préserver l'historique
 * et la persistance du chemin :
 *   - 'contrats' / 'profil'  → vraie route Next.js
 *   - autres NAV ids (SPA)   → /dashboard/owner?tab={id}
 *     OwnerDashboardClient lit ce param et active le bon écran.
 *
 * État actif calculé via usePathname() :
 *   - /dashboard/owner          → tab du searchParam (défaut 'dashboard')
 *   - /dashboard/owner/contracts ou /dashboard/owner/lease/* → 'contrats'
 *   - /dashboard/owner/profile  → 'profil'
 *   - /dashboard/owner/property → 'biens'
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Menu, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { isEnabled } from '@/lib/features';
import { NAV, type NavId } from './ui';
import { MobileBottomNav } from './MobileBottomNav';
import { useOwner } from '../OwnerContext';
import { AINotificationCenter } from './AINotificationCenter';

interface OwnerShellProps {
  children: React.ReactNode;
}

export function OwnerShell({ children }: OwnerShellProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, userEmail, refresh } = useOwner();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  // Compteur de candidatures en attente (pour le badge 'candidatures')
  const pending = React.useMemo(() => {
    let count = 0;
    for (const entry of data) {
      for (const cand of (entry.candidatures || []) as Array<{
        isSealed?: boolean;
        isOwnerSelected?: boolean;
      }>) {
        if (!cand.isSealed && !cand.isOwnerSelected) count++;
      }
    }
    return count;
  }, [data]);

  // Détermine l'item actif depuis l'URL
  const activeId: NavId | null = React.useMemo(() => {
    if (pathname.startsWith('/dashboard/owner/contracts')) return 'contrats';
    if (pathname.startsWith('/dashboard/owner/lease')) return 'contrats';
    if (pathname === '/dashboard/owner/profile') return 'profil';
    if (pathname.startsWith('/dashboard/owner/property')) return 'biens';
    // Sur la home dashboard, on lit le ?tab=
    if (pathname === '/dashboard/owner') {
      const t = searchParams.get('tab');
      if (t) return t as NavId;
      return 'dashboard';
    }
    return null;
  }, [pathname, searchParams]);

  // Visibilité des items (feature flag + hidden)
  const isNavVisible = React.useCallback(
    (n: { feature?: string; hidden?: boolean }): boolean => {
      if (n.hidden) return false;
      if (n.feature && !isEnabled(n.feature as any)) return false;
      return true;
    },
    [],
  );

  // Résolution de l'URL cible d'un NavId
  const hrefFor = React.useCallback((id: NavId, explicitHref?: string): string => {
    if (explicitHref) return explicitHref;
    if (id === 'profil') return '/dashboard/owner/profile';
    // SPA tab : on passe par la home avec ?tab=
    return `/dashboard/owner?tab=${id}`;
  }, []);

  const handleNavigate = React.useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* ── SIDEBAR BACKDROP (mobile) ─────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-xl transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-serif text-base font-bold tracking-tight text-slate-950">
                PatrimoTrust™
              </div>
              <div className="mt-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                Propriétaire
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {[...new Set(NAV.filter(isNavVisible).map((n) => n.group))].map((grp) => (
            <div key={grp} className="mb-5">
              <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {grp}
              </p>
              {NAV.filter((n) => n.group === grp && isNavVisible(n)).map(
                ({ id, label, Icon, badge, href }) => {
                  const active = activeId === id;
                  const target = hrefFor(id, href);
                  return (
                    <Link
                      key={id}
                      href={target}
                      onClick={handleNavigate}
                      className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all ${
                        active
                          ? 'bg-amber-50 font-medium text-amber-600'
                          : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-left">{label}</span>
                      {badge && pending > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                          {pending}
                        </span>
                      )}
                    </Link>
                  );
                },
              )}
              {grp === 'Mon patrimoine' && (
                <Link
                  href="/dashboard/owner?tab=depot"
                  onClick={handleNavigate}
                  className="mt-1 flex w-full items-center gap-3 rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Ajouter un bien</span>
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/owner/profile"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-xs font-bold text-white hover:opacity-90 transition-opacity"
            >
              {userEmail ? userEmail[0].toUpperCase() : 'P'}
            </Link>
            <div className="min-w-0">
              <Link
                href="/dashboard/owner/profile"
                className="block truncate text-xs font-semibold text-slate-900 hover:text-amber-600 transition-colors"
              >
                {userEmail || 'Propriétaire'}
              </Link>
              <div className="text-[11px] text-slate-400">Espace sécurisé</div>
            </div>
            {/* V7.8 — Centre de notifications IA (Bell + popover) */}
            <div className="ml-auto flex items-center gap-1">
              <AINotificationCenter popoverAnchor="right" size="sm" />
              <button
                type="button"
                onClick={() => {
                  void refresh();
                }}
                aria-label="Actualiser"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────── */}
      <main className="relative flex-1 ml-0 md:ml-60">
        {/* Hamburger mobile */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 shadow-md backdrop-blur-xl md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5 text-slate-700" />
        </button>

        {children}
      </main>

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────── */}
      <MobileBottomNav
        page={(activeId ?? 'dashboard') as NavId}
        onNavigate={(id) => {
          const item = NAV.find((n) => n.id === id);
          router.push(hrefFor(id, item?.href));
        }}
      />
    </div>
  );
}
