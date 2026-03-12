'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ChevronDown, Building2, Plus, LogOut, Moon, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOwner } from './OwnerContext';
import FastOnboardingForm from '@/app/components/FastOnboardingForm';

export default function OwnerHeader() {
  const { data, activeEntry, setActivePropertyId, userEmail, refresh } = useOwner();
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const activeEntries = data.filter((e) => !e.property.archived);
  const archivedEntries = data.filter((e) => e.property.archived);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const property = activeEntry?.property;
  const initial = userEmail ? userEmail[0].toUpperCase() : 'P';

  const navLinks = [
    { label: "Vue d'ensemble", href: '/dashboard/owner' },
    { label: 'Coffre-Fort', href: '/dashboard/owner/vault' },
  ];

  return (
    <>
    <AddPropertyPortal
      open={addModalOpen}
      onClose={() => setAddModalOpen(false)}
      onSuccess={() => { setAddModalOpen(false); refresh(); }}
    />
    <header className="h-16 sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-8">
      {/* ─── Zone Gauche : Property Switcher ─── */}
      <div className="relative" ref={switcherRef}>
        <button
          onClick={() => setSwitcherOpen((o) => !o)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800 max-w-[200px] truncate hidden sm:inline">
            {property?.address || property?.title || 'Aucun bien'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${switcherOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {switcherOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50"
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Mes actifs
                </p>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {activeEntries.map((entry) => (
                  <button
                    key={entry.property.id}
                    onClick={() => {
                      setActivePropertyId(entry.property.id);
                      setSwitcherOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      entry.property.id === property?.id
                        ? 'bg-emerald-50 text-emerald-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0 bg-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {entry.property.address || entry.property.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {entry.candidatures.length} dossier{entry.candidatures.length !== 1 ? 's' : ''}
                        {entry.property.rent ? ` · ${entry.property.rent} €` : ''}
                      </p>
                    </div>
                  </button>
                ))}

                {archivedEntries.length > 0 && (
                  <>
                    <div className="px-3 py-2 border-t border-slate-100">
                      <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                        <Moon className="w-3 h-3" /> Actifs archivés
                      </p>
                    </div>
                    {archivedEntries.map((entry) => (
                      <button
                        key={entry.property.id}
                        onClick={() => {
                          setActivePropertyId(entry.property.id);
                          setSwitcherOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors opacity-50 ${
                          entry.property.id === property?.id
                            ? 'bg-slate-100 text-slate-600'
                            : 'hover:bg-slate-50 text-slate-400'
                        }`}
                      >
                        <div className="w-2 h-2 rounded-full shrink-0 bg-slate-300" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {entry.property.address || entry.property.title}
                          </p>
                          <p className="text-xs text-slate-300">
                            En sommeil
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => { setSwitcherOpen(false); setAddModalOpen(true); }}
                className="w-full flex items-center gap-2 px-4 py-3 border-t border-slate-100 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter un nouvel actif
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Zone Centre : Navigation ─── */}
      <nav className="flex items-center gap-1">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* ─── Zone Droite : Avatar + Logout ─── */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/owner/profile"
          className="w-9 h-9 rounded-full bg-emerald-900 flex items-center justify-center hover:ring-2 hover:ring-emerald-400/50 transition-all"
        >
          <span className="text-amber-500 font-serif text-sm font-bold">{initial}</span>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title="Déconnexion"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

    </header>
    </>
  );
}

function AddPropertyPortal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800" style={{ fontFamily: "'Playfair Display', serif" }}>
                Nouvel actif
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <FastOnboardingForm
                compact
                onSuccess={onSuccess}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
