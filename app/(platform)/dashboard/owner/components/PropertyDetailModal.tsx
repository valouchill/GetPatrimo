'use client';

import { motion } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import {
  ScorePill,
  GuaranteeBadge,
  Btn,
  Bar,
  Avatar,
} from './ui';
import type { LocalDossier, LocalBien } from './ui';
import type { PropertyWithCandidatures } from '../OwnerContext';
import { StagePill } from './CandidateDetailDrawer';

// ── PropertyDetailModal ───────────────────────────────────────────────────────

export function PropertyDetailModal({ bien, candidats, allData, onClose, onSelectCandidate, onOpenTunnel }: {
  bien: LocalBien; candidats: LocalDossier[];
  allData: PropertyWithCandidatures[];
  onClose: () => void; onSelectCandidate: (c: LocalDossier) => void; onOpenTunnel: () => void;
}) {
  const entry = allData.find((e) => e.property.id === bien.id);
  const flow = entry?.flow;
  const unlockedCands = candidats.filter((c) => !c.isSealed);
  const hasSel = candidats.some((d) => d.statut === 'selectionne');

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[201] flex items-center justify-center p-4"
        onClick={onClose}>
        <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">🏠</div>
              <div>
                <div className="text-lg font-bold text-slate-950">{bien.label}</div>
                <div className="mt-0.5 text-sm text-slate-500">{bien.adresse}</div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[calc(85vh-140px)] overflow-y-auto px-6 py-5">

            {/* Key metrics */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-xl font-bold text-emerald-700">{bien.loyer.toLocaleString()} €</div>
                <div className="mt-0.5 text-xs text-slate-500">Loyer/mois</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-xl font-bold text-slate-900">{candidats.length}</div>
                <div className="mt-0.5 text-xs text-slate-500">Candidature{candidats.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <StagePill stage={bien.flowStage} stageLabel={bien.flowStageLabel} />
                <div className="mt-1 text-xs text-slate-500">Étape</div>
              </div>
            </div>

            {/* Progress */}
            {typeof bien.flowProgress === 'number' && (
              <div className="mb-5">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>Progression</span><span>{bien.flowProgress}%</span>
                </div>
                <Bar value={bien.flowProgress} />
              </div>
            )}

            {/* Property info */}
            <div className="mb-5 grid grid-cols-2 gap-3">
              {bien.surface > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-xs text-slate-500">Surface</span>
                  <div className="font-semibold text-slate-900">{bien.surface} m²</div>
                </div>
              )}
              {bien.tenantLabel && (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className="text-xs text-slate-500">Locataire</span>
                  <div className="font-semibold text-slate-900">{bien.tenantLabel}</div>
                </div>
              )}
            </div>

            {bien.flowSummary && (
              <div className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{bien.flowSummary}</div>
            )}

            {/* Guidance */}
            {flow?.guidance?.contextualAdvice && (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-600">Conseil</div>
                <p className="text-sm text-emerald-800">{flow.guidance.contextualAdvice}</p>
              </div>
            )}

            {/* Candidatures mini-list */}
            {candidats.length > 0 && (
              <div className="mb-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Candidatures ({candidats.length})
                  </span>
                  {!hasSel && unlockedCands.length > 0 && (
                    <button type="button" onClick={() => { onClose(); onOpenTunnel(); }}
                      className="text-xs font-semibold text-emerald-600 hover:underline">
                      Sélectionner un locataire →
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                  {[...candidats]
                    .sort((a, b) => (a.isSealed ? 1 : 0) - (b.isSealed ? 1 : 0) || b.score - a.score)
                    .slice(0, 6)
                    .map((d) => (
                    <button key={d.id} type="button" disabled={d.isSealed}
                      onClick={() => { if (!d.isSealed) onSelectCandidate(d); }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-50">
                      {d.isSealed
                        ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Lock className="h-4 w-4 text-slate-400" /></div>
                        : <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                      }
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {d.isSealed ? (d.sealedLabel || 'Scellé') : `${d.prenom} ${d.nom}`}
                        </div>
                        <div className="text-xs text-slate-500">{d.contrat}</div>
                      </div>
                      {!d.isSealed && (
                        <div className="flex items-center gap-2">
                          <GuaranteeBadge mode={d.guaranteeMode} short />
                          <ScorePill score={d.score} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-6 py-4">
            <div className="flex gap-3">
              <Btn variant="secondary" onClick={onClose} className="flex-1">Fermer</Btn>
              {!hasSel && unlockedCands.length > 0 && (
                <Btn variant="amber" onClick={() => { onClose(); onOpenTunnel(); }} className="flex-[2]">
                  Sélectionner un locataire →
                </Btn>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
