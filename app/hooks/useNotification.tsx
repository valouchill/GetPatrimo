'use client';

import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationAPI {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const NotificationContext = createContext<NotificationAPI | null>(null);

let idCounter = 0;

/**
 * Hook pour afficher des notifications toast.
 *
 * @example
 * ```tsx
 * const notify = useNotification();
 * notify.success('Opération réussie');
 * notify.error('Une erreur est survenue');
 * ```
 */
export function useNotification(): NotificationAPI {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification doit être utilisé dans un NotificationProvider');
  return ctx;
}

const DURATION = 4000;

const typeStyles: Record<NotificationType, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'bg-slate-700 text-white',
};

const typeIcons: Record<NotificationType, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
};

/**
 * Provider de notifications toast. Enveloppe l'application pour activer useNotification.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const add = useCallback((type: NotificationType, message: string) => {
    const id = `notif-${++idCounter}`;
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, DURATION);
  }, []);

  const api: NotificationAPI = {
    success: useCallback((msg: string) => add('success', msg), [add]),
    error: useCallback((msg: string) => add('error', msg), [add]),
    warning: useCallback((msg: string) => add('warning', msg), [add]),
    info: useCallback((msg: string) => add('info', msg), [add]),
  };

  return (
    <NotificationContext.Provider value={api}>
      {children}
      {/* Toast container — bas droite */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-slide-in-right ${typeStyles[n.type]}`}
            role="alert"
          >
            <span className="text-base leading-none">{typeIcons[n.type]}</span>
            <span>{n.message}</span>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
