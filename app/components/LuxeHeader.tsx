import Link from "next/link";
import UserMenu from "./UserMenu";

export default function LuxeHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="flex w-full items-center justify-between px-8 py-4">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
              GP
            </div>
            <nav className="flex items-center gap-6">
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
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard-luxe.html"
            className="rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-navy transition hover:border-emerald/60 hover:text-emerald"
          >
            Ajouter un bien
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
