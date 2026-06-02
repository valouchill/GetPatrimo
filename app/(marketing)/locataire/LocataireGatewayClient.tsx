'use client';

/**
 * <LocataireGatewayClient> — Page passerelle B2C pour les candidats locataires.
 *
 * Deux parcours clairs :
 *   1. Locataire invité → saisit le code/lien de l'annonce, on valide via
 *      /api/public/apply/[token] puis on redirige vers le tunnel /apply/[token].
 *   2. Candidat proactif → crée son Passeport Locatif certifié (inscription
 *      côté locataire : /auth/register?role=tenant).
 *
 * Ambiance volontairement plus accessible que la vue « Banque Privée » owner :
 * fond clair, beaucoup d'air, cartes arrondies, charte émeraude + or conservée.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Fingerprint,
  BadgeCheck,
  Sparkles,
  AlertCircle,
  Home,
} from 'lucide-react';

export default function LocataireGatewayClient() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplissage du code depuis ?code= (liens partagés par le bailleur,
  // ex: /locataire?code=PT-789). Lu côté client, une fois au montage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = new URLSearchParams(window.location.search).get('code');
    if (c) setCode(c.trim());
  }, []);

  // Accepte un code brut OU un lien collé (on extrait le token de /apply/<token>).
  const extractToken = (raw: string): string => {
    const m = raw.match(/\/apply\/([^/?#\s]+)/i);
    return (m ? m[1] : raw).trim();
  };

  const handleAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractToken(code);
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/apply/${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.property) {
        setError(
          'Code introuvable. Vérifiez le code ou le lien fourni par le propriétaire.',
        );
        setLoading(false);
        return;
      }
      // Code valide → tunnel de dépôt des pièces du dossier.
      window.location.href = `/apply/${encodeURIComponent(token)}`;
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      {/* Halos décoratifs doux (ambiance accessible) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[420px] w-[820px] max-w-[120vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(6,78,59,0.10),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-40 -z-10 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl"
      />

      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
        {/* ── Header : logo centré ── */}
        <header className="relative flex items-center justify-center py-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2"
            aria-label="Retour à l'accueil PatrimoTrust"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900">
              <ShieldCheck className="h-5 w-5 text-amber-400" aria-hidden="true" />
            </span>
            <span className="font-serif text-xl font-semibold tracking-tight text-emerald-900">
              PatrimoTrust™
            </span>
          </Link>
          <Link
            href="/"
            className="absolute right-0 hidden items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-emerald-900 sm:inline-flex"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Vous êtes propriétaire ?
          </Link>
        </header>

        {/* ── Titre ── */}
        <div className="mx-auto mt-12 max-w-2xl text-center sm:mt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-800">
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Espace Locataire
          </span>
          <h1 className="mt-5 font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl md:text-5xl">
            Bienvenue sur l’Espace Locataire PatrimoTrust
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Comment pouvons-nous vous aider aujourd’hui&nbsp;?
          </p>
        </div>

        {/* ── Les deux parcours ── */}
        <div className="mx-auto mt-10 grid w-full max-w-4xl flex-1 grid-cols-1 items-stretch gap-6 md:mt-12 md:grid-cols-2">
          {/* Carte 1 — Locataire invité */}
          <section className="flex flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18)] sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <Key className="h-6 w-6 text-slate-600" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-serif text-xl font-bold text-slate-900">
              J’ai été invité par un propriétaire
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              Saisissez le code d’accès de l’annonce ou collez le lien fourni par le
              bailleur pour déposer vos pièces en toute sécurité.
            </p>

            <form onSubmit={handleAccess} className="mt-6 flex flex-1 flex-col justify-end">
              <label htmlFor="access-code" className="sr-only">
                Code de l’annonce
              </label>
              <input
                id="access-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Code de l'annonce (ex: PT-789)"
                autoComplete="off"
                className={`w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:bg-white ${
                  error
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-slate-200 focus:border-emerald-400'
                }`}
                aria-invalid={!!error}
                aria-describedby={error ? 'access-error' : undefined}
              />
              {error && (
                <p
                  id="access-error"
                  className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="group mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Vérification…
                  </>
                ) : (
                  <>
                    Accéder au dossier
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Carte 2 — Candidat proactif (Passeport Locatif) — mise en avant */}
          <section className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-b from-emerald-50/50 to-white p-7 shadow-[0_20px_50px_-18px_rgba(6,78,59,0.30)] sm:p-8">
            <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-amber">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Recommandé
            </span>

            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
              <ShieldCheck className="h-6 w-6 text-emerald-700" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-serif text-xl font-bold text-emerald-900">
              Je veux créer mon Passeport Locatif certifié
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
              Faites vérifier votre identité (eIDAS) et certifier vos revenus par
              notre IA. Obtenez un dossier inattaquable à présenter à tous vos futurs
              propriétaires pour passer en haut de la pile.
            </p>

            <ul className="mt-5 space-y-2.5">
              <li className="flex items-center gap-2.5 text-sm text-slate-600">
                <Fingerprint className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                Identité vérifiée eIDAS (biométrie)
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-600">
                <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                Revenus certifiés par l’IA
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-600">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                Dossier réutilisable, partout
              </li>
            </ul>

            <div className="mt-auto pt-6">
              <Link
                href="/auth/register?role=tenant&mode=codeless"
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-900 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_14px_30px_-12px_rgba(6,78,59,0.5)] transition-all hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                Créer mon dossier universel
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
              <p className="mt-2.5 text-center text-xs text-slate-400">
                Gratuit · sans carte bancaire · 100% conforme RGPD
              </p>
            </div>
          </section>
        </div>

        {/* ── Pied de page léger ── */}
        <footer className="mt-10 flex flex-col items-center gap-2 py-6 text-center text-xs text-slate-400">
          <p>
            Vos données sont chiffrées et hébergées en France. PatrimoTrust est un
            outil d’aide à la décision.
          </p>
          <Link
            href="/"
            className="font-medium text-slate-500 transition-colors hover:text-emerald-900 sm:hidden"
          >
            ← Vous êtes propriétaire&nbsp;?
          </Link>
        </footer>
      </div>
    </main>
  );
}
