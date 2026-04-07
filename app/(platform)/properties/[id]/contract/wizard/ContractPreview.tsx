'use client';

import { useMemo, useState, useCallback } from 'react';
import type { TemplateParagraph, LeaseFormData } from './types';
import { resolveFieldForVariable, isReadonlyVariable } from './fieldRegistry';
import { InlineFieldEditor } from './InlineFieldEditor';
import { InfoBubble } from './InfoBubble';

interface ContractPreviewProps {
  paragraphs: TemplateParagraph[];
  mergeData: Record<string, string>;
  rawData: Record<string, string>;
  isLoading: boolean;
  formData?: LeaseFormData;
  onFieldChange?: (field: string, value: string | number | boolean) => void;
  requiredVarNames?: Set<string>;
}

const MISSING_PATTERNS = ['[ A COMPLETER ]', '..........'];

function isMissing(value: string | undefined): boolean {
  if (!value || value.trim() === '') return true;
  return MISSING_PATTERNS.some((p) => value.includes(p));
}

const VAR_LABELS: Record<string, string> = {
  bailleur_nom_prenom: 'Nom du bailleur',
  bailleur_adresse: 'Adresse du bailleur',
  bailleur_email: 'Email du bailleur',
  bailleur_telephone: 'Tel. du bailleur',
  locataire_nom_prenom: 'Nom du locataire',
  locataire_email: 'Email du locataire',
  locataire_telephone: 'Tel. du locataire',
  surface_habitable_m2: 'Surface habitable',
  nb_pieces_principales: 'Nb. pieces',
  loyer_mensuel: 'Loyer mensuel',
  loyer_chiffres: 'Loyer (chiffres)',
  loyer_lettres: 'Loyer (lettres)',
  loyer_principal_chiffres: 'Loyer principal',
  loyer_principal_lettres: 'Loyer principal (lettres)',
  charges_chiffres: 'Charges (chiffres)',
  charges_lettres: 'Charges (lettres)',
  forfait_charges_mensuel: 'Forfait charges',
  depot_garantie: 'Depot de garantie',
  depot_garantie_chiffres: 'Depot (chiffres)',
  depot_garantie_lettres: 'Depot (lettres)',
  date_debut_location: 'Date debut bail',
  date_effet_bail: 'Date effet bail',
  date_fin_bail: 'Date fin bail',
  duree_bail_mois: 'Duree (mois)',
  paiement_jour_mois: 'Jour de paiement',
  dpe_classe: 'Classe DPE',
  date_dpe: 'Date DPE',
  garant_nom_prenom: 'Nom du garant',
  autres_conditions_particulieres: 'Clauses particulieres',
};

function getVarLabel(name: string): string {
  return VAR_LABELS[name] || name.replace(/_/g, ' ');
}

function isHeading(text: string): boolean {
  const stripped = text.replace(/\{\{[^}]+\}\}/g, '').trim();
  if (stripped.length < 3 || stripped.length > 120) return false;
  return stripped === stripped.toUpperCase() && /[A-Z\u00C0-\u00DC]{3,}/.test(stripped);
}

export function ContractPreview({
  paragraphs,
  mergeData,
  rawData,
  isLoading,
  formData,
  onFieldChange,
  requiredVarNames,
}: ContractPreviewProps) {
  const [activeVar, setActiveVar] = useState<{ name: string; rect: DOMRect } | null>(null);
  const editable = Boolean(formData && onFieldChange);

  const handleVarClick = useCallback((varName: string, e: React.MouseEvent<HTMLSpanElement>) => {
    if (!editable) {
      const el = document.getElementById(`field-${varName}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (isReadonlyVariable(varName)) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setActiveVar({ name: varName, rect });
  }, [editable]);

  const rendered = useMemo(() => {
    return paragraphs.map((para, paraIndex) => {
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

      const segments: React.ReactNode[] = [];
      let lastEnd = 0;

      for (let i = 0; i < variables.length; i++) {
        const v = variables[i];

        if (v.start > lastEnd) {
          segments.push(<span key={`t-${paraIndex}-${i}`}>{text.slice(lastEnd, v.start)}</span>);
        }

        const resolvedValue = mergeData[v.name];
        const rawValue = rawData[v.name];
        const missing = isMissing(rawValue);
        const isRequired = requiredVarNames?.has(v.name) ?? false;
        const isActive = activeVar?.name === v.name;
        const isReadonly = isReadonlyVariable(v.name);
        const tooltip = resolveFieldForVariable(v.name)?.tooltip;

        if (missing) {
          // Missing required = red, missing optional = gray
          const style = isRequired
            ? 'bg-red-50 text-red-600 border border-dashed border-red-300'
            : 'bg-slate-100 text-slate-400 border border-dashed border-slate-300';

          segments.push(
            <span key={`v-${paraIndex}-${i}`} className="inline-flex items-center gap-1">
              <span
                role={editable ? 'button' : undefined}
                tabIndex={editable ? 0 : undefined}
                className={`inline-block rounded px-1.5 py-0.5 text-xs cursor-pointer hover:opacity-80 transition-colors ${style} ${isActive ? 'ring-2 ring-emerald-500' : ''}`}
                onClick={(e) => handleVarClick(v.name, e)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleVarClick(v.name, e as unknown as React.MouseEvent<HTMLSpanElement>); }}
              >
                {getVarLabel(v.name)}
              </span>
              {tooltip && <InfoBubble text={tooltip} />}
            </span>
          );
        } else {
          segments.push(
            <span key={`v-${paraIndex}-${i}`} className="inline-flex items-center gap-1">
              <span
                role={editable && !isReadonly ? 'button' : undefined}
                tabIndex={editable && !isReadonly ? 0 : undefined}
                className={`inline-block rounded px-1 py-0.5 font-medium text-xs transition-colors ${
                  isActive
                    ? 'bg-emerald-200 text-emerald-900 ring-2 ring-emerald-500'
                    : isReadonly
                      ? 'bg-slate-50 text-slate-500'
                      : 'bg-emerald-100 text-emerald-800 cursor-pointer hover:bg-emerald-200'
                }`}
                title={`${getVarLabel(v.name)}: ${resolvedValue}`}
                onClick={(e) => handleVarClick(v.name, e)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleVarClick(v.name, e as unknown as React.MouseEvent<HTMLSpanElement>); }}
              >
                {resolvedValue}
              </span>
              {tooltip && <InfoBubble text={tooltip} />}
            </span>
          );
        }

        lastEnd = v.end;
      }

      if (lastEnd < text.length) {
        segments.push(<span key={`te-${paraIndex}`}>{text.slice(lastEnd)}</span>);
      }

      return (
        <p key={paraIndex} className="text-slate-700 mb-1.5 leading-relaxed">
          {segments}
        </p>
      );
    });
  }, [paragraphs, mergeData, rawData, requiredVarNames, activeVar, editable, handleVarClick]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-slate-500">Chargement du contrat...</p>
        </div>
      </div>
    );
  }

  if (paragraphs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-slate-500">Selectionnez un locataire pour previsualiser le contrat.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10 lg:py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="prose prose-sm max-w-none font-serif text-[13px] leading-relaxed">
          {rendered}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-emerald-100 border border-emerald-200" />
          Rempli
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-red-50 border border-dashed border-red-300" />
          Requis
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded bg-slate-100 border border-dashed border-slate-300" />
          Optionnel
        </div>
        {editable && <span className="text-slate-400">Cliquez sur un champ pour le modifier</span>}
      </div>

      {/* Inline editor */}
      {activeVar && formData && onFieldChange && (
        <InlineFieldEditor
          varName={activeVar.name}
          anchorRect={activeVar.rect}
          formData={formData}
          onFieldChange={onFieldChange}
          onClose={() => setActiveVar(null)}
        />
      )}
    </div>
  );
}
