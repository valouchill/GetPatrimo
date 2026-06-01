'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Fonctionnalités', href: '#features' },
  { label: 'Sécurité', href: '#securite' },
  { label: 'Tarifs', href: '#pricing' },
];

export default function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-slate-50/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-900">
            <ShieldCheck className="h-5 w-5 text-amber-400" aria-hidden="true" />
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight text-emerald-900">
            PatrimoTrust™
          </span>
        </Link>

        {/* Liens centraux (desktop) */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-amber-600"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* CTA (desktop) */}
        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-emerald-900"
          >
            Se connecter
          </Link>
          <Link
            href="/auth/register"
            className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-800"
          >
            Créer mon lien gratuit
          </Link>
        </div>

        {/* Burger (mobile) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 md:hidden"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Menu mobile déroulant */}
      {open && (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-white hover:text-emerald-900"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4">
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300"
            >
              Se connecter
            </Link>
            <Link
              href="/auth/register"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-emerald-900 px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
            >
              Créer mon lien gratuit
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
