'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Archive } from 'lucide-react';

export function PropertyCardMenu({
  bienId,
  bienLabel,
  onEdit,
  onDelete,
}: {
  bienId: string;
  bienLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Actions pour ${bienLabel}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-400" />
            Modifier
          </button>
          <div className="mx-2 my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            Archiver
          </button>
        </div>
      )}
    </div>
  );
}
