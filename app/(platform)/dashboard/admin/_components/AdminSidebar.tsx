'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  superadminOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard/admin', label: 'Overview', icon: '📊' },
  { href: '/dashboard/admin/cockpit', label: 'Cockpit', icon: '🚀', superadminOnly: true },
  { href: '/dashboard/admin/users', label: 'Utilisateurs', icon: '👥' },
  { href: '/dashboard/admin/properties', label: 'Biens', icon: '🏠' },
  { href: '/dashboard/admin/leases', label: 'Baux', icon: '📄' },
  { href: '/dashboard/admin/payments', label: 'Paiements', icon: '💶' },
  { href: '/dashboard/admin/applications', label: 'Candidatures', icon: '📥' },
  { href: '/dashboard/admin/verifications', label: 'KYC Didit', icon: '🪪' },
  { href: '/dashboard/admin/pilots', label: 'Pilotes B2B', icon: '🤝', superadminOnly: true },
  { href: '/dashboard/admin/audit', label: 'Audit log', icon: '📜' },
];

interface Props {
  role: 'admin' | 'superadmin';
  email: string;
}

export default function AdminSidebar({ role, email }: Props) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 min-h-screen flex-col bg-white border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="text-xs uppercase text-gray-500 font-semibold">Admin</div>
        <div className="font-medium text-gray-900 truncate" title={email}>{email}</div>
        <div className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 uppercase">
          {role}
        </div>
      </div>
      <nav className="flex-1 p-2">
        {NAV.filter((item) => !item.superadminOnly || role === 'superadmin').map((item) => {
          const active =
            item.href === '/dashboard/admin'
              ? pathname === item.href
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm mb-1 ${
                active ? 'bg-indigo-50 text-indigo-900 font-medium' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-200">
        <Link
          href="/dashboard/owner"
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          ← Retour dashboard
        </Link>
      </div>
    </aside>
  );
}
