'use client';

/**
 * <AINotificationCenter> — Centre de notifications IA "Rapports de l'Auditeur".
 *
 * UX banque privée : un Bell discret dans la sidebar footer + un popover
 * positionné à droite affichant le fil d'actualité (Alertes Forensic,
 * Baux prêts, Nouveaux candidats PLATINUM, …).
 *
 * V1 : mock data hardcodée. V2 branchera une vraie source (SSE / polling
 * d'une route /api/owner/notifications).
 *
 * Architecture :
 *   - Bouton Bell avec point rouge "ping" si notifications non lues
 *   - Popover rendu en absolute (anchored to button), s'ouvre vers le bas-droite
 *   - Click outside / Escape ferment le panneau
 *   - Aucune dependance externe : pure React + Tailwind + Lucide
 */

import * as React from 'react';
import {
  Bell,
  FileCheck,
  ShieldAlert,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────

export type NotificationType = 'ALERT' | 'SUCCESS' | 'INFO';
export type NotificationIcon = 'ShieldAlert' | 'FileCheck' | 'Star';

export interface AINotification {
  id: number | string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  icon: NotificationIcon;
  /** Classes Tailwind composites (texte + fond) pour le pictogramme */
  color: string;
}

const ICON_MAP: Record<NotificationIcon, LucideIcon> = {
  ShieldAlert,
  FileCheck,
  Star,
};

// ─── Mock data V1 ────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: AINotification[] = [
  {
    id: 1,
    type: 'ALERT',
    title: 'Alerte Sécurité (Forensic)',
    message:
      "Le dossier de Marc D. présente des anomalies sur l'avis d'imposition. Dossier écarté.",
    time: 'Il y a 10 min',
    read: false,
    icon: 'ShieldAlert',
    color: 'text-red-600 bg-red-50',
  },
  {
    id: 2,
    type: 'SUCCESS',
    title: 'Bail disponible',
    message:
      'Le contrat de location pour Valentin V. est prêt à être téléchargé.',
    time: 'Il y a 2 heures',
    read: true,
    icon: 'FileCheck',
    color: 'text-emerald-700 bg-emerald-50',
  },
  {
    id: 3,
    type: 'INFO',
    title: 'Nouveau candidat PLATINUM',
    message:
      "Un profil d'excellence vient de déposer un dossier pour votre bien « 1 Rue des Minimes ».",
    time: 'Hier',
    read: true,
    icon: 'Star',
    color: 'text-amber-700 bg-amber-50',
  },
];

// ─── Composant ───────────────────────────────────────────────────────────

export interface AINotificationCenterProps {
  notifications?: AINotification[];
  /**
   * Position du popover par rapport au bouton.
   *   - 'right' (défaut) : panneau ouvre à DROITE du bouton (sidebar à gauche)
   *   - 'bottom-right'   : ouvre vers le bas-droite (header global)
   */
  popoverAnchor?: 'right' | 'bottom-right';
  /** Taille du bouton (default md). 'sm' pour intégration dans une row dense. */
  size?: 'sm' | 'md';
}

export function AINotificationCenter({
  notifications = MOCK_NOTIFICATIONS,
  popoverAnchor = 'right',
  size = 'md',
}: AINotificationCenterProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );
  const hasUnread = unreadCount > 0;

  // Click outside / Escape ferment
  React.useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Classes positionnement du popover
  const popoverPosClass =
    popoverAnchor === 'right'
      ? // Bouton dans sidebar (left) → popover s'ouvre vers la droite
        'left-full bottom-0 ml-3'
      : // Bouton dans header → popover s'ouvre vers le bas et la gauche
        'right-0 top-full mt-2';

  const btnSize = size === 'sm' ? 'h-7 w-7 p-1' : 'h-8 w-8 p-1.5';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="relative">
      {/* ─── Trigger Bell ───────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Centre de notifications${
          hasUnread ? ` (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})` : ''
        }`}
        aria-expanded={open}
        className={`relative rounded-lg ${btnSize} text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500`}
      >
        <Bell className={iconSize} aria-hidden="true" />
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-2 w-2"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      {/* ─── Popover ────────────────────────────────────────────── */}
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Rapports de l'Auditeur IA"
          className={`absolute z-50 w-[22rem] sm:w-96 max-h-[32rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ${popoverPosClass}`}
        >
          {/* Header */}
          <header className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50/40 px-5 py-4">
            <div className="flex items-start gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-900 text-amber-400">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-base font-semibold text-emerald-900">
                  Rapports de l&rsquo;Auditeur IA
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {hasUnread
                    ? `${unreadCount} nouvelle${unreadCount > 1 ? 's' : ''} alerte${
                        unreadCount > 1 ? 's' : ''
                      } depuis votre dernière visite`
                    : 'Tout est à jour. Aucune alerte critique.'}
                </p>
              </div>
            </div>
          </header>

          {/* Liste */}
          <ul className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: '24rem' }}>
            {notifications.length === 0 ? (
              <li className="px-5 py-12 text-center text-sm text-slate-500">
                Aucune notification pour le moment.
              </li>
            ) : (
              notifications.map((n) => {
                const Icon = ICON_MAP[n.icon] ?? Bell;
                return (
                  <li
                    key={n.id}
                    className={`flex gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 ${
                      !n.read ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.color}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {n.title}
                        </p>
                        {!n.read && (
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {n.message}
                      </p>
                      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {n.time}
                      </p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer informatif */}
          <footer className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] text-slate-500">
            Powered by{' '}
            <span className="font-semibold text-emerald-900">
              Auditeur IA neuro-symbolique
            </span>
          </footer>
        </div>
      )}
    </div>
  );
}
