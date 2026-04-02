'use client';

import { useMemo } from 'react';
import type { TemplateParagraph } from './types';

interface ContractPreviewProps {
  paragraphs: TemplateParagraph[];
  mergeData: Record<string, string>;
  rawData: Record<string, string>;
  isLoading: boolean;
}

const MISSING_PATTERNS = ['[ A COMPLETER ]', '..........', '☐'];

function isMissing(value: string | undefined): boolean {
  if (!value || value.trim() === '') return true;
  return MISSING_PATTERNS.some((p) => value.includes(p));
}

// Map variable names to French labels for display when missing
const VAR_LABELS: Record<string, string> = {
  bailleur_nom_prenom: 'Nom du bailleur',
  bailleur_adresse: 'Adresse du bailleur',
  bailleur_email: 'Email du bailleur',
  bailleur_telephone: 'Tél. du bailleur',
  locataire_nom_prenom: 'Nom du locataire',
  prenom_locataire: 'Prénom du locataire',
  nom_locataire: 'Nom du locataire',
  locataire_email: 'Email du locataire',
  locataire_telephone: 'Tél. du locataire',
  locataire_date_naissance: 'Date de naissance',
  adresse_bien: 'Adresse du bien',
  adresse_ligne_1: 'Adresse ligne 1',
  adresse_ligne_2: 'Adresse ligne 2',
  surface_habitable_m2: 'Surface habitable',
  surface_totale_m2: 'Surface totale',
  nb_pieces_principales: 'Nb. pièces',
  loyer_mensuel: 'Loyer mensuel',
  loyer_chiffres: 'Loyer (chiffres)',
  loyer_lettres: 'Loyer (lettres)',
  loyer_principal_chiffres: 'Loyer principal',
  loyer_principal_lettres: 'Loyer principal (lettres)',
  charges_chiffres: 'Charges (chiffres)',
  charges_lettres: 'Charges (lettres)',
  forfait_charges_mensuel: 'Forfait charges',
  depot_garantie: 'Dépôt de garantie',
  depot_garantie_chiffres: 'Dépôt (chiffres)',
  depot_garantie_lettres: 'Dépôt (lettres)',
  date_debut_location: 'Date début bail',
  date_effet_bail: 'Date effet bail',
  date_fin_bail: 'Date fin bail',
  duree_bail_mois: 'Durée (mois)',
  duree_contrat: 'Durée du contrat',
  paiement_jour_mois: 'Jour de paiement',
  dpe_classe: 'Classe DPE',
  date_dpe: 'Date DPE',
  garant_nom_prenom: 'Nom du garant',
  garant_adresse: 'Adresse du garant',
  garant_date_naissance: 'Date naissance garant',
  autres_conditions_particulieres: 'Clauses particulières',
  periode_construction: 'Période de construction',
  logement_id_fiscal: 'Identifiant fiscal',
};

function getVarLabel(name: string): string {
  return VAR_LABELS[name] || name.replace(/_/g, ' ');
}

function isHeading(text: string): boolean {
  // Short all-caps lines are likely headings
  const stripped = text.replace(/\{\{[^}]+\}\}/g, '').trim();
  if (stripped.length < 3 || stripped.length > 120) return false;
  return stripped === stripped.toUpperCase() && /[A-ZÀ-Ü]{3,}/.test(stripped);
}

function renderParagraph(
  para: TemplateParagraph,
  mergeData: Record<string, string>,
  rawData: Record<string, string>,
  paraIndex: number,
) {
  const { text, variables } = para;

  if (variables.length === 0) {
    const heading = isHeading(text);
    return (
      <p
        key={paraIndex}
        className={heading ? 'font-bold text-sm text-slate-900 mt-5 mb-2' : 'text-slate-700 mb-1.5'}
      >
        {text}
      </p>
    );
  }

  // Build segments: text parts interleaved with variable highlights
  const segments: React.ReactNode[] = [];
  let lastEnd = 0;

  for (let i = 0; i < variables.length; i++) {
    const v = variables[i];

    // Text before this variable
    if (v.start > lastEnd) {
      segments.push(
        <span key={`t-${paraIndex}-${i}`}>{text.slice(lastEnd, v.start)}</span>
      );
    }

    // The variable itself
    const resolvedValue = mergeData[v.name];
    const rawValue = rawData[v.name];
    const missing = isMissing(rawValue);

    if (missing) {
      segments.push(
        <span
          key={`v-${paraIndex}-${i}`}
          className="inline-block bg-slate-100 text-slate-400 rounded px-1.5 py-0.5 border border-dashed border-slate-300 text-xs cursor-pointer hover:bg-slate-200 transition-colors"
          title={`Variable: ${v.name}`}
          onClick={() => {
            const el = document.getElementById(`field-${v.name}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          {getVarLabel(v.name)}
        </span>
      );
    } else {
      segments.push(
        <span
          key={`v-${paraIndex}-${i}`}
          className="inline-block bg-orange-100 text-orange-700 rounded px-1 py-0.5 font-medium text-xs cursor-pointer hover:bg-orange-200 transition-colors"
          title={`${getVarLabel(v.name)}: ${resolvedValue}`}
          onClick={() => {
            const el = document.getElementById(`field-${v.name}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        >
          {resolvedValue}
        </span>
      );
    }

    lastEnd = v.end;
  }

  // Remaining text after last variable
  if (lastEnd < text.length) {
    segments.push(<span key={`te-${paraIndex}`}>{text.slice(lastEnd)}</span>);
  }

  return (
    <p key={paraIndex} className="text-slate-700 mb-1.5 leading-relaxed">
      {segments}
    </p>
  );
}

export function ContractPreview({ paragraphs, mergeData, rawData, isLoading }: ContractPreviewProps) {
  const rendered = useMemo(
    () => paragraphs.map((para, i) => renderParagraph(para, mergeData, rawData, i)),
    [paragraphs, mergeData, rawData],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
          <p className="text-sm text-slate-500">Chargement du contrat...</p>
        </div>
      </div>
    );
  }

  if (paragraphs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-sm text-slate-500">Sélectionnez un locataire pour prévisualiser le contrat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10 lg:py-10">
      {/* Paper appearance */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="prose prose-sm max-w-none font-serif text-[13px] leading-relaxed">
          {rendered}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-orange-100 border border-orange-200" />
          Rempli
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-slate-100 border border-dashed border-slate-300" />
          À compléter
        </div>
        <span className="text-slate-400">Cliquez sur une variable pour aller au champ</span>
      </div>
    </div>
  );
}
