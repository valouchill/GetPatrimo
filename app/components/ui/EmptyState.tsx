"use client";

import * as React from "react";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  variant?: "default" | "premium";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className = "",
}: EmptyStateProps) {
  const isPremium = variant === "premium";
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-card border px-6 py-12 text-center",
        isPremium
          ? "border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white"
          : "border-dashed border-slate-200 bg-slate-50",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && (
        <div
          className={[
            "mb-4 flex h-14 w-14 items-center justify-center rounded-full",
            isPremium
              ? "bg-emerald-100 text-emerald-700"
              : "bg-white text-slate-400 shadow-card",
          ].join(" ")}
        >
          {icon}
        </div>
      )}
      <h3 className="font-serif text-lg font-bold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
