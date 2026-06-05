"use client";

import * as React from "react";
import {
  Link2,
  Copy,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  KeyRound,
  Share2,
} from "lucide-react";
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
    || (typeof window !== "undefined" ? window.location.origin : "https://getpatrimo.com");
  return `${origin}/apply/${applyToken}`;
}

function truncateMiddle(url: string, max = 56): string {
  if (url.length <= max) return url;
  const head = url.slice(0, Math.floor(max / 2) - 1);
  const tail = url.slice(url.length - (Math.ceil(max / 2) - 2));
  return `${head}…${tail}`;
}

/**
 * Card premium présentant les 2 démarches pour qu'un locataire dépose son
 * dossier sur getpatrimo :
 *   A — Partage du lien direct (LeBonCoin, WhatsApp, email)
 *   B — Code d'accès à saisir sur getpatrimo.com/acces
 *
 * Mise en valeur dans la modale fiche bien (PropertyDetailModal).
 */
export function PropertySesameCard({
  applyToken,
  variant = "hero",
  baseUrl,
  className = "",
}: PropertySesameCardProps) {
  const notify = useNotification();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const url = buildSesameUrl(applyToken, baseUrl);
  const code = applyToken || "";

  const handleCopyLink = async () => {
    if (!url) {
      notify.error("Sésame indisponible pour ce bien.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      notify.success("Lien Sésame copié !");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      notify.error("Impossible de copier le lien.");
    }
  };

  const handleCopyCode = async () => {
    if (!code) {
      notify.error("Code Sésame indisponible.");
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      notify.success("Code Sésame copié !");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      notify.error("Impossible de copier le code.");
    }
  };

  const handleOpen = () => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // État désactivé : Sésame en cours de génération
  if (!url || !code) {
    return (
      <div className={`rounded-card border border-slate-200 bg-slate-50 px-4 py-4 ${className}`}>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Sparkles className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {PRODUCT.SESAME} en cours de génération. Réessayez dans quelques instants.
        </p>
      </div>
    );
  }

  const isHero = variant === "hero";

  return (
    <div
      className={[
        "rounded-card border bg-gradient-to-br shadow-card transition-shadow",
        isHero
          ? "border-amber-200 from-amber-50/80 via-white to-emerald-50/40 p-5 sm:p-6"
          : "border-slate-200 from-white to-slate-50 p-4",
        className,
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-card bg-amber-100 text-amber-700 ${
            isHero ? "h-11 w-11" : "h-9 w-9"
          }`}
        >
          <Share2 className={isHero ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">
            {PRODUCT.SESAME} · Partage candidatures
          </p>
          <h3 className={`mt-1 font-serif font-bold tracking-tight text-slate-900 ${
            isHero ? "text-base sm:text-lg" : "text-sm"
          }`}>
            Comment partager ce bien à un locataire ?
          </h3>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Deux façons selon la situation — toutes les candidatures arrivent dans votre tableau de bord.
          </p>
        </div>
      </div>

      {/* Démarches A et B */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {/* DÉMARCHE A — Partage direct du lien */}
        <div className="flex flex-col rounded-card border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              A
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Partager le lien
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Idéal pour <strong>LeBonCoin</strong>, <strong>WhatsApp</strong>, email ou SMS.
            Le locataire clique et accède au dépôt de dossier.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-pill bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200">
            <Link2 className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate font-mono text-[10px] text-slate-600 sm:text-[11px]">
              {truncateMiddle(url, 36)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={handleCopyLink}
              iconLeft={copiedLink ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            >
              {copiedLink ? "Lien copié" : "Copier le lien"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpen}
              iconLeft={<ExternalLink className="h-3.5 w-3.5" />}
              aria-label="Ouvrir le lien dans un nouvel onglet"
            >
              Ouvrir
            </Button>
          </div>
        </div>

        {/* DÉMARCHE B — Code d'accès */}
        <div className="flex flex-col rounded-card border border-emerald-200 bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
              B
            </span>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Donner le code
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Idéal en <strong>face-à-face</strong> ou par <strong>téléphone</strong>.
            Dictez ce code, le locataire le saisit sur{" "}
            <span className="font-semibold text-emerald-700">getpatrimo.com/acces</span>.
          </p>
          <div className="mt-3 flex items-center justify-center rounded-card bg-emerald-50 px-3 py-3 ring-1 ring-emerald-200">
            <KeyRound className="mr-2 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span className="font-mono text-base font-bold tracking-widest text-emerald-900 sm:text-lg">
              {code}
            </span>
          </div>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={handleCopyCode}
              iconLeft={copiedCode ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            >
              {copiedCode ? "Code copié" : "Copier le code"}
            </Button>
          </div>
        </div>
      </div>

      {/* Pied de carte : explication courte */}
      {isHero && (
        <div className="mt-4 rounded-card bg-slate-50 px-3.5 py-2.5">
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              <strong className="text-slate-700">Bon à savoir :</strong> chaque dossier reçu est
              automatiquement <strong>analysé par l&apos;IA</strong> (Indice de Résilience, Audit Forensic,
              vérification d&apos;identité Didit). Vous recevez les profils prêts à comparer.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
