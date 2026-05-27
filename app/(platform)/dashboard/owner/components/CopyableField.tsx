'use client';

/**
 * <CopyableField> — Ligne label / valeur / bouton copier.
 *
 * Utilisé dans le Registre des Informations du Dossier (LeasePreparationPage).
 * Au clic, la valeur est copiée dans le presse-papier, l'icône Copy se
 * transforme en Check vert pendant 2 secondes, et un toast de succès
 * via useNotification est déclenché.
 *
 * Charte : label en gris clair, valeur en émeraude (font-semibold), bouton
 * outline discret. Whitespace généreux pour un rendu "banque privée".
 */

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { useNotification } from '@/app/hooks/useNotification';

export interface CopyableFieldProps {
  /** Libellé court à gauche (ex: "Adresse du bien") */
  label: string;
  /** Valeur à copier (texte affiché en gras + payload du clipboard) */
  value: string;
  /** Nom personnalisé pour le toast (defaults à `label`) */
  toastLabel?: string;
  /** Désactive le bouton (champ non rempli, valeur manquante…) */
  disabled?: boolean;
}

export function CopyableField({
  label,
  value,
  toastLabel,
  disabled = false,
}: CopyableFieldProps): React.ReactElement {
  const notify = useNotification();
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoyage du timer si le composant est démonté pendant l'animation
  React.useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = React.useCallback(async (): Promise<void> => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify.success(`${toastLabel ?? label} copié${endsWithVowel(toastLabel ?? label) ? 'e' : ''} !`);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error('Impossible de copier — accordez la permission au navigateur.');
    }
  }, [disabled, label, notify, toastLabel, value]);

  return (
    <div className="group flex items-center justify-between gap-4 border-b border-slate-100 px-1 py-3 last:border-b-0">
      {/* Label */}
      <div className="flex-shrink-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
      </div>

      {/* Valeur + bouton (alignés à droite, valeur tronquée si très longue) */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <p
          className="truncate text-right text-base font-semibold text-emerald-900"
          title={value}
        >
          {value}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          disabled={disabled}
          aria-label={`Copier ${label}`}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
            copied
              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
              : 'border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

/** Petite heuristique pour accorder le toast au féminin si le label se termine
 * en "e" muet (ex: "Adresse copiée"). Imparfaite mais suffisante pour ce V1. */
function endsWithVowel(s: string): boolean {
  const last = s.trim().toLowerCase().slice(-1);
  return last === 'e';
}
