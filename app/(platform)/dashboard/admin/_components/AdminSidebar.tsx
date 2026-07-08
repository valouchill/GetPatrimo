'use client';

/**
 * AdminSidebar — navigation de la console d'administration.
 * Desktop : sidebar sombre (DA de la marque, émeraude/or) sticky, nav groupée
 * par sections. Mobile : barre supérieure sticky avec nav horizontale
 * défilante (il n'y avait AUCUNE nav admin sous lg auparavant).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  superadminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: 'Pilotage',
    items: [
      { href: '/dashboard/admin', label: 'Vue d’ensemble', icon: '📊' },
      { href: '/dashboard/admin/cockpit', label: 'Cockpit', icon: '🚀', superadminOnly: true },
      { href: '/dashboard/admin/pilots', label: 'Pilotes B2B', icon: '🤝', superadminOnly: true },
    ],
  },
  {
    title: 'Données',
    items: [
      { href: '/dashboard/admin/users', label: 'Utilisateurs', icon: '👥' },
      { href: '/dashboard/admin/properties', label: 'Biens', icon: '🏠' },
      { href: '/dashboard/admin/applications', label: 'Candidatures', icon: '📥' },
      { href: '/dashboard/admin/leases', label: 'Baux', icon: '📄' },
      { href: '/dashboard/admin/payments', label: 'Paiements', icon: '💶' },
    ],
  },
  {
    title: 'Conformité',
    items: [
      { href: '/dashboard/admin/verifications', label: 'KYC Didit', icon: '🪪' },
      { href: '/dashboard/admin/audit', label: 'Journal d’audit', icon: '📜' },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  return href === '/dashboard/admin' ? pathname === href : !!pathname?.startsWith(href);
}

export default function AdminSidebar({
  role,
  email,
}: {
  role: 'admin' | 'superadmin';
  email: string;
}) {
  const pathname = usePathname();
  const visibleSections = SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.superadminOnly || role === 'superadmin'),
  })).filter((s) => s.items.length > 0);

  return (
    <>
      {/* ===== Desktop : sidebar sombre sticky ===== */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-emerald-950 lg:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/dashboard/admin" className="block">
            <span className="font-serif text-lg font-bold text-white">Maison Patrimo</span>
            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400">
              Console d’administration
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/50">
                {section.title}
              </p>
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-emerald-800/80 font-semibold text-white shadow-[inset_2px_0_0_0] shadow-amber-400'
                        : 'text-emerald-100/70 hover:bg-emerald-900 hover:text-white'
                    }`}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-emerald-100/80" title={email}>
              {email}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                role === 'superadmin'
                  ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30'
                  : 'bg-white/10 text-emerald-100 ring-1 ring-white/15'
              }`}
            >
              {role}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <Link href="/" className="text-emerald-200/60 transition-colors hover:text-white">
              ← Site
            </Link>
            <Link
              href="/dashboard/owner"
              className="text-emerald-200/60 transition-colors hover:text-white"
            >
              Dashboard propriétaire
            </Link>
          </div>
        </div>
      </aside>

      {/* ===== Mobile : barre supérieure + nav horizontale ===== */}
      <div className="sticky top-0 z-40 w-full bg-emerald-950 lg:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <Link href="/dashboard/admin">
            <span className="font-serif text-base font-bold text-white">Maison Patrimo</span>
            <span className="ml-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-400">
              Admin
            </span>
          </Link>
          <span className="truncate pl-3 text-[11px] text-emerald-100/70" title={email}>
            {email}
          </span>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 pt-2 [scrollbar-width:none]">
          {visibleSections.flatMap((s) => s.items).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                  active
                    ? 'bg-amber-400 text-emerald-950'
                    : 'bg-emerald-900 text-emerald-100/80'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
