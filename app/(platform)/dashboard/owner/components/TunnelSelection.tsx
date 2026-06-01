'use client';

/**
 * <TunnelSelection> — Refonte V5.2 utilisant le workflow "Tinder Like"
 * (CandidaturesStackView via OwnerCandidatesStack).
 *
 * Le tunnel devient un simple overlay plein écran qui contient :
 *   - Header avec nom du bien + bouton fermer + adresse + loyer
 *   - Body : OwnerCandidatesStack (single-bien mode) qui affiche la
 *     pile de fiches et gère le SelectionConfirmModal en interne
 *   - Sur "Retenir" confirmé → POST /api/owner/properties/[id]/selection
 *     puis transition vers /contract
 *
 * Les anciennes étapes "Step 1 comparaison" et "Step 2 confirmation"
 * sont absorbées par le flow stack + modale de confirmation.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { Tag } from './ui';
import type { LocalBien, LocalDossier } from './ui';
import { OwnerCandidatesStack } from './OwnerCandidatesStack';

function TunnelSelection({
  bien,
  candidats,
  onClose,
  onConfirmed,
  onGoToContract,
  onOpenDetail,
}: {
  bien: LocalBien;
  candidats: LocalDossier[];
  onClose: () => void;
  /**
   * Reçoit le candidat retenu. Peut être async (ex: refresh()) — awaité
   * avant navigation pour que la liste parente soit à jour (audit M3).
   */
  onConfirmed: (candidate: LocalDossier) => void | Promise<void>;
  onGoToContract: (propertyId: string, applicationId: string) => void;
  /**
   * V8.3 (audit M1) — clic carte → modale centrale d'audit (onglets) au lieu
   * du Sheet latéral legacy. Garantit une lecture identique partout.
   */
  onOpenDetail?: (candidateId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (c: LocalDossier) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/owner/properties/${bien.id}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: c.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Erreur lors de la sélection.');
        return;
      }
      // V8.3 (audit M3) — on AWAIT le refresh parent avant de naviguer pour
      // que la liste soit à jour (évite un état périmé sans F5). Le candidat
      // retenu est transmis au parent (syncSelectionMemory).
      await Promise.resolve(onConfirmed(c));
      onClose();
      onGoToContract(bien.id, c.id);
    } catch {
      setError('Erreur réseau lors de la sélection. Vous pouvez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Revue des candidatures du bien"
    >
      {/* Header */}
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Fermer
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {bien.label}
            </span>
            <span className="truncate text-xs text-slate-500 sm:text-sm">
              {bien.adresse}
            </span>
            <Tag type="slate">{bien.loyer.toLocaleString()} €/mois</Tag>
          </div>
        </div>
        {error && (
          <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-semibold text-red-700 md:px-6">
            {error}
          </div>
        )}
        {loading && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-700 md:px-6">
            Enregistrement de la sélection…
          </div>
        )}
      </div>

      {/* Stack body (single-bien mode) */}
      <div className="flex-1 overflow-y-auto">
        <OwnerCandidatesStack
          bien={bien}
          candidats={candidats}
          onAccept={handleAccept}
          onOpenDetail={onOpenDetail}
        />
      </div>
    </div>
  );
}

export default TunnelSelection;
export { TunnelSelection };
