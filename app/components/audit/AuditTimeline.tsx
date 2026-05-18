"use client";

import * as React from "react";
import { Check, Loader2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { formatDateShort } from "@/lib/product-lexicon";

export interface AuditStep {
  id: string;
  label: string;
  status?: "pending" | "in_progress" | "completed" | "blocked";
  description?: string;
  timestamp?: string | Date | null;
  durationMs?: number;
}

export interface AuditTimelineProps {
  steps: AuditStep[];
  className?: string;
}

const ICON_BY_STATUS: Record<NonNullable<AuditStep["status"]>, React.ElementType> = {
  pending: Clock,
  in_progress: Loader2,
  completed: Check,
  blocked: AlertTriangle,
};

const STYLE_BY_STATUS: Record<
  NonNullable<AuditStep["status"]>,
  { dot: string; icon: string; line: string; label: string }
> = {
  pending: {
    dot: "bg-slate-200",
    icon: "text-slate-500",
    line: "bg-slate-200",
    label: "text-slate-500",
  },
  in_progress: {
    dot: "bg-amber-500 ring-4 ring-amber-100",
    icon: "text-white animate-spin",
    line: "bg-slate-200",
    label: "text-amber-700 font-semibold",
  },
  completed: {
    dot: "bg-emerald-600",
    icon: "text-white",
    line: "bg-emerald-200",
    label: "text-slate-700",
  },
  blocked: {
    dot: "bg-red-500 ring-4 ring-red-100",
    icon: "text-white",
    line: "bg-slate-200",
    label: "text-red-700 font-semibold",
  },
};

function formatTime(ts?: string | Date | null) {
  if (!ts) return null;
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms?: number) {
  if (!ms || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)} min`;
}

/**
 * Timeline verticale de l'audit : étapes datées avec statut, durée et alertes.
 */
export function AuditTimeline({ steps, className = "" }: AuditTimelineProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className={`rounded-card border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Parcours d'audit
        </p>
      </div>
      <ol className="relative space-y-4">
        {steps.map((s, i) => {
          const status = s.status || "pending";
          const Icon = ICON_BY_STATUS[status];
          const style = STYLE_BY_STATUS[status];
          const isLast = i === steps.length - 1;
          const time = formatTime(s.timestamp);
          const date = s.timestamp ? formatDateShort(s.timestamp) : null;
          const dur = formatDuration(s.durationMs);
          return (
            <li key={s.id} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style.dot}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${style.icon}`} aria-hidden="true" />
                </div>
                {!isLast && <div className={`mt-1 w-0.5 flex-1 ${style.line}`} />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className={`text-sm ${style.label}`}>{s.label}</p>
                  {date && time && (
                    <span className="text-[11px] text-slate-400">{date} · {time}</span>
                  )}
                  {dur && (
                    <span className="rounded-pill bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {dur}
                    </span>
                  )}
                </div>
                {s.description && (
                  <p className="mt-0.5 text-xs text-slate-500">{s.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
