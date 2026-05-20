'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Building2, Users, Wallet, MoreHorizontal, FileSignature, ClipboardCheck, UserCog, X } from 'lucide-react';
import { isEnabled, type FeatureKey } from '@/lib/features';
import type { NavId } from './ui';

type Tab = { id: NavId; label: string; Icon: React.ElementType; feature?: FeatureKey };

const ALL_PRIMARY: Tab[] = [
  { id: 'dashboard',    label: 'Accueil',        Icon: LayoutDashboard },
  { id: 'biens',        label: 'Biens',          Icon: Building2 },
  { id: 'candidatures', label: 'Candidatures',   Icon: Users },
  { id: 'loyers',       label: 'Loyers',         Icon: Wallet,         feature: 'RECEIPTS' },
  { id: 'profil',       label: 'Mon profil',     Icon: UserCog },
];

const ALL_MORE: Tab[] = [
  { id: 'baux',   label: 'Baux & Signatures', Icon: FileSignature,    feature: 'LEASES' },
  { id: 'edl',    label: 'États des lieux',   Icon: ClipboardCheck,   feature: 'EDL' },
  { id: 'profil', label: 'Mon profil',        Icon: UserCog },
];

const isTabVisible = (t: Tab) => !t.feature || isEnabled(t.feature);

// V1 : si certains primary tabs sont cachés, on complète avec d'autres tabs visibles (profil, biens…) pour garder 4 onglets max.
const PRIMARY_TABS: Tab[] = ALL_PRIMARY.filter(isTabVisible).slice(0, 4);

// MORE_TABS ne garde que les tabs visibles ET qui ne sont pas déjà dans PRIMARY.
const primaryIds = new Set(PRIMARY_TABS.map((t) => t.id));
const MORE_TABS: Tab[] = ALL_MORE.filter((t) => isTabVisible(t) && !primaryIds.has(t.id));

interface MobileBottomNavProps {
  page: NavId;
  onNavigate: (id: NavId) => void;
}

export function MobileBottomNav({ page, onNavigate }: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_TABS.some((t) => t.id === page);
  const hasMore = MORE_TABS.length > 0;

  return (
    <>
      {/* Bottom sheet "Plus" */}
      <AnimatePresence>
        {moreOpen && hasMore && (
          <>
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm md:hidden"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              key="more-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[61] rounded-t-2xl border-t border-slate-200 bg-white pb-safe md:hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <span className="text-sm font-semibold text-slate-900">Plus</span>
                <button type="button" onClick={() => setMoreOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Fermer">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-3 py-3">
                {MORE_TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { onNavigate(id); setMoreOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors ${
                      page === id ? 'bg-amber-50 text-amber-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Tab Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-slate-200 bg-white/95 backdrop-blur-xl pb-safe md:hidden">
        {PRIMARY_TABS.map(({ id, label, Icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                active ? 'text-primary' : 'text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </button>
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
              isMoreActive ? 'text-primary' : 'text-slate-400'
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-tight">Plus</span>
          </button>
        )}
      </nav>
    </>
  );
}
