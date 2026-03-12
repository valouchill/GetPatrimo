"use client";

import { ChevronLeft } from "lucide-react";

type UnifiedTunnelHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
};

export default function UnifiedTunnelHeader({
  title,
  subtitle,
  onBack,
  actions,
}: UnifiedTunnelHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-8 py-5">
        <div className="grid w-full grid-cols-[1fr_2fr_1fr] items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:text-navy"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
          <div className="text-center">
            <div className="font-serif text-2xl font-semibold text-navy">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-3">{actions}</div>
        </div>
        <div className="h-px w-full bg-slate-100" />
      </div>
    </header>
  );
}
