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
        <Link
          href="/auth/login"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Connexion
        </Link>
      </div>
    </header>
  );
}
