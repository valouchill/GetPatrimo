'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import ConfirmModal from './ConfirmModal';

interface Props {
  userId: string;
  userEmail: string;
  userRole: string;
  suspended: boolean;
  totpEnabled: boolean;
  currentRole: 'admin' | 'superadmin';
  isSelf: boolean;
}

type Pending =
  | null
  | { kind: 'suspend' }
  | { kind: 'unsuspend' }
  | { kind: 'reset-password' }
  | { kind: 'disable-2fa' }
  | { kind: 'magic-link' }
  | { kind: 'delete' }
  | { kind: 'promote'; role: string };

export default function UserActionsPanel(props: Props) {
  const router = useRouter();
  const { userId, userEmail, userRole, suspended, totpEnabled, currentRole, isSelf } = props;
  const isSuper = currentRole === 'superadmin';

  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string>('');
  const [magicLink, setMagicLink] = useState<{ token: string; expiresAt: string } | null>(null);
  const [newRole, setNewRole] = useState<string>(userRole);

  async function impersonate() {
    if (!confirm(`Se connecter en tant que ${userEmail} ?\n\nVotre session superadmin sera temporairement remplacée.\nUtilisez le bouton "Retour admin" dans la bannière rouge pour revenir.`)) return;
    setBusy(true);
    setInfo('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setInfo(`❌ ${j.error || 'Erreur impersonation'}`);
        return;
      }
      const { email, token, impersonatorEmail } = await res.json();
      await signIn('magic-fast', {
        email,
        token,
        impersonatorEmail,
        callbackUrl: '/dashboard/owner',
      });
    } finally { setBusy(false); }
  }

  async function run(pendingAction: Pending) {
    if (!pendingAction) return;
    setBusy(true);
    setInfo('');
    try {
      let res: Response;
      switch (pendingAction.kind) {
        case 'suspend':
          res = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suspended: true }),
          });
          break;
        case 'unsuspend':
          res = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ suspended: false }),
          });
          break;
        case 'reset-password':
          res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
          break;
        case 'disable-2fa':
          res = await fetch(`/api/admin/users/${userId}/disable-2fa`, { method: 'POST' });
          break;
        case 'magic-link':
          res = await fetch(`/api/admin/users/${userId}/magic-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (res.ok) {
            const data = await res.json();
            setMagicLink({ token: data.token, expiresAt: data.expiresAt });
          }
          break;
        case 'delete':
          res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
          if (res.ok) {
            router.push('/dashboard/admin/users');
            return;
          }
          break;
        case 'promote':
          res = await fetch(`/api/admin/users/${userId}/promote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: pendingAction.role }),
          });
          break;
      }
      if (!res!.ok) {
        const data = await res!.json().catch(() => ({}));
        setInfo(`❌ ${data.error || 'Erreur'}`);
      } else {
        setInfo('✓ Action effectuée');
        router.refresh();
      }
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const btn =
    'w-full text-left text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="font-semibold mb-3">Actions</h2>

      {info && <div className="mb-3 text-sm p-2 rounded bg-gray-50">{info}</div>}

      <div className="space-y-2">
        {suspended ? (
          <button className={btn} disabled={busy} onClick={() => setPending({ kind: 'unsuspend' })}>
            🔓 Réactiver le compte
          </button>
        ) : (
          <button
            className={btn}
            disabled={busy || isSelf}
            title={isSelf ? 'Action interdite sur votre propre compte' : ''}
            onClick={() => setPending({ kind: 'suspend' })}
          >
            🚫 Suspendre le compte
          </button>
        )}

        <button className={btn} disabled={busy} onClick={() => setPending({ kind: 'reset-password' })}>
          🔑 Forcer reset mot de passe
        </button>

        <button
          className={btn}
          disabled={busy || !totpEnabled}
          onClick={() => setPending({ kind: 'disable-2fa' })}
        >
          🔐 Désactiver 2FA {!totpEnabled && '(non activée)'}
        </button>

        <button className={btn} disabled={busy} onClick={() => setPending({ kind: 'magic-link' })}>
          ✉️ Générer lien magique
        </button>

        {isSuper && (
          <>
            <div className="pt-3 mt-3 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                Promotion/rétrogradation
              </label>
              <div className="flex gap-2">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                  disabled={isSelf}
                >
                  <option value="owner">owner</option>
                  <option value="tenant">tenant</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
                <button
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  disabled={busy || isSelf || newRole === userRole}
                  onClick={() => setPending({ kind: 'promote', role: newRole })}
                >
                  Appliquer
                </button>
              </div>
            </div>

            <button
              className={btn}
              disabled={busy || isSelf || userRole === 'admin' || userRole === 'superadmin'}
              title={userRole === 'admin' || userRole === 'superadmin' ? 'Impossible d\'impersonate un admin' : ''}
              onClick={impersonate}
            >
              🎭 Se connecter en tant que
            </button>

            <button
              className={btn + ' text-red-600 border-red-200 hover:bg-red-50'}
              disabled={busy || isSelf}
              onClick={() => setPending({ kind: 'delete' })}
            >
              🗑 Supprimer le compte (irréversible)
            </button>
          </>
        )}

        {!isSuper && (
          <div className="pt-3 mt-3 border-t border-gray-100 text-xs text-gray-500">
            Les actions de promotion et suppression sont réservées aux superadmins.
          </div>
        )}
      </div>

      {magicLink && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <div className="font-semibold text-yellow-900 mb-1">Lien magique généré</div>
          <div className="font-mono break-all text-yellow-800">{magicLink.token}</div>
          <div className="mt-1 text-yellow-700">
            Expire à {new Date(magicLink.expiresAt).toLocaleString('fr-FR')}
          </div>
          <button
            className="mt-2 text-indigo-700 underline"
            onClick={() => { navigator.clipboard.writeText(magicLink.token); }}
          >
            Copier
          </button>
        </div>
      )}

      <ConfirmModal
        open={pending !== null}
        title={titleFor(pending)}
        message={messageFor(pending, userEmail)}
        danger={isDanger(pending)}
        confirmLabel={isDanger(pending) ? 'Confirmer' : 'OK'}
        onConfirm={() => run(pending)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function titleFor(p: Pending): string {
  if (!p) return '';
  switch (p.kind) {
    case 'suspend': return 'Suspendre le compte';
    case 'unsuspend': return 'Réactiver le compte';
    case 'reset-password': return 'Forcer reset du mot de passe';
    case 'disable-2fa': return 'Désactiver la 2FA';
    case 'magic-link': return 'Générer un lien magique';
    case 'delete': return 'Supprimer définitivement';
    case 'promote': return `Modifier le rôle en ${p.role}`;
  }
}

function messageFor(p: Pending, email: string): string {
  if (!p) return '';
  switch (p.kind) {
    case 'suspend': return `${email} ne pourra plus se connecter.`;
    case 'unsuspend': return `${email} pourra à nouveau se connecter.`;
    case 'reset-password': return `${email} devra se reconnecter via lien magique / OTP.`;
    case 'disable-2fa': return `La 2FA sera retirée du compte ${email}.`;
    case 'magic-link': return `Un lien de connexion à usage unique sera généré pour ${email}.`;
    case 'delete': return `⚠️ Suppression DÉFINITIVE du compte ${email}. Aucune récupération possible.`;
    case 'promote': return `Le rôle de ${email} passera à "${p.role}".`;
  }
}

function isDanger(p: Pending): boolean {
  if (!p) return false;
  return p.kind === 'suspend' || p.kind === 'delete' || p.kind === 'disable-2fa' || p.kind === 'promote';
}
