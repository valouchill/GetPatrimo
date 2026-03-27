'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSignature, X } from 'lucide-react';
import {
  StepBar,
  Btn,
  Tag,
  ScorePill,
  GuaranteeBadge,
  Avatar,
  SEL_STEPS,
} from './ui';
import type { LocalBien, LocalDossier } from './ui';
import { CandidatCard, CompareView } from './CandidatCard';
import { CandidateDetailDrawer } from './CandidateDetailDrawer';

function TunnelSelection({ bien, candidats, onClose, onConfirmed, onGoToProperty }: {
  bien: LocalBien; candidats: LocalDossier[];
  onClose: () => void; onConfirmed: () => void; onGoToProperty: () => void;
}) {
  const [step, setStep] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<LocalDossier | null>(null);
  const [detail, setDetail] = useState<LocalDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlockedCands = candidats.filter((c) => !c.isSealed);
  const sealedCands = candidats.filter((c) => c.isSealed);
  const cands = [...unlockedCands].sort((a, b) => b.score - a.score);

  const toggleCompare = (id: string) =>
    setCompareIds((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p);
  const handleSelect = (c: LocalDossier) => { setSelected(c); setStep(2); setCompareMode(false); };

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/owner/properties/${bien.id}/selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: selected.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Erreur lors de la sélection.'); return;
      }
      setStep(3); onConfirmed();
    } catch { setError('Erreur réseau.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Tunnel de sélection du locataire">
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4 px-6 py-4">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <X className="h-4 w-4" /> Fermer
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="rounded-xl border border-slate-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shrink-0">🏠 {bien.label}</span>
            <span className="hidden truncate text-sm text-slate-500 sm:block">{bien.adresse}</span>
            <Tag type="slate">{bien.loyer.toLocaleString()} €/mois</Tag>
          </div>
          <div className="ml-auto hidden w-72 shrink-0 sm:block">
            <StepBar step={step} steps={SEL_STEPS} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-5xl">

          {/* Step 0 — liste */}
          {step === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">
                    {candidats.length} candidature{candidats.length !== 1 ? 's' : ''}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {unlockedCands.length} dossier{unlockedCands.length !== 1 ? 's' : ''} déverrouillé{unlockedCands.length !== 1 ? 's' : ''}
                    {sealedCands.length > 0 && ` · ${sealedCands.length} scellé${sealedCands.length !== 1 ? 's' : ''}`}
                    {' · '}Triés par score IA
                  </p>
                </div>
                {!compareMode ? (
                  <Btn variant="ghost" onClick={() => setCompareMode(true)} disabled={unlockedCands.length < 2}>Comparer des dossiers</Btn>
                ) : (
                  <div className="flex gap-2">
                    <Btn variant="secondary" onClick={() => { setCompareMode(false); setCompareIds([]); }}>Annuler</Btn>
                    <Btn variant="amber" disabled={compareIds.length < 2} onClick={() => setStep(1)}>Comparer ({compareIds.length}) →</Btn>
                  </div>
                )}
              </div>
              {compareMode && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Sélectionnez 2 ou 3 candidats à comparer côte à côte · {compareIds.length}/3
                </div>
              )}
              {unlockedCands.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
                  <div className="mb-3 text-4xl">🔒</div>
                  <p className="text-slate-500">Aucun dossier déverrouillé pour ce bien.</p>
                  <p className="mt-2 text-xs text-slate-400">Déverrouillez les candidatures depuis la fiche du bien.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {cands.map((c) => (
                    <CandidatCard key={c.id} c={c} bien={bien} onSelect={handleSelect} onDetail={setDetail}
                      compareMode={compareMode} inCompare={compareIds.includes(c.id)} onToggleCompare={toggleCompare} />
                  ))}
                  {sealedCands.map((c) => (
                    <CandidatCard key={c.id} c={c} bien={bien} onSelect={handleSelect} onDetail={setDetail}
                      compareMode={false} inCompare={false} onToggleCompare={toggleCompare} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 1 — comparaison */}
          {step === 1 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-950">Comparaison côte à côte</h2>
                  <p className="mt-1 text-sm text-slate-500">{compareIds.length} candidats · Critères clés</p>
                </div>
                <Btn variant="secondary" onClick={() => setStep(0)}>← Liste complète</Btn>
              </div>
              <CompareView ids={compareIds} candidats={cands} bien={bien} onSelect={handleSelect} />
            </motion.div>
          )}

          {/* Step 2 — confirmation */}
          {step === 2 && selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg">
              <div className="mb-8 text-center">
                <div className="mb-3 text-5xl">🏆</div>
                <h2 className="font-serif text-2xl font-bold text-slate-950">Confirmer la sélection</h2>
                <p className="mt-2 text-sm text-slate-500">Cette action notifiera automatiquement tous les candidats</p>
              </div>
              <div className="mb-4 rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-lg shadow-emerald-500/10">
                <div className="mb-5 flex items-center gap-4">
                  <Avatar name={`${selected.prenom} ${selected.nom}`} id={selected.id} size="lg" />
                  <div>
                    <div className="text-lg font-bold text-slate-950">{selected.prenom} {selected.nom}</div>
                    <div className="text-sm text-slate-500">{selected.contrat}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <ScorePill score={selected.score} />
                      <Tag type={selected.contrat === 'CDI' || selected.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>{selected.contrat}</Tag>
                      <GuaranteeBadge mode={selected.guaranteeMode} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ['Revenus', `${selected.revenus.toLocaleString()} €`, 'text-emerald-700'],
                    ['Ratio', `${(selected.revenus / (bien.loyer || 1)).toFixed(1)}×`, selected.revenus / (bien.loyer || 1) >= 3 ? 'text-emerald-600' : 'text-amber-600'],
                    ['Audit', selected.auditStatus === 'CLEAR' ? 'Validé' : selected.auditStatus === 'ALERT' ? 'Alerte' : '—', selected.auditStatus === 'CLEAR' ? 'text-emerald-600' : 'text-amber-600'],
                  ].map(([l, v, c]) => (
                    <div key={l} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <div className={`text-base font-bold ${c}`}>{v}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{l}</div>
                    </div>
                  ))}
                </div>
                {selected.contractReady && (
                  <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                    ✓ Prêt à contracter · Dossier validé
                  </div>
                )}
              </div>
              {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              {selected.guaranteeMode === 'NONE' || !selected.guaranteeMode ? (
                <div className="mb-4 rounded-xl border-2 border-orange-300 bg-orange-50 px-4 py-3">
                  <div className="mb-1 text-sm font-bold text-orange-800">⚠ Candidat sans garant</div>
                  <p className="text-sm text-orange-700">
                    Ce candidat n'a pas de garant (ni Visale, ni garant physique). Souhaitez-vous continuer la sélection ?
                  </p>
                </div>
              ) : null}
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                ⚠ Les autres candidats seront notifiés automatiquement par e-mail.
              </div>
              <div className="flex gap-3">
                <Btn variant="secondary" onClick={() => setStep(0)} className="flex-1">← Retour</Btn>
                <Btn variant="amber" onClick={handleConfirm} disabled={loading} className="flex-[2]">
                  {loading ? 'Enregistrement…' : 'Confirmer la sélection →'}
                </Btn>
              </div>
            </motion.div>
          )}

          {/* Step 3 — succès */}
          {step === 3 && selected && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg py-12 text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <h2 className="font-serif text-2xl font-bold text-slate-950">Locataire sélectionné !</h2>
              <p className="mt-2 mb-2 text-sm text-slate-600">
                <span className="font-semibold">{selected.prenom} {selected.nom}</span> a été retenu(e) pour <span className="font-semibold">{bien.label}</span>.
              </p>
              <p className="mb-8 text-sm text-slate-500">
                Rendez-vous sur la fiche du bien pour rédiger et envoyer le bail pour signature.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Btn variant="secondary" onClick={onClose}>Retour au tableau de bord</Btn>
                <Btn variant="amber" onClick={() => { onClose(); onGoToProperty(); }}>
                  <FileSignature className="h-4 w-4" /> Rédiger le bail →
                </Btn>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Détail candidat — Drawer */}
      <AnimatePresence>
        {detail && (
          <CandidateDetailDrawer
            c={detail}
            bien={bien}
            onClose={() => setDetail(null)}
            onSelect={(c: LocalDossier) => { handleSelect(c); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default TunnelSelection;
export { TunnelSelection };
