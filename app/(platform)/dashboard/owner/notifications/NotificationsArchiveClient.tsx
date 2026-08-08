'use client';

/**
 * <NotificationsArchiveClient> — Vue archive (pleine page) des notifications.
 *
 * Consomme useNotifications() comme le centre Bell, mais affichage etendu :
 *   - Conteneur OwnerShell-friendly (max-w-5xl mx-auto)
 *   - Filtres par type (utilise mutedTypes existant + bouton "Tout afficher")
 *   - Bouton "Tout marquer lu" si unread > 0
 *   - Cards aerees (vs compact dans la sidebar popover)
 */

import * as React from 'react';
import {
  Bell,
  CheckCheck,
  BellRing,
  FileCheck,
  ShieldAlert,
  Wallet,
  ShieldCheck,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { useNotifications } from '../NotificationsContext';
import type {
  AINotification,
  NotificationIcon,
  NotificationType,
} from '../components/AINotificationCenter';

const ICON_MAP: Record<NotificationIcon, LucideIcon> = {
  ShieldAlert,
  FileCheck,
  Star,
  Wallet,
  BellRing,
};

const TYPE_LABEL: Record<NotificationType, string> = {
  ALERT: 'Alertes Forensic',
  SUCCESS: 'Baux & Contrats',
  INFO: 'Activité & Candidats',
};

export function NotificationsArchiveClient(): React.ReactElement {
  const ctx = useNotifications();
  const { notifications, unreadCount, mutedTypes, toggleMute, markAllRead, loading } = ctx;

  // Groupement par type
  const grouped = React.useMemo(() => {
    const map = new Map<NotificationType, AINotification[]>();
    notifications.forEach((n) => {
      const arr = map.get(n.type) ?? [];
      arr.push(n);
      map.set(n.type, arr);
    });
    return map;
  }, [notifications]);

  const allTypes: NotificationType[] = ['ALERT', 'SUCCESS', 'INFO'];

  return (
    <div className="max-w-5xl mx-auto w-full p-6 lg:p-8 space-y-8">
      {/* Header */}
      <header>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Auditeur IA neuro-symbolique
        </div>
        <h1 className="font-serif text-3xl leading-tight text-emerald-900 sm:text-4xl">
          Centre de notifications
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Historique complet des Rapports de l&rsquo;Auditeur IA : alertes
          forensic, baux à préparer, candidats d&rsquo;exception. Personnalisez
          les filtres pour ne garder que ce qui compte.
        </p>
      </header>

      {/* Toolbar */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Filtres :
          </span>
          {allTypes.map((type) => {
            const muted = mutedTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleMute(type)}
                aria-pressed={!muted}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  muted
                    ? 'bg-slate-100 text-slate-400 line-through hover:bg-slate-200'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                {TYPE_LABEL[type]}
              </button>
            );
          })}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Tout marquer lu ({unreadCount})
          </button>
        )}
      </section>

      {/* Liste */}
      {loading && notifications.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
          Chargement des notifications…
        </p>
      )}

      {!loading && notifications.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm sm:p-14">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-900 text-amber-400">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-serif text-lg text-emerald-900">
            Tout est calme
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            Aucune notification active. L&rsquo;Auditeur IA scanne vos
            dossiers et vous alertera dès qu&rsquo;une action est requise.
          </p>
        </div>
      )}

      {allTypes
        .filter((type) => grouped.has(type) && (grouped.get(type) ?? []).length > 0)
        .map((type) => {
          const items = grouped.get(type) ?? [];
          return (
            <section key={type}>
              <h2 className="mb-3 flex items-center gap-2 font-serif text-lg text-emerald-900">
                <Bell className="h-4 w-4 text-amber-500" aria-hidden="true" />
                {TYPE_LABEL[type]}
                <span className="text-xs font-normal text-slate-400">
                  ({items.length})
                </span>
              </h2>
              <ul className="space-y-2">
                {items.map((n) => {
                  const Icon = ICON_MAP[n.icon] ?? Bell;
                  return (
                    <li
                      key={n.id}
                      className={`flex gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md ${
                        !n.read ? 'ring-1 ring-amber-200' : ''
                      }`}
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${n.color}`}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-serif text-base font-semibold text-emerald-900">
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              NOUVEAU
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {n.message}
                        </p>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {n.time}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
    </div>
  );
}
