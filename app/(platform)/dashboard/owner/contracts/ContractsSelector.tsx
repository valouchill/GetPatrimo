/**
 * ContractsSelector — Liste des contractualisations en cours.
 *
 * Affichée sur /dashboard/owner/contracts quand 2+ Properties de
 * l'owner ont un acceptedTenantId. Chaque carte mène vers la page
 * dédiée du bail (/dashboard/owner/lease/[applicationId]).
 */

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, ScrollText, User } from 'lucide-react';

interface Contract {
  propertyId: string;
  applicationId: string;
  candidateName: string;
  propertyAddress: string;
}

export interface ContractsSelectorProps {
  contracts: Contract[];
}

export function ContractsSelector({
  contracts,
}: ContractsSelectorProps): React.ReactElement {
  return (
    // V7.7 — Conteneur OwnerShell-friendly
    <div className="max-w-5xl mx-auto w-full p-6 lg:p-8 space-y-8">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <header>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <ScrollText className="h-3 w-3" aria-hidden="true" />
            Module de contractualisation
          </div>
          <h1 className="font-serif text-3xl leading-tight text-emerald-900 sm:text-4xl">
            Baux &amp; Contrats
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            {contracts.length} contractualisations en cours. Sélectionnez
            un dossier pour accéder au plan de travail correspondant.
          </p>
        </header>

        {/* ─── Liste des dossiers ─────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          {contracts.map((c) => (
            <Link
              key={c.applicationId}
              href={`/dashboard/owner/lease/${c.applicationId}`}
              className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-amber-400">
                  <User className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Candidat retenu
                  </p>
                  <p className="mt-0.5 truncate font-serif text-base font-semibold text-emerald-900">
                    {c.candidateName}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <Building2
                  className="h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span className="truncate">{c.propertyAddress}</span>
              </div>

              <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-700 transition-colors group-hover:text-emerald-900">
                Reprendre la préparation du bail
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
            </Link>
          ))}
        </div>
    </div>
  );
}
