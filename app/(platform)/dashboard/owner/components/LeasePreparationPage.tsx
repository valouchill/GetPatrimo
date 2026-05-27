'use client';

/**
 * LeasePreparationPage — Plan de travail V1 du module de contractualisation.
 *
 * Pour cette V1, pas de génération PDF pré-rempli. On propose :
 *   1. Téléchargement du modèle ALUR vierge (PDF + DOCX)
 *   2. Registre structuré de toutes les infos du dossier (Actif / Locataire /
 *      Garant) avec un bouton "Copier" rapide sur chaque champ
 *
 * Charte "Banque Privée de l'Immobilier" : émeraude profond + or brossé +
 * fond gris perle + titres serif + whitespace généreux.
 *
 * Wiring backend prévu en V2 : props pour passer les vraies données depuis
 * une candidature sélectionnée (`Application` + `Property`).
 */

import * as React from 'react';
import {
  Building2,
  Check,
  Download,
  FileSignature,
  FileText,
  Files,
  ShieldCheck,
  User,
} from 'lucide-react';
import { CopyableField } from './CopyableField';
import { useNotification } from '@/app/hooks/useNotification';

// ─── Types des données du registre ────────────────────────────────────────

export interface LeaseAssetData {
  address: string;
  type: string;
  rentMain: string;
  rentCharges: string;
}

export interface LeaseTenantData {
  fullName: string;
  birthInfo: string;
  proSituation: string;
  certifiedIncome: string;
}

export interface LeaseGuarantorData {
  fullName: string;
  address: string;
  certifiedIncome: string;
}

export interface LeasePreparationData {
  asset: LeaseAssetData;
  tenant: LeaseTenantData;
  guarantor: LeaseGuarantorData;
}

/**
 * Données démo de la V1 (hardcoded). En V2, on les remplacera par des props
 * issues d'une candidature réelle via le mapping Application → ces 3 blocs.
 */
export const DEMO_LEASE_DATA: LeasePreparationData = {
  asset: {
    address: '14 Rue de la République, 69002 Lyon',
    type: 'Appartement T3 — 65 m²',
    rentMain: '1 100 € / mois',
    rentCharges: '150 € / mois',
  },
  tenant: {
    fullName: 'Valentin Vettese',
    birthInfo: '12/04/1995 à Paris',
    proSituation: 'CDI — TechSolutions France SAS',
    certifiedIncome: '2 800 € / mois',
  },
  guarantor: {
    fullName: 'Pierre Vettese',
    address: '45 Avenue Foch, 75116 Paris',
    certifiedIncome: '6 200 € / mois',
  },
};

// ─── Sous-composants ──────────────────────────────────────────────────────

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: SectionCardProps): React.ReactElement {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50/40 px-6 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-amber-400 shadow-sm">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-lg leading-tight text-emerald-900">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      <div className="px-6 py-2">{children}</div>
    </section>
  );
}

interface TemplateCardProps {
  format: 'PDF' | 'DOCX';
  title: string;
  subtitle: string;
  href: string;
  variant: 'emerald' | 'gold';
  filename: string;
}

function TemplateCard({
  format,
  title,
  subtitle,
  href,
  variant,
  filename,
}: TemplateCardProps): React.ReactElement {
  const notify = useNotification();
  const onClick = React.useCallback(() => {
    // Note : la balise <a download> gère la création du fichier. On déclenche
    // un toast pour confirmer l'intention même si la ressource n'est pas
    // encore en place (la team peut uploader le PDF/DOCX dans /public/templates/).
    notify.info(
      `Téléchargement de ${filename} — vérifiez que la ressource est publiée.`,
    );
  }, [filename, notify]);

  const buttonClasses =
    variant === 'emerald'
      ? 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2'
      : 'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-500 bg-white px-5 py-3 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2';

  const iconBgClasses =
    variant === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';

  const FormatIcon = format === 'PDF' ? FileText : Files;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBgClasses}`}
        >
          <FormatIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-serif text-base font-semibold text-emerald-900">
            {title}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>
      <a
        href={href}
        download={filename}
        onClick={onClick}
        className={`${buttonClasses} shrink-0`}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Télécharger
      </a>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────

export interface LeasePreparationPageProps {
  /** Données pré-remplies (par défaut : données de démo V1) */
  data?: LeasePreparationData;
  /** Chemin du modèle PDF (à uploader dans /public/templates/) */
  pdfTemplateHref?: string;
  /** Chemin du modèle DOCX (à uploader dans /public/templates/) */
  docxTemplateHref?: string;
}

export function LeasePreparationPage({
  data = DEMO_LEASE_DATA,
  pdfTemplateHref = '/templates/bail-alur.pdf',
  docxTemplateHref = '/templates/bail-alur.docx',
}: LeasePreparationPageProps): React.ReactElement {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* ─── Header ───────────────────────────────────────────────── */}
        <header className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <FileSignature className="h-3 w-3" aria-hidden="true" />
            Module de contractualisation · V1
          </div>
          <h1 className="font-serif text-3xl leading-tight text-emerald-900 sm:text-4xl">
            Préparation de votre Contrat de Bail
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Téléchargez le modèle ALUR officiel puis utilisez le registre
            ci-dessous pour reporter chaque information du dossier en un clic.
            Cette version vous accompagne dans la rédaction manuelle ; la
            génération automatique du contrat arrivera prochainement.
          </p>
        </header>

        {/* ─── Zone de téléchargement ───────────────────────────────── */}
        <section className="mb-12">
          <h2 className="mb-4 font-serif text-xl text-emerald-900">
            Modèle officiel de bail (Loi ALUR)
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TemplateCard
              format="PDF"
              title="Modèle Officiel Loi ALUR"
              subtitle="Format PDF · prêt à imprimer ou signer numériquement"
              href={pdfTemplateHref}
              filename="bail-alur.pdf"
              variant="emerald"
            />
            <TemplateCard
              format="DOCX"
              title="Modèle Modifiable"
              subtitle="Format Word · éditez les clauses spécifiques"
              href={docxTemplateHref}
              filename="bail-alur.docx"
              variant="gold"
            />
          </div>
        </section>

        {/* ─── Registre des informations ────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl text-emerald-900">
              Registre des Informations du Dossier
            </h2>
            <span className="hidden text-xs text-slate-500 sm:inline">
              Cliquez sur l’icône <Check className="inline h-3 w-3" /> pour
              copier chaque valeur
            </span>
          </div>

          <div className="space-y-5">
            {/* Bloc 1 — Actif immobilier */}
            <SectionCard
              icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
              title="L’Actif Immobilier"
              subtitle="Localisation, typologie et conditions financières du bien."
            >
              <CopyableField
                label="Adresse du bien"
                value={data.asset.address}
                toastLabel="Adresse"
              />
              <CopyableField
                label="Type de bien"
                value={data.asset.type}
                toastLabel="Type"
              />
              <CopyableField
                label="Loyer principal"
                value={data.asset.rentMain}
                toastLabel="Loyer"
              />
              <CopyableField
                label="Charges récupérables"
                value={data.asset.rentCharges}
                toastLabel="Charges"
              />
            </SectionCard>

            {/* Bloc 2 — Locataire principal */}
            <SectionCard
              icon={<User className="h-5 w-5" aria-hidden="true" />}
              title="Le Locataire Principal"
              subtitle="État civil, situation professionnelle et revenus certifiés."
            >
              <CopyableField
                label="Nom complet"
                value={data.tenant.fullName}
                toastLabel="Nom"
              />
              <CopyableField
                label="Date et lieu de naissance"
                value={data.tenant.birthInfo}
                toastLabel="Naissance"
              />
              <CopyableField
                label="Situation pro / Employeur"
                value={data.tenant.proSituation}
                toastLabel="Situation"
              />
              <CopyableField
                label="Revenus certifiés"
                value={data.tenant.certifiedIncome}
                toastLabel="Revenu"
              />
            </SectionCard>

            {/* Bloc 3 — Caution / Garant */}
            <SectionCard
              icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
              title="La Caution / Le Garant"
              subtitle="Personne physique se portant garante du locataire."
            >
              <CopyableField
                label="Nom complet du garant"
                value={data.guarantor.fullName}
                toastLabel="Nom"
              />
              <CopyableField
                label="Adresse du garant"
                value={data.guarantor.address}
                toastLabel="Adresse"
              />
              <CopyableField
                label="Revenus certifiés du garant"
                value={data.guarantor.certifiedIncome}
                toastLabel="Revenu"
              />
            </SectionCard>
          </div>
        </section>

        {/* ─── Footer informatif ────────────────────────────────────── */}
        <footer className="mt-12 rounded-xl border border-slate-200 bg-white px-6 py-4 text-xs leading-relaxed text-slate-500">
          <span className="font-semibold text-emerald-900">À venir.</span>{' '}
          La génération automatique du bail pré-rempli depuis le dossier sélectionné
          arrivera dans une prochaine version. Cette page V1 vous offre un plan
          de travail pour gagner du temps lors de la rédaction manuelle.
        </footer>
      </div>
    </div>
  );
}
