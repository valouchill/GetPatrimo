"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Inbox, Copy, CheckCircle2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/app/components/ui";
import { useNotification } from "@/app/hooks/useNotification";
import { isEnabled } from "@/lib/features";
import { SampleDossierDemo } from "./SampleDossierDemo";
import type { LocalBien } from "./ui";

export interface DashboardEmptyStateProps {
  biens: LocalBien[];
  baseUrl?: string;
  onAddBien: () => void;
  onOpenBien?: (id: string) => void;
  className?: string;
}

function buildSesameUrl(applyToken: string | undefined, baseUrl?: string): string | null {
  if (!applyToken) return null;
  const origin = baseUrl
    || (typeof window !== "undefined" ? window.location.origin : "https://maisonpatrimo.com");
  return `${origin}/apply/${applyToken}`;
}

/**
 * Empty state premium pour le dashboard propriétaire quand aucune candidature
 * n'a encore été reçue. Met en avant les biens disponibles avec leur Sésame
 * à partager.
 */
export function DashboardEmptyState({
  biens,
  baseUrl,
  onAddBien,
  onOpenBien,
  className = "",
}: DashboardEmptyStateProps) {
  const notify = useNotification();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [showDemo, setShowDemo] = React.useState(false);

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

  const hasBiens = biens.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-card border border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white p-8 md:p-12 ${className}`}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Inbox className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Vos candidats arrivent bientôt
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
          Partagez votre lien <strong className="text-emerald-700">Sésame</strong> sur LeBonCoin ou avec votre réseau.
          Chaque dossier reçu est <strong>analysé automatiquement par notre IA</strong> : verdict, Indice de Résilience,
          Audit Forensic, certifications.
        </p>

        {hasBiens ? (
          <div className="mt-8 w-full max-w-xl space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              Vos biens prêts à recevoir des dossiers
            </p>
            <ul className="divide-y divide-slate-100 rounded-card border border-slate-200 bg-white shadow-card">
              {biens.slice(0, 5).map((b) => {
                const hasToken = Boolean(b.applyToken);
                const copied = copiedId === b.id;
                return (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-slate-900">{b.label}</p>
                      <p className="truncate text-xs text-slate-500">{b.adresse || "Adresse non renseignée"}</p>
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
            {biens.length > 5 && (
              <p className="text-xs text-slate-500">
                + {biens.length - 5} autres biens dans l&apos;onglet « Mes biens »
              </p>
            )}
          </div>
        ) : (
          <div className="mt-8">
            <Button
              variant="primary"
              size="lg"
              onClick={onAddBien}
              iconLeft={<Plus className="h-4 w-4" />}
            >
              Ajouter mon premier bien
            </Button>
          </div>
        )}

        {isEnabled("DEMO_MODE_ALLOWED") && (
          <div className="mt-8 w-full max-w-xl border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-600">
              Pas encore de dossier reçu ?{" "}
              <strong className="text-slate-800">
                Voyez le résultat en 30 secondes
              </strong>{" "}
              sur un dossier exemple — sans attendre un candidat.
            </p>
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDemo((v) => !v)}
                iconLeft={<Sparkles className="h-4 w-4" />}
              >
                {showDemo ? "Masquer la démo" : "Tester avec un dossier exemple"}
              </Button>
            </div>
            {showDemo && <SampleDossierDemo className="mt-5 text-left" />}
          </div>
        )}

        <div className="mt-8 inline-flex items-center gap-2 rounded-pill bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Chaque dossier reçu est pré-trié automatiquement et noté sous 24 h
        </div>
      </div>
    </motion.section>
  );
}
