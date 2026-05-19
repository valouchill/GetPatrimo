"use client";

import * as React from "react";
import { Link2, Copy, CheckCircle2, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/app/components/ui";
import { useNotification } from "@/app/hooks/useNotification";
import { PRODUCT } from "@/lib/product-lexicon";

export interface PropertySesameCardProps {
  applyToken?: string | null;
  variant?: "hero" | "compact";
  baseUrl?: string;
  className?: string;
}

function buildSesameUrl(applyToken: string | undefined | null, baseUrl?: string): string | null {
  if (!applyToken) return null;
  const origin = baseUrl
    || (typeof window !== "undefined" ? window.location.origin : "https://doc2loc.com");
  return `${origin}/apply/${applyToken}`;
}

function truncateMiddle(url: string, max = 56): string {
  if (url.length <= max) return url;
  const head = url.slice(0, Math.floor(max / 2) - 1);
  const tail = url.slice(url.length - (Math.ceil(max / 2) - 2));
  return `${head}…${tail}`;
}

/**
 * Card premium pour le Sésame d'un bien — lien de candidature à partager.
 * Mise en valeur par sa taille et son CTA amber-500 plein largeur.
 */
export function PropertySesameCard({
  applyToken,
  variant = "hero",
  baseUrl,
  className = "",
}: PropertySesameCardProps) {
  const notify = useNotification();
  const [copied, setCopied] = React.useState(false);
  const url = buildSesameUrl(applyToken, baseUrl);
  const isHero = variant === "hero";

  const handleCopy = async () => {
    if (!url) {
      notify.error("Sésame indisponible pour ce bien.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify.success("Sésame copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Impossible de copier le lien.");
    }
  };

  const handleOpen = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!url) {
    return (
      <div className={`rounded-card border border-slate-200 bg-slate-50 px-4 py-4 ${className}`}>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Sparkles className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {PRODUCT.SESAME} en cours de génération. Réessayez dans quelques instants.
        </p>
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-card border bg-gradient-to-br shadow-card transition-shadow hover:shadow-elevated",
        isHero
          ? "border-amber-200 from-amber-50 via-white to-emerald-50/40 p-5 sm:p-6"
          : "border-slate-200 from-white to-slate-50 p-4",
        className,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-card bg-amber-100 text-amber-700 ${
            isHero ? "h-11 w-11" : "h-9 w-9"
          }`}
        >
          <Link2 className={isHero ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">
            Lien candidature · {PRODUCT.SESAME}
          </p>
          <h3
            className={`mt-1 font-serif font-bold tracking-tight text-slate-900 ${
              isHero ? "text-base sm:text-lg" : "text-sm"
            }`}
          >
            Partagez ce lien pour recevoir des candidatures
          </h3>
          <div className="mt-2 flex items-center gap-2 rounded-pill bg-white/80 px-3 py-1.5 ring-1 ring-slate-200">
            <span className="truncate font-mono text-[11px] text-slate-600 sm:text-xs">
              {truncateMiddle(url, isHero ? 60 : 44)}
            </span>
          </div>
        </div>
      </div>

      <div className={`mt-${isHero ? "5" : "3"} flex flex-wrap gap-2`}>
        <Button
          variant="primary"
          size={isHero ? "md" : "sm"}
          fullWidth={isHero}
          onClick={handleCopy}
          iconLeft={copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          className={isHero ? "sm:flex-1" : ""}
        >
          {copied ? "Sésame copié" : "Copier le Sésame"}
        </Button>
        <Button
          variant="outline"
          size={isHero ? "md" : "sm"}
          onClick={handleOpen}
          iconLeft={<ExternalLink className="h-4 w-4" />}
        >
          Ouvrir
        </Button>
      </div>

      {isHero && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Sparkles className="h-3 w-3 text-emerald-600" aria-hidden="true" />
          Partagez-le sur LeBonCoin · WhatsApp · email — les dossiers reçus sont analysés
          automatiquement par l'IA.
        </p>
      )}
    </div>
  );
}
