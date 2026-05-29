'use client';

/**
 * NotificationsContext V3 (V7.10) — centre de notifications IA.
 *
 * Évolutions vs V7.9 :
 *   - Persistance read/unread CÔTÉ SERVEUR (User.readNotificationIds)
 *     au lieu de localStorage. Bénéfice : cross-device sync.
 *   - Toast auto-trigger sur nouvelle ALERTE détectée (delta entre fetches)
 *     via useNotification.error/.warning du hook global.
 *   - Mute par type (LOCAL, par device) : l'owner peut couper les
 *     notifications INFO ou SUCCESS via la popover sans toucher serveur.
 *
 * Polling : 60s (suspendu si onglet invisible).
 * Re-fetch au refocus de l'onglet.
 */

import * as React from 'react';
import {
  MOCK_NOTIFICATIONS,
  type AINotification,
  type NotificationType,
} from './components/AINotificationCenter';
import { useNotification } from '@/app/hooks/useNotification';

const POLL_INTERVAL_MS = 60_000;
const MUTED_TYPES_STORAGE_KEY = 'patrimo:notif-muted-types';

export interface NotificationsContextValue {
  notifications: AINotification[];
  unreadCount: number;
  hasUnreadAlert: boolean;
  loading: boolean;
  /** Types actuellement mutés (localStorage, par device) */
  mutedTypes: Set<NotificationType>;
  /** Toggle mute pour un type donné */
  toggleMute: (type: NotificationType) => void;
  /** Marque toutes les notifications actuellement affichées comme lues */
  markAllRead: () => void;
  /** Re-fetch manuel (utile après une action métier) */
  refresh: () => Promise<void>;
}

const NotificationsContext =
  React.createContext<NotificationsContextValue | null>(null);

// ─── localStorage helpers (mute types only) ─────────────────────────────

function loadMutedTypes(): Set<NotificationType> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(MUTED_TYPES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? (parsed as NotificationType[]) : []);
  } catch {
    return new Set();
  }
}

function saveMutedTypes(types: Set<NotificationType>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      MUTED_TYPES_STORAGE_KEY,
      JSON.stringify(Array.from(types)),
    );
  } catch {
    /* quota plein, fallback silencieux */
  }
}

// ─── Provider ────────────────────────────────────────────────────────────

interface NotificationsProviderProps {
  children: React.ReactNode;
}

export function NotificationsProvider({
  children,
}: NotificationsProviderProps): React.ReactElement {
  const notify = useNotification();
  const [rawNotifications, setRawNotifications] = React.useState<
    AINotification[]
  >([]);
  const [mutedTypes, setMutedTypes] = React.useState<Set<NotificationType>>(
    () => loadMutedTypes(),
  );
  const [loading, setLoading] = React.useState(true);

  // Set des IDs vus localement pour la detection delta (toast trigger)
  const seenIdsRef = React.useRef<Set<string>>(new Set());

  // ─── Fetch live ─────────────────────────────────────────────────────────
  const fetchNotifications = React.useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/owner/notifications', {
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 401) {
          setRawNotifications([]);
        } else {
          // Mock fallback uniquement sur erreur serveur
          setRawNotifications(MOCK_NOTIFICATIONS);
        }
        return;
      }
      const data = (await res.json()) as AINotification[];
      const next = Array.isArray(data) ? data : [];

      // V7.10 — Detection delta : si une nouvelle ALERTE non lue arrive
      // et qu'on ne l'avait pas vue avant -> toast.
      // Important : on skip ce trigger au tout premier fetch (seenIds vide
      // signifie qu'on n'a rien encore consomme, pas qu'on a tout vu).
      if (seenIdsRef.current.size > 0) {
        const newAlerts = next.filter(
          (n) =>
            n.type === 'ALERT' &&
            !n.read &&
            !mutedTypes.has(n.type) &&
            !seenIdsRef.current.has(n.id),
        );
        newAlerts.forEach((alert) => {
          notify.error(`⚠ ${alert.title} — ${alert.message}`);
        });
      }
      seenIdsRef.current = new Set(next.map((n) => n.id));

      setRawNotifications(next);
    } catch {
      setRawNotifications(MOCK_NOTIFICATIONS);
    } finally {
      setLoading(false);
    }
  }, [mutedTypes, notify]);

  // Initial + polling
  React.useEffect(() => {
    void fetchNotifications();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchNotifications();
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchNotifications]);

  // Re-fetch au refocus de l'onglet
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

  // ─── Calculs derives (filtres mutedTypes appliques) ─────────────────────
  const notifications = React.useMemo<AINotification[]>(
    () => rawNotifications.filter((n) => !mutedTypes.has(n.type)),
    [rawNotifications, mutedTypes],
  );

  const unreadCount = React.useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const hasUnreadAlert = React.useMemo(
    () => notifications.some((n) => !n.read && n.type === 'ALERT'),
    [notifications],
  );

  // ─── Mark all read (serveur) ────────────────────────────────────────────
  const markAllRead = React.useCallback((): void => {
    const unreadIds = rawNotifications
      .filter((n) => !n.read)
      .map((n) => n.id);
    if (unreadIds.length === 0) return;
    // Optimistic local update
    setRawNotifications((prev) =>
      prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read: true } : n)),
    );
    // Persistance serveur (best-effort, non bloquant)
    void fetch('/api/owner/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: unreadIds }),
    }).catch(() => {
      // En cas d'erreur, on garde l'optimistic — le prochain fetch
      // re-synchronisera de toute façon.
    });
  }, [rawNotifications]);

  // ─── Toggle mute par type ───────────────────────────────────────────────
  const toggleMute = React.useCallback((type: NotificationType): void => {
    setMutedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      saveMutedTypes(next);
      return next;
    });
  }, []);

  const value = React.useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      hasUnreadAlert,
      loading,
      mutedTypes,
      toggleMute,
      markAllRead,
      refresh: fetchNotifications,
    }),
    [
      notifications,
      unreadCount,
      hasUnreadAlert,
      loading,
      mutedTypes,
      toggleMute,
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
    // Fallback gracieux hors-provider
    return {
      notifications: [],
      unreadCount: 0,
      hasUnreadAlert: false,
      loading: false,
      mutedTypes: new Set(),
      toggleMute: () => {},
      markAllRead: () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
