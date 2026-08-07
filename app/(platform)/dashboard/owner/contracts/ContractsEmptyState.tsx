/**
 * ContractsEmptyState — Vue "aucune contractualisation en cours".
 *
 * Affiché sur /dashboard/owner/contracts quand aucune Property de
 * l'owner n'a d'acceptedTenantId. Charte banque privée :
 *   - Émeraude profond pour le titre
 *   - Encadré gris perle bg-slate-50 + border slate-200 + rounded-2xl
 *   - Whitespace généreux (p-12, py-14)
 *   - CTA primaire emerald-900 vers le dashboard candidatures
 *   - Section secondaire : téléchargement libre des modèles ALUR
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Download, FileText, Files, ScrollText } from 'lucide-react';
import { useNotification } from '@/app/hooks/useNotification';

export function ContractsEmptyState(): React.ReactElement {
  const notify = useNotification();
  const notifyDownload = (filename: string): void => {
    notify.info(`Téléchargement de ${filename} lancé.`);
  };

  return (
    // V7.7 — Conteneur OwnerShell-friendly (sidebar a gauche)
    <div className="max-w-5xl mx-auto w-full p-6 lg:p-8 space-y-8">
        {/* ─── Titre ─────────────────────────────────────────────── */}
        <header>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <ScrollText className="h-3 w-3" aria-hidden="true" />
            Module de contractualisation
          </div>
          <h1 className="font-serif text-3xl leading-tight text-emerald-900 sm:text-4xl">
            Baux &amp; Contrats
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Centre de préparation des contrats de bail pour vos biens. Les
            dossiers candidats retenus apparaissent ici pour vous fournir
            un plan de travail clé en main.
          </p>
        </header>

        {/* ─── Encadré central "Aucune contractualisation en cours" ─ */}
        <section>
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm sm:p-14">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-amber-400">
              <ScrollText className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="font-serif text-xl text-emerald-900 sm:text-2xl">
              Aucune contractualisation en cours
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Sélectionnez un candidat depuis votre tableau de bord pour
              débloquer la préparation du bail. Vous y retrouverez ensuite
              toutes les informations utiles, prêtes à coller dans le
              modèle officiel.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard/owner"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
              >
                Voir mes candidatures
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Section secondaire — Téléchargement libre des modèles ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            Libre-service
          </div>
          <h3 className="font-serif text-lg text-emerald-900 sm:text-xl">
            Vous souhaitez préparer un contrat manuellement ?
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Téléchargez le modèle officiel Loi ALUR vierge — utile pour les
            avenants, renouvellements ou cas particuliers.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a
              href="/templates/bail-vide.docx"
              download="bail-vide.docx"
              onClick={() => notifyDownload('bail-vide.docx')}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <FileText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm font-semibold text-emerald-900">
                  Modèle Officiel Loi ALUR
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  Word (.docx) · prêt à compléter
                </p>
              </div>
              <Download
                className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-emerald-700"
                aria-hidden="true"
              />
            </a>
            <a
              href="/templates/bail-vide.docx"
              download="bail-vide.docx"
              onClick={() => notifyDownload('bail-vide.docx')}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                <Files className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm font-semibold text-emerald-900">
                  Modèle Modifiable
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  Word · clauses personnalisables
                </p>
              </div>
              <Download
                className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-amber-700"
                aria-hidden="true"
              />
            </a>
          </div>
        </section>
    </div>
  );
}
