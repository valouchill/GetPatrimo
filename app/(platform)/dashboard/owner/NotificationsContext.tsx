'use client';

/**
 * NotificationsContext — Provider centralise les notifications IA pour
 * tout le scope /dashboard/owner/*.
 *
 * Comportement :
 *   - Fetch /api/owner/notifications au mount + polling toutes les 60s
 *   - Persistance read/unread via localStorage (clé `patrimo:notif-read-ids`)
 *   - markAllRead() : marque toutes les notifs actuellement chargées comme lues
 *   - Stoppe le polling quand l'onglet n'est plus visible (économie ressources)
 *
 * Mock fallback : si la route 401/500, on retombe sur MOCK_NOTIFICATIONS
 * pour preserver l'UX en dev / debug sans casser la page.
 */

import * as React from 'react';
import {
  MOCK_NOTIFICATIONS,
  type AINotification,
} from './components/AINotificationCenter';

const POLL_INTERVAL_MS = 60_000;
const READ_IDS_STORAGE_KEY = 'patrimo:notif-read-ids';

interface NotificationsContextValue {
  notifications: AINotification[];
  unreadCount: number;
  hasUnreadAlert: boolean;
  loading: boolean;
  /** Marque toutes les notifications actuellement affichées comme lues. */
  markAllRead: () => void;
  /** Re-fetch manuel (utile après une action métier). */
  refresh: () => Promise<void>;
}

const NotificationsContext =
  React.createContext<NotificationsContextValue | null>(null);

function loadReadIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(READ_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      READ_IDS_STORAGE_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    /* quota plein, fallback silencieux */
  }
}

interface NotificationsProviderProps {
  children: React.ReactNode;
}

export function NotificationsProvider({
  children,
}: NotificationsProviderProps): React.ReactElement {
  const [rawNotifications, setRawNotifications] = React.useState<
    Array<Omit<AINotification, 'read'>>
  >([]);
  const [readIds, setReadIds] = React.useState<Set<string>>(() => loadReadIds());
  const [loading, setLoading] = React.useState(true);

  // ─── Fetch live ─────────────────────────────────────────────────────────
  const fetchNotifications = React.useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/owner/notifications', {
        cache: 'no-store',
      });
      if (!res.ok) {
        // 401 (logged out) ou 500 : on tombe sur mock pour preserver l'UX
        if (res.status === 401) {
          setRawNotifications([]);
        } else {
          setRawNotifications(
            MOCK_NOTIFICATIONS.map(({ read, ...n }) => n),
          );
        }
        return;
      }
      const data = (await res.json()) as Array<Omit<AINotification, 'read'>>;
      setRawNotifications(Array.isArray(data) ? data : []);
    } catch {
      // Erreur réseau : mock fallback pour UX
      setRawNotifications(MOCK_NOTIFICATIONS.map(({ read, ...n }) => n));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  React.useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => {
      // Ne poll que si l'onglet est visible
      if (document.visibilityState === 'visible') {
        void fetchNotifications();
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  // Re-fetch quand l'onglet redevient visible (apres long blur)
  React.useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () =>
      document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchNotifications]);

  // ─── Calculs derives ────────────────────────────────────────────────────
  const notifications = React.useMemo<AINotification[]>(
    () =>
      rawNotifications.map((n) => ({
        ...n,
        read: readIds.has(String(n.id)),
      })),
    [rawNotifications, readIds],
  );

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const hasUnreadAlert = React.useMemo(
    () => notifications.some((n) => !n.read && n.type === 'ALERT'),
    [notifications],
  );

  // ─── Mark all read ──────────────────────────────────────────────────────
  const markAllRead = React.useCallback((): void => {
    setReadIds((prev) => {
      const next = new Set(prev);
      rawNotifications.forEach((n) => next.add(String(n.id)));
      saveReadIds(next);
      return next;
    });
  }, [rawNotifications]);

  const value = React.useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      hasUnreadAlert,
      loading,
      markAllRead,
      refresh: fetchNotifications,
    }),
    [
      notifications,
      unreadCount,
      hasUnreadAlert,
      loading,
      markAllRead,
      fetchNotifications,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

/**
 * Hook de consommation. Doit être appelé dans un descendant de
 * NotificationsProvider (configuré au niveau du layout owner).
 */
export function useNotifications(): NotificationsContextValue {
  const ctx = React.useContext(NotificationsContext);
  if (!ctx) {
    // Fallback gracieux hors-provider (ex: tests, storybook) :
    // expose une API no-op pour éviter de crasher.
    return {
      notifications: [],
      unreadCount: 0,
      hasUnreadAlert: false,
      loading: false,
      markAllRead: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
