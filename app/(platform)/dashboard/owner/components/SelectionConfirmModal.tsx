'use client';

import * as React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';
import { Modal, Button } from '@/app/components/ui';
import { labelForReason } from '@/lib/verdict-reasons';

type Verdict = 'recommended' | 'review' | 'risky';

export interface SelectionConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  candidateName: string;
  verdict: Verdict;
  reasonCodes?: string[];
  loading?: boolean;
  error?: string | null;
}

const COPY: Record<
  Verdict,
  {
    bg: string;
    border: string;
    title: string;
    iconColor: string;
    Icon: React.ElementType;
    intro: string;
    buttonVariant: 'primary' | 'danger';
  }
> = {
  recommended: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    title: 'Dossier recommandé',
    iconColor: 'text-emerald-700',
    Icon: ShieldCheck,
    intro: 'Tous les critères d\'évaluation sont validés. Vous pouvez retenir ce locataire en toute confiance.',
    buttonVariant: 'primary',
  },
  review: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'Dossier à vérifier avant sélection',
    iconColor: 'text-amber-700',
    Icon: AlertTriangle,
    intro: 'Sélection possible, mais ce dossier comporte des points à vérifier manuellement avant la signature. Lisez les motifs ci-dessous.',
    buttonVariant: 'primary',
  },
  risky: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    title: 'Dossier risqué',
    iconColor: 'text-red-700',
    Icon: AlertOctagon,
    intro: 'Plusieurs alertes critiques ont été détectées. La sélection reste possible mais elle est fortement déconseillée sans levée des blocages.',
    buttonVariant: 'danger',
  },
};

/**
 * Modale de confirmation avant sélection d'un candidat.
 * Affiche les raisons (verdict + reasonCodes) pour éclairer le propriétaire.
 */
export function SelectionConfirmModal({
  open,
  onClose,
  onConfirm,
  candidateName,
  verdict,
  reasonCodes,
  loading = false,
  error = null,
}: SelectionConfirmModalProps) {
  const copy = COPY[verdict];
  const Icon = copy.Icon;
  const hasReasons = reasonCodes && reasonCodes.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Retenir ce locataire"
      description={`Préparation du bail pour ${candidateName}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant={copy.buttonVariant}
            onClick={onConfirm}
            loading={loading}
            iconLeft={<Icon className="h-4 w-4" />}
          >
            Confirmer et préparer le bail
          </Button>
        </>
      }
    >
      <div className={`rounded-card border ${copy.border} ${copy.bg} px-4 py-3`}>
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${copy.iconColor}`} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className={`font-semibold ${copy.iconColor}`}>{copy.title}</p>
            <p className="mt-1.5 text-sm text-slate-700">{copy.intro}</p>
          </div>
        </div>
      </div>

      {hasReasons && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Motifs détectés
          </p>
          <ul className="space-y-2">
            {reasonCodes!.map((code) => (
              <li key={code} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    verdict === 'risky' ? 'bg-red-500' : verdict === 'review' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  aria-hidden="true"
                />
                <span>{labelForReason(code)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Cette confirmation enregistre votre choix et ouvre la préparation du bail.
        Vous pourrez retirer la sélection tant que le bail n&apos;est pas engagé.
      </p>
    </Modal>
  );
}
