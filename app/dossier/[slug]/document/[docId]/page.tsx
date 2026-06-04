import { notFound } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowRight, FileText, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { PublicSecureDocumentViewerEmbed } from '@/app/components/audit/PublicSecureDocumentViewerEmbed';

interface PageParams {
  slug: string;
  docId: string;
}

interface PublicDocument {
  id: string;
  name: string;
  category?: string | null;
  type?: string | null;
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

interface PublicDocumentResponse {
  slug: string;
  docId: string;
  category: string | null;
  candidate: {
    firstName: string | null;
    lastInitial: string | null;
  };
  score: number;
  grade: string | null;
  propertyName: string | null;
  document: PublicDocument;
}

async function fetchDocument(
  slug: string,
  docId: string,
): Promise<PublicDocumentResponse | null> {
  try {
    const hdrs = await headers();
    const host = hdrs.get('host') || 'doc2loc.com';
    const proto = hdrs.get('x-forwarded-proto') || 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;

    const res = await fetch(
      `${baseUrl}/api/public/dossier/${encodeURIComponent(slug)}/document/${encodeURIComponent(docId)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicDocumentResponse;
  } catch {
    return null;
  }
}

function getCategoryLabel(category?: string | null): string {
  switch (String(category || '').toUpperCase()) {
    case 'IDENTITY':
      return "Pièce d'identité";
    case 'INCOME':
      return 'Revenus & solvabilité';
    case 'ADDRESS':
      return 'Justificatif de domicile';
    case 'GUARANTOR':
      return 'Document garant';
    default:
      return 'Document du dossier';
  }
}

export const metadata = {
  title: 'Document sécurisé — PatrimoTrust',
  description: 'Consultez un aperçu scellé et filigrané d’une pièce du passeport locataire.',
};

export default async function PublicDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { slug, docId } = await params;
  const search = await searchParams;
  const dossier = await fetchDocument(slug, docId);

  if (!dossier) {
    notFound();
  }

  const categoryLabel = getCategoryLabel(dossier.category);
  const utm = new URLSearchParams();
  Object.entries(search || {}).forEach(([key, value]) => {
    if (key.startsWith('utm_') && typeof value === 'string') utm.set(key, value);
  });
  if (!utm.has('utm_source')) utm.set('utm_source', 'passport_pdf_document');
  if (!utm.has('utm_campaign')) utm.set('utm_campaign', 'owner_acq');
  utm.set('utm_content', dossier.slug);

  const signupUrl = `/auth/register?role=owner&${utm.toString()}`;
  const loginUrl = `/auth/login?${utm.toString()}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-900 font-serif text-base font-bold text-amber-500">
              PT
            </div>
            <div className="min-w-0">
              <p className="font-serif text-lg font-bold text-emerald-900">
                PatrimoTrust
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Document locataire scellé
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
        <section className="mb-8 grid gap-6 sm:grid-cols-[1fr_220px] sm:gap-8">
          <div className="min-w-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Accès sécurisé · {categoryLabel}
            </p>
            <h1 className="font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl">
              {dossier.document.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Pièce transmise par {dossier.candidate.firstName || 'le candidat'}{' '}
              {dossier.candidate.lastInitial || ''}.
              {dossier.propertyName ? (
                <>
                  {' '}Candidature pour <strong>{dossier.propertyName}</strong>.
                </>
              ) : null}
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
              <span className="mt-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">
                GRADE {dossier.grade}
              </span>
            )}
          </div>
        </section>

        <section className="mb-8 overflow-hidden rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white p-6 shadow-md sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800 ring-1 ring-amber-300">
                <Sparkles className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                Aperçu scellé
              </div>
              <h2 className="font-serif text-2xl font-bold leading-tight text-emerald-900 sm:text-3xl">
                Consultez l’audit, pas le fichier brut.
              </h2>
              <p className="mt-2 text-sm text-slate-700 sm:text-base">
                Pour protéger les données personnelles du locataire, cette page
                affiche un aperçu forensic contrôlé. Les originaux restent dans
                le coffre-fort sécurisé.
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
              Fichier original masqué
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4 flex-shrink-0 text-emerald-700" aria-hidden="true" />
              Consultation tracée
            </span>
          </div>
        </section>

        <section className="space-y-4">
          <header className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Audit Forensic IA · Document précis
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-emerald-900">
              Aperçu sécurisé
            </h2>
          </header>
          <PublicSecureDocumentViewerEmbed document={dossier.document} />
        </section>

        <footer className="mt-10 text-center text-[11px] text-slate-500">
          <p>
            Document scellé · Toute consultation est tracée pour la sécurité du candidat
          </p>
          <p className="mt-1 font-semibold uppercase tracking-[0.18em]">
            PatrimoTrust · doc2loc.com
          </p>
        </footer>
      </main>
    </div>
  );
}
