"use client";

import { type ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import type { SectionStatus } from "./useFormCompletion";

interface CollapsibleSectionProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  status?: SectionStatus;
  defaultOpen?: boolean;
  children: ReactNode;
}

function StatusBadge({ status }: { status: SectionStatus }) {
  if (status.total === 0) return null;

  if (status.status === "complete") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="h-3 w-3" /> Complet
      </span>
    );
  }

  const missing = status.total - status.filled;
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
      <AlertCircle className="h-3 w-3" /> {missing} manquant{missing > 1 ? "s" : ""}
    </span>
  );
}

export function CollapsibleSection({
  icon,
  title,
  subtitle,
  status,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="flex-shrink-0 text-slate-400">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>
        {status && <StatusBadge status={status} />}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-slate-400"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-slate-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
