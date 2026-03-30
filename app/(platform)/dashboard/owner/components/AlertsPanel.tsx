'use client';

import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  actionLabel: string;
  actionTarget: string;
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    bg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-500',
    textColor: 'text-red-800',
    btnClass: 'bg-red-600 hover:bg-red-700 text-white',
    dot: 'bg-red-500',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-50 border-amber-200',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-800',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    dot: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-800',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    dot: 'bg-blue-500',
  },
};

export function AlertsPanel({
  alerts,
  onNavigate,
}: {
  alerts: Alert[];
  onNavigate: (target: string) => void;
}) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {alerts.map((alert) => {
        const config = SEVERITY_CONFIG[alert.severity];
        const Icon = config.icon;
        return (
          <div
            key={alert.id}
            className={`flex items-center gap-3 rounded-xl border p-3.5 ${config.bg}`}
          >
            <Icon className={`h-5 w-5 shrink-0 ${config.iconColor}`} />
            <span className={`flex-1 text-sm font-medium ${config.textColor}`}>
              {alert.message}
            </span>
            <button
              type="button"
              onClick={() => onNavigate(alert.actionTarget)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${config.btnClass}`}
            >
              {alert.actionLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}
