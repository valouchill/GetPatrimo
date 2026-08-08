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
  BellRing,
  FileCheck,
  ShieldAlert,
  Wallet,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useNotifications } from '../NotificationsContext';

// ─── Types ───────────────────────────────────────────────────────────────

export type NotificationType = 'ALERT' | 'SUCCESS' | 'INFO';
export type NotificationIcon = 'ShieldAlert' | 'FileCheck' | 'Star' | 'Wallet' | 'BellRing';

export interface AINotification {
  /** ID opaque string (ex: "alert-69aed9da", "lease-69ae88bd") */
  id: string;
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
  Wallet,
  BellRing,
};

// ─── Mock data V1 ────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: AINotification[] = [
  {
    id: 'mock-1',
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
    id: 'mock-2',
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
    id: 'mock-3',
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
  /**
   * Si fourni, override le context (utile pour Storybook / mock isole).
   * En production : laisser undefined pour que le composant consomme
   * useNotifications() (live + polling 60s + read state persiste).
   */
  notifications?: AINotification[];
  /** Override du compteur non lus (sinon calcule depuis notifications) */
  unreadCount?: number;
  /** Callback "marquer tout comme lu" (sinon no-op) */
  onMarkAllRead?: () => void;
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
  notifications: notificationsProp,
  unreadCount: unreadCountProp,
  onMarkAllRead,
  popoverAnchor = 'right',
  size = 'md',
}: AINotificationCenterProps): React.ReactElement {
  // V7.9 — Branchement context (avec fallback vers props pour rétrocompat).
  // useNotifications() retourne des valeurs no-op si pas de Provider.
  const ctx = useNotifications();
  const notifications = notificationsProp ?? ctx.notifications;
  const unreadCount = unreadCountProp ?? ctx.unreadCount;
  const markAllReadCb = onMarkAllRead ?? ctx.markAllRead;

  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const hasUnread = unreadCount > 0;

  // Marquer tout comme lu quand le popover s'ouvre (apres un petit delay
  // pour laisser l'utilisateur voir le badge "non lu" visuellement)
  const prevOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (open && !prevOpenRef.current && unreadCount > 0) {
      const timer = window.setTimeout(() => markAllReadCb(), 1200);
      return () => window.clearTimeout(timer);
    }
    prevOpenRef.current = open;
    return undefined;
  }, [open, unreadCount, markAllReadCb]);

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
          className={`absolute z-50 w-[min(22rem,calc(100vw-1.5rem))] sm:w-96 max-h-[min(32rem,75vh)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ${popoverPosClass}`}
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

          {/* Footer : mute toggles + lien archive */}
          <footer className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
              <span>Filtres :</span>
              {(['ALERT', 'SUCCESS', 'INFO'] as const).map((type) => {
                const muted = ctx.mutedTypes.has(type);
                const label =
                  type === 'ALERT' ? 'Alertes' : type === 'SUCCESS' ? 'Baux' : 'Infos';
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => ctx.toggleMute(type)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      muted
                        ? 'bg-slate-200 text-slate-400 line-through'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                    aria-pressed={!muted}
                    title={muted ? `Activer les ${label}` : `Couper les ${label}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <Link
                href="/dashboard/owner/notifications"
                onClick={() => setOpen(false)}
                className="font-semibold text-emerald-900 hover:underline"
              >
                Voir l&rsquo;historique complet →
              </Link>
              <span>
                Auditeur IA{' '}
                <span className="font-semibold text-emerald-900">
                  neuro-symbolique
                </span>
              </span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
