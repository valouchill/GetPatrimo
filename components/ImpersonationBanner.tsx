'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';

export default function ImpersonationBanner() {
  const { data: session, status } = useSession();
  const [busy, setBusy] = useState(false);

  if (status !== 'authenticated') return null;
  const impersonatedBy = (session?.user as any)?.impersonatedBy;
  if (!impersonatedBy) return null;

  async function exit() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/impersonate/exit', { method: 'POST' });
      if (!res.ok) {
        await signOut({ callbackUrl: '/auth/login' });
        return;
      }
      const { email, token } = await res.json();
      await signIn('magic-fast', {
        email,
        token,
        callbackUrl: '/dashboard/admin',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-red-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span>🎭</span>
          <span>
            <strong>Impersonation active</strong> — connecté en tant que{' '}
            <span className="font-mono">{session?.user?.email}</span> par{' '}
            <span className="font-mono">{impersonatedBy}</span>
          </span>
        </div>
        <button
          onClick={exit}
          disabled={busy}
          className="bg-white text-red-700 hover:bg-red-50 px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
        >
          {busy ? '…' : 'Retour admin'}
        </button>
      </div>
    </div>
  );
}
