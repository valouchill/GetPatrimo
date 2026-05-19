"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  KeyRound,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { Button } from "@/app/components/ui";
import { PRODUCT } from "@/lib/product-lexicon";

// Normalise un code : supprime espaces, met en majuscules, garantit le format PT-XXXXX-XXXX
function normalizeCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[–—_]/g, "-");
}

// Validation format : PT-XXXXX-XXXX (PT, 5 chiffres, 4 caractères alphanumériques)
function isValidCodeFormat(code: string): boolean {
  return /^PT-\d{5}-[A-Z0-9]{4}$/.test(code);
}

export default function AccessCodeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const initialCode = params?.get("code") || "";

  const [code, setCode] = React.useState(initialCode);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Auto-submit si code valide pré-rempli via querystring
  React.useEffect(() => {
    if (initialCode && isValidCodeFormat(normalizeCode(initialCode))) {
      const normalized = normalizeCode(initialCode);
      setCode(normalized);
      // ne pas auto-submit pour laisser l'utilisateur confirmer
    }
  }, [initialCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeCode(code);
    setError(null);

    if (!normalized) {
      setError("Veuillez saisir un code.");
      return;
    }

    if (!isValidCodeFormat(normalized)) {
      setError(
        "Format invalide. Le code doit ressembler à PT-75011-A3X8 (le propriétaire vous l'a transmis).",
      );
      return;
    }

    setLoading(true);
    // Pas besoin de vérifier côté API ici : la route /apply/[id] gère l'erreur
    // si le code n'existe pas. On redirige directement.
    router.push(`/apply/${normalized}`);
  };

  const handleChange = (value: string) => {
    setCode(value);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-emerald-50/30 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-700"
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold">PatrimoTrust</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-modal border border-slate-200 bg-white p-6 shadow-premium sm:p-8"
        >
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <KeyRound className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">
              Espace candidat
            </p>
            <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Accéder à ma candidature
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Saisissez le code <strong>{PRODUCT.SESAME}</strong> que votre propriétaire vous a
              transmis. Vous accéderez au dépôt de dossier sécurisé.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="access-code"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Code d'accès
              </label>
              <div className="relative">
                <input
                  id="access-code"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="PT-75011-A3X8"
                  value={code}
                  onChange={(e) => handleChange(e.target.value)}
                  className={[
                    "w-full rounded-input border bg-white px-4 py-4 text-center font-mono text-lg font-bold tracking-widest text-emerald-900 transition-colors placeholder:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                    error
                      ? "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500"
                      : "border-slate-200 hover:border-slate-300 focus-visible:border-amber-500 focus-visible:ring-amber-500",
                  ].join(" ")}
                  aria-invalid={error ? "true" : "false"}
                  aria-describedby={error ? "code-error" : "code-help"}
                  autoFocus
                />
              </div>
              {error ? (
                <p
                  id="code-error"
                  className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ) : (
                <p id="code-help" className="mt-2 text-xs text-slate-500">
                  Format : <span className="font-mono">PT-XXXXX-XXXX</span> · les espaces et minuscules sont automatiquement corrigés.
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              iconRight={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
            >
              {loading ? "Vérification…" : "Accéder à ma candidature"}
            </Button>
          </form>

          {/* Sécurité */}
          <div className="mt-6 flex items-start gap-2 rounded-card bg-emerald-50 px-3.5 py-3 ring-1 ring-emerald-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <p className="text-[11px] leading-snug text-emerald-900">
              <strong>Vos données sont protégées :</strong> les documents soumis sont chiffrés et
              uniquement visibles par votre propriétaire et vous. RGPD · Audit Forensic ·
              vérification d'identité Didit.
            </p>
          </div>
        </motion.div>

        {/* Aide */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p className="flex flex-wrap items-center justify-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-600" aria-hidden="true" />
            <span>Pas de code ? Demandez-le à votre propriétaire</span>
            <span>·</span>
            <Link
              href="/"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Retour à l'accueil
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
