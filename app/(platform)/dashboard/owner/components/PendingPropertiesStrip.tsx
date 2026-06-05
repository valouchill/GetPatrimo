"use client";

import * as React from "react";
import { Copy, CheckCircle2, MapPin, Building2, ArrowRight } from "lucide-react";
import { Button, SectionHeader } from "@/app/components/ui";
import { useNotification } from "@/app/hooks/useNotification";
import type { LocalBien } from "./ui";

export interface PendingPropertiesStripProps {
  biens: LocalBien[];
  baseUrl?: string;
  maxVisible?: number;
  onOpenBien?: (id: string) => void;
  onViewAllBiens?: () => void;
  className?: string;
}

function buildSesameUrl(applyToken: string | undefined, baseUrl?: string): string | null {
  if (!applyToken) return null;
  const origin = baseUrl
    || (typeof window !== "undefined" ? window.location.origin : "https://maisonpatrimo.com");
  return `${origin}/apply/${applyToken}`;
}

/**
 * Section secondaire compacte affichant les biens en attente de candidats
 * (aucune candidature active sur le bien). Visible quand le dashboard a déjà
 * des candidatures mais que certains biens n'en ont pas encore.
 */
export function PendingPropertiesStrip({
  biens,
  baseUrl,
  maxVisible = 3,
  onOpenBien,
  onViewAllBiens,
  className = "",
}: PendingPropertiesStripProps) {
  const notify = useNotification();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!biens || biens.length === 0) return null;

  const visible = biens.slice(0, maxVisible);
  const remaining = biens.length - visible.length;

  const handleCopy = async (bien: LocalBien) => {
    const url = buildSesameUrl(bien.applyToken, baseUrl);
    if (!url) {
      notify.error("Le Sésame n'est pas encore disponible pour ce bien.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(bien.id);
      notify.success("Sésame copié !");
      setTimeout(() => setCopiedId((id) => (id === bien.id ? null : id)), 2000);
    } catch {
      notify.error("Impossible de copier le lien.");
    }
  };

  return (
    <section className={className}>
      <SectionHeader
        eyebrow="À promouvoir"
        title={`${biens.length} bien${biens.length > 1 ? "s" : ""} en attente de candidats`}
        description="Partagez le Sésame de ces biens pour attirer des dossiers."
        actions={
          onViewAllBiens && remaining > 0 ? (
            <Button variant="ghost" size="sm" onClick={onViewAllBiens} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
              Voir tous mes biens
            </Button>
          ) : undefined
        }
      />

      <ul className="divide-y divide-slate-100 rounded-card border border-slate-200 bg-white shadow-card">
        {visible.map((b) => {
          const hasToken = Boolean(b.applyToken);
          const copied = copiedId === b.id;
          return (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-slate-50">
                <Building2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{b.label}</p>
                {b.adresse && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {b.adresse}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hasToken ? (
                  <Button
                    variant={copied ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => handleCopy(b)}
                    iconLeft={copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  >
                    {copied ? "Copié" : "Sésame"}
                  </Button>
                ) : (
                  <span className="text-[11px] italic text-slate-400">Sésame indisponible</span>
                )}
                {onOpenBien && (
                  <Button variant="ghost" size="sm" onClick={() => onOpenBien(b.id)}>
                    Voir
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {remaining > 0 && !onViewAllBiens && (
        <p className="mt-2 text-xs text-slate-500">
          + {remaining} autre{remaining > 1 ? "s" : ""} bien{remaining > 1 ? "s" : ""} en attente
        </p>
      )}
    </section>
  );
}
