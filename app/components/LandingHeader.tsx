'use client';

import Link from 'next/link';

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-slate-50/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white text-sm font-bold">
            PT
          </div>
          <span className="font-serif text-lg font-semibold text-slate-900 tracking-tight">
            PatrimoTrust™
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-slate-600 hover:text-amber-500 transition-colors">
            Comment ça marche
          </a>
          <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-amber-500 transition-colors">
            Tarifs
          </a>
          <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Connexion
          </Link>
          <Link
            href="/auth/register"
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-md transition-colors"
          >
            Essai gratuit →
          </Link>
        </nav>

        <Link
          href="/auth/login"
          className="md:hidden text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Connexion
        </Link>
      </div>
    </header>
  );
}
