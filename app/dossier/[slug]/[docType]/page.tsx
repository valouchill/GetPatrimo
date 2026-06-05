/**
 * Page publique de réception des Smart Links du Passeport Locatif V2.
 *
 * Route : /dossier/[slug]/[docType]
 * Accessible sans auth → mécanique d'acquisition forcée.
 *
 * Le propriétaire prospect arrive ici depuis un lien du PDF distribué.
 * Il voit :
 *   - L'aperçu synthétique IA (filigrane, métadonnées, extracted fields)
 *   - Un CTA dominant "Créer mon Coffre-Fort gratuit"
 *   - Bandeau bas "Inscrivez-vous pour voir TOUTES les pièces"
 *
 * La pièce originale (PDF/image) n'est jamais exposée — seules les
 * données extraites par l'IA sont visibles. Cela permet de démontrer la
 * valeur sans risque de fuite du document brut.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Sparkles, AlertCircle, FileText, Lock, Crown } from 'lucide-react';
import { headers } from 'next/headers';
import { SecureDocumentViewerEmbed } from './SecureDocumentViewerEmbed';

interface PageParams {
  slug: string;
  docType: string;
}

interface PublicDocument {
  id: string;
  name: string;
  category?: string;
  auditStatus: 'verified' | 'manual_review' | 'altered' | 'pending';
  url: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  dateEmission: string | null;
  aiInsights?: {
    documentType?: string | null;
    confidence?: number | null;
    summary?: string | null;
    fraudScore?: number | null;
    flags?: string[];
    extractedFields?: Record<string, unknown>;
  };
}

interface PublicDossierResponse {
  slug: string;
  docType: string;
  category: string;
  candidate: {
    firstName: string | null;
    lastInitial: string | null;
    fullName?: string;
  };
  score: number;
  grade: string | null;
  propertyName: string | null;
  documents: PublicDocument[];
}

async function fetchDossier(
  slug: string,
  docType: string,
): Promise<PublicDossierResponse | null> {
  try {
    // Construction de l'URL absolue côté server (Next.js Server Component)
    const hdrs = await headers();
    const host = hdrs.get('host') || 'getpatrimo.com';
    const proto = hdrs.get('x-forwarded-proto') || 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    const res = await fetch(
      `${baseUrl}/api/public/dossier/${encodeURIComponent(slug)}/${encodeURIComponent(docType)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicDossierResponse;
  } catch {
    return null;
  }
}

function getCategoryLabel(category: string): string {
  switch (category.toUpperCase()) {
    case 'IDENTITY':
      return "Pièce d'identité";
    case 'INCOME':
      return 'Revenus & Solvabilité';
    case 'ADDRESS':
      return 'Justificatif de domicile';
    case 'GUARANTOR':
      return 'Documents du garant';
    default:
      return 'Document';
  }
}

export const metadata = {
  title: 'Passeport Locatif — getpatrimo',
  description:
    'Consultez les pièces sécurisées du dossier candidat. Inscription gratuite pour accéder à l\'intégralité.',
};

export default async function PublicDossierPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { slug, docType } = await params;
  const search = await searchParams;
  const dossier = await fetchDossier(slug, docType);

  if (!dossier) {
    notFound();
  }

  const categoryLabel = getCategoryLabel(dossier.category);
  const documentCount = dossier.documents.length;

  // UTM forwarding pour traquer l'attribution conversion
  const utm = new URLSearchParams();
  Object.entries(search || {}).forEach(([k, v]) => {
    if (k.startsWith('utm_') && typeof v === 'string') utm.set(k, v);
  });
  // Garantir au moins ces UTM minimum
  if (!utm.has('utm_source')) utm.set('utm_source', 'passport_pdf_link');
  if (!utm.has('utm_campaign')) utm.set('utm_campaign', 'owner_acq');
  utm.set('utm_content', slug);

  const signupUrl = `/auth/register?role=owner&${utm.toString()}`;
  const loginUrl = `/auth/login?${utm.toString()}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Header public ────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-900 font-serif text-base font-bold text-amber-500">
              PT
            </div>
            <div className="min-w-0">
              <p className="font-serif text-lg font-bold text-emerald-900">
                getpatrimo
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Passeport Locatif Certifié
              </p>
            </div>
          </div>
          <Link
            href={loginUrl}
            className="text-xs font-semibold text-slate-600 hover:text-emerald-900"
          >
            Déjà inscrit ? Se connecter →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {/* ─── Hero : intro + score badge ──────────────────────────── */}
        <section className="mb-8 grid gap-6 sm:grid-cols-[1fr_220px] sm:gap-8">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Accès sécurisé · {categoryLabel}
            </p>
            <h1 className="font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl">
              Pièces du candidat {dossier.candidate.firstName}{' '}
              {dossier.candidate.lastInitial || ''}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {dossier.propertyName ? (
                <>
                  Candidature pour <strong>{dossier.propertyName}</strong>.{' '}
                </>
              ) : null}
              {documentCount > 0
                ? `${documentCount} pièce${documentCount > 1 ? 's' : ''} analysée${documentCount > 1 ? 's' : ''} par notre IA Forensic — aperçu ci-dessous.`
                : 'Aucune pièce analysée dans cette catégorie.'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-5 py-5 text-center text-white shadow-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400">
              Indice de Résilience
            </p>
            <p className="font-serif text-5xl font-bold leading-none text-amber-400">
              {dossier.score}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              sur 100
            </p>
            {dossier.grade && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">
                <Crown className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                GRADE {dossier.grade}
              </span>
            )}
          </div>
        </section>

        {/* ─── CTA primaire en haut (acquisition) ───────────────────── */}
        <section className="mb-10 overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white p-6 shadow-md sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800 ring-1 ring-amber-300">
                <Sparkles className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                Acquisition prioritaire
              </div>
              <h2 className="font-serif text-2xl font-bold leading-tight text-emerald-900 sm:text-3xl">
                Ne laissez pas passer ce dossier.
              </h2>
              <p className="mt-2 text-sm text-slate-700 sm:text-base">
                Connectez-vous pour ajouter ce candidat à votre sélection,
                générer le bail loi ALUR en 3 clics, et accéder au coffre-fort
                numérique. <strong>Premier mois offert.</strong>
              </p>
            </div>
            <Link
              href={signupUrl}
              className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-emerald-900 shadow-md transition-colors hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 sm:text-base"
            >
              Créer mon Coffre-Fort
              <ArrowRight className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-amber-200 pt-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-700" aria-hidden="true" />
              Conforme RGPD &amp; ALUR
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 flex-shrink-0 text-emerald-700" aria-hidden="true" />
              Pièces filigranées
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4 flex-shrink-0 text-emerald-700" aria-hidden="true" />
              Sans engagement — 2 min
            </span>
          </div>
        </section>

        {/* ─── Documents (aperçu IA filigranée) ─────────────────────── */}
        {documentCount === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 flex-shrink-0 text-amber-600" aria-hidden="true" />
            <h3 className="font-serif text-xl font-semibold text-emerald-900">
              Aucune pièce dans cette catégorie
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-500 mx-auto">
              Le candidat n&apos;a pas encore transmis de pièce de type{' '}
              {categoryLabel.toLowerCase()}. Inscrivez-vous pour suivre les
              prochains envois.
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            <header className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                Audit Forensic IA · Catégorie {categoryLabel}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-emerald-900">
                Pièces analysées ({documentCount})
              </h2>
            </header>

            {dossier.documents.map((doc, idx) => (
              <SecureDocumentViewerEmbed key={doc.id || idx} document={doc} />
            ))}
          </section>
        )}

        {/* ─── Bandeau bas : conversion finale ─────────────────────── */}
        <section className="mt-12 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 to-emerald-800 p-8 text-white shadow-xl sm:p-10">
          <div className="text-center">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400">
              Vous êtes propriétaire ?
            </p>
            <h2 className="font-serif text-3xl font-bold leading-tight sm:text-4xl">
              Recevez vos candidatures déjà auditées.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-emerald-100 sm:text-base">
              Plus de dossiers incomplets. Plus de pièces à vérifier
              manuellement. Vos candidats passent par getpatrimo avant
              d&apos;arriver sur votre bureau — vous ne consultez que les profils
              déjà notés, certifiés et scellés.
            </p>
            <div className="mt-6">
              <Link
                href={signupUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-4 text-base font-bold text-emerald-900 shadow-lg transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900"
              >
                Créer mon Coffre-Fort gratuit
                <ArrowRight className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              </Link>
              <p className="mt-3 text-xs italic text-emerald-200">
                Gratuit · sans carte bancaire · 2 minutes
              </p>
            </div>
          </div>
        </section>

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <footer className="mt-10 text-center text-[11px] text-slate-500">
          <p>
            Document scellé · Toute consultation est tracée pour la sécurité du
            candidat
          </p>
          <p className="mt-1 font-semibold uppercase tracking-[0.18em]">
            getpatrimo · getpatrimo.com
          </p>
        </footer>
      </main>
    </div>
  );
}
