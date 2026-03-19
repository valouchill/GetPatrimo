import Link from "next/link";
import UserMenu from "./UserMenu";

export default function LuxeHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex items-center gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
              GP
            </div>
            <nav className="hidden items-center gap-6 md:flex">
              <Link
                href="/patrimoine"
                className="text-xs uppercase tracking-widest text-slate-500 transition hover:text-navy"
              >
                PATRIMOINE
              </Link>
              <Link
                href="/messages"
                className="text-xs uppercase tracking-widest text-slate-500 transition hover:text-navy"
              >
                MESSAGES
              </Link>
              <Link
                href="/documents"
                className="text-xs uppercase tracking-widest text-slate-500 transition hover:text-navy"
              >
                DOCUMENTS
              </Link>
            </nav>
          </div>
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
          <Link
            href="/dashboard-luxe.html"
            className="rounded-full border border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-navy transition hover:border-emerald/60 hover:text-emerald sm:px-5 sm:text-xs sm:tracking-widest"
          >
            <span className="sm:hidden">Ajouter</span>
            <span className="hidden sm:inline">Ajouter un bien</span>
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
