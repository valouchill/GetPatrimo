"use client";

import { CheckCircle2 } from "lucide-react";
import type { PropertyRecord } from "./types";

interface SectionBienProps {
  property: PropertyRecord | null;
}

export function SectionBien({ property }: SectionBienProps) {
  if (!property) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
          <CheckCircle2 className="h-3 w-3" />
          Auto-rempli depuis votre bien
        </span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">Nom</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{property.name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Adresse</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{property.address || "—"}</dd>
        </div>
        {property.surfaceM2 ? (
          <div>
            <dt className="text-xs font-medium text-slate-500">Surface</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{property.surfaceM2} m²</dd>
          </div>
        ) : null}
        {property.type ? (
          <div>
            <dt className="text-xs font-medium text-slate-500">Type</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">{property.type}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
