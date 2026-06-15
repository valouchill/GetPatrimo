'use client';

/**
 * <ConsentCheckboxes> — cases de consentement RGPD à la création de compte.
 * Réutilisé par le formulaire d'inscription (propriétaire + locataire) et par
 * le tunnel de candidature. Une seule source de vérité : lib/legal/consent.ts.
 *
 * - Case 1 (terms) : CGU + CGV + confidentialité — OBLIGATOIRE (bloque la soumission).
 * - Case 2 (marketing) : communications commerciales Maison Patrimo — optionnel.
 * - Case 3 (partner) : partage à des partenaires à des fins commerciales — optionnel.
 */

import Link from 'next/link';

import { CONSENT_LINKS, type ConsentValues } from '@/lib/legal/consent';

interface ConsentCheckboxesProps {
  values: ConsentValues;
  onChange: (values: ConsentValues) => void;
  variant?: 'owner' | 'tenant';
  className?: string;
}

export function ConsentCheckboxes({
  values,
  onChange,
  variant = 'owner',
  className = '',
}: ConsentCheckboxesProps) {
  const set = (key: keyof ConsentValues, v: boolean) =>
    onChange({ ...values, [key]: v });

  // Classes statiques (Tailwind purge les classes interpolées dynamiquement).
  const checkboxCls =
    variant === 'tenant'
      ? 'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500'
      : 'mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-amber-600 focus:ring-amber-500';
  const linkCls =
    variant === 'tenant'
      ? 'font-semibold text-emerald-700 underline hover:text-emerald-800'
      : 'font-semibold text-amber-700 underline hover:text-amber-800';

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={values.terms}
          onChange={(e) => set('terms', e.target.checked)}
          required
          aria-required="true"
          className={checkboxCls}
        />
        <span className="text-sm leading-snug text-slate-700">
          J&apos;accepte les{' '}
          <Link href={CONSENT_LINKS.cgu} target="_blank" rel="noopener noreferrer" className={linkCls}>
            CGU
          </Link>
          , les{' '}
          <Link href={CONSENT_LINKS.cgv} target="_blank" rel="noopener noreferrer" className={linkCls}>
            CGV
          </Link>{' '}
          et la{' '}
          <Link href={CONSENT_LINKS.privacy} target="_blank" rel="noopener noreferrer" className={linkCls}>
            politique de confidentialité
          </Link>
          .<span className="text-rose-500"> *</span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={values.marketing}
          onChange={(e) => set('marketing', e.target.checked)}
          className={checkboxCls}
        />
        <span className="text-sm leading-snug text-slate-600">
          J&apos;accepte de recevoir les communications commerciales de Maison Patrimo
          (offres, actualités).
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={values.partner}
          onChange={(e) => set('partner', e.target.checked)}
          className={checkboxCls}
        />
        <span className="text-sm leading-snug text-slate-600">
          J&apos;accepte le partage de mes données à des partenaires à des fins commerciales.
        </span>
      </label>
    </div>
  );
}
