'use client';

import { useState, useMemo } from 'react';
import { Building2, ChevronDown, ChevronRight, Eye, GitCompare, Lock, Mail, MessageSquare, Send, Star, UserCheck, UserX, X } from 'lucide-react';
import { Avatar, Bar, Btn, GuaranteeBadge, ScorePill, Tag } from './ui';
import type { LocalBien, LocalDossier } from './ui';
import { CompareView } from './CandidatCard';

type PipelineStage = 'received' | 'reviewing' | 'shortlisted' | 'selected';

const STAGES: { id: PipelineStage; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { id: 'received', label: 'Reçus', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  { id: 'reviewing', label: 'En revue', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  { id: 'shortlisted', label: 'Shortlist', color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
  { id: 'selected', label: 'Locataire retenu', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
];

function getStageForCandidate(d: LocalDossier): PipelineStage {
  // Use persisted stage if available
  if (d.pipelineStage && ['received', 'reviewing', 'shortlisted', 'selected'].includes(d.pipelineStage)) {
    return d.pipelineStage as PipelineStage;
  }
  // Fallback heuristic for candidates without a persisted stage
  if (d.statut === 'selectionne') return 'selected';
  if (d.isTop3) return 'shortlisted';
  return 'received';
}

const CONTACT_TEMPLATES = [
  {
    id: 'acknowledgment',
    label: 'Accusé de réception',
    subject: 'Votre dossier a bien été reçu',
    body: `Bonjour {prenom},\n\nNous avons bien reçu votre dossier de candidature pour le bien situé au {adresse}.\n\nNous l'examinons avec attention et reviendrons vers vous dans les meilleurs délais.\n\nCordialement,`,
  },
  {
    id: 'documentRequest',
    label: 'Demande de complément',
    subject: 'Complément de dossier demandé',
    body: `Bonjour {prenom},\n\nPour finaliser l'étude de votre dossier pour le bien au {adresse}, nous aurions besoin des documents suivants :\n\n- \n\nMerci de les transmettre via votre espace candidat.\n\nCordialement,`,
  },
  {
    id: 'selection',
    label: 'Sélection',
    subject: 'Votre candidature a été retenue !',
    body: `Bonjour {prenom},\n\nNous avons le plaisir de vous informer que votre dossier a été retenu pour le bien situé au {adresse}.\n\nNous revenons rapidement vers vous pour organiser la suite.\n\nCordialement,`,
  },
  {
    id: 'rejection',
    label: 'Refus poli',
    subject: 'Suite à votre candidature',
    body: `Bonjour {prenom},\n\nNous avons bien étudié votre dossier pour le bien au {adresse}.\n\nAprès examen attentif, nous avons retenu un autre profil pour cette location. Nous vous souhaitons bonne chance dans vos recherches.\n\nCordialement,`,
  },
];

export function ApplicationPipeline({
  biens,
  allDossiers,
  onSelectCandidate,
  onDetailCandidate,
  onViewProperty,
}: {
  biens: LocalBien[];
  allDossiers: LocalDossier[];
  onSelectCandidate: (d: LocalDossier) => void;
  onDetailCandidate: (id: string) => void;
  onViewProperty: (id: string) => void;
}) {
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [contactCandidate, setContactCandidate] = useState<LocalDossier | null>(null);
  const [localStages, setLocalStages] = useState<Record<string, PipelineStage>>({});

  const bienById = useMemo(() => new Map(biens.map((b) => [b.id, b])), [biens]);

  // Filter candidates
  const filteredDossiers = useMemo(() => {
    let result = allDossiers.filter((d) => !d.isSealed);
    if (propertyFilter !== 'all') {
      result = result.filter((d) => d.bien_id === propertyFilter);
    }
    return result;
  }, [allDossiers, propertyFilter]);

  // Group by pipeline stage
  const pipeline = useMemo(() => {
    const groups: Record<PipelineStage, LocalDossier[]> = {
      received: [], reviewing: [], shortlisted: [], selected: [],
    };
    for (const d of filteredDossiers) {
      const stage = localStages[d.id] || getStageForCandidate(d);
      groups[stage].push(d);
    }
    for (const key of Object.keys(groups) as PipelineStage[]) {
      groups[key].sort((a, b) => b.score - a.score);
    }
    return groups;
  }, [filteredDossiers, localStages]);

  const moveCandidate = async (id: string, newStage: PipelineStage) => {
    // Optimistic local update
    setLocalStages((prev) => ({ ...prev, [id]: newStage }));
    // Persist to API
    try {
      await fetch(`/api/applications/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
    } catch { /* revert on error could be added */ }
    // If moving to selected, trigger the actual selection
    if (newStage === 'selected') {
      const d = allDossiers.find((x) => x.id === id);
      if (d) onSelectCandidate(d);
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const compareBien = useMemo(() => {
    if (compareIds.length === 0) return biens[0];
    const firstId = compareIds[0];
    const d = allDossiers.find((x) => x.id === firstId);
    return d ? bienById.get(d.bien_id) || biens[0] : biens[0];
  }, [compareIds, allDossiers, bienById, biens]);

  const seenCount = allDossiers.filter((d) => !d.isSealed).length;
  const sealedCount = allDossiers.filter((d) => d.isSealed).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Property filter */}
        <div className="relative">
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 transition cursor-pointer"
          >
            <option value="all">Tous les biens ({seenCount})</option>
            {biens.map((b) => {
              const count = allDossiers.filter((d) => d.bien_id === b.id && !d.isSealed).length;
              return (
                <option key={b.id} value={b.id}>{b.label} ({count})</option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Compare button */}
        <div className="flex items-center gap-2">
          {compareIds.length >= 2 && (
            <Btn variant="secondary" onClick={() => setShowCompare(true)}>
              <GitCompare className="h-4 w-4" /> Comparer ({compareIds.length})
            </Btn>
          )}
          {sealedCount > 0 && (
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
              <Lock className="inline h-3.5 w-3.5 mr-1" />{sealedCount} scellé{sealedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Pipeline columns */}
      {filteredDossiers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
          <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-slate-100">
            <Eye className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mb-2 text-slate-500">Aucune candidature visible.</p>
          <p className="text-xs text-slate-400">Les candidatures déverrouillées apparaîtront ici.</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
          {STAGES.map((stage) => {
            const cards = pipeline[stage.id];
            return (
              <div key={stage.id} className="min-w-[280px] flex-shrink-0 flex flex-col snap-start md:min-w-0 md:flex-shrink">
                {/* Column header */}
                <div className={`mb-3 flex items-center justify-between rounded-xl border px-3 py-2 ${stage.bgColor} ${stage.borderColor}`}>
                  <span className={`text-sm font-bold ${stage.color}`}>{stage.label}</span>
                  <span className={`rounded-full ${stage.bgColor} px-2 py-0.5 text-xs font-bold ${stage.color}`}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-3">
                  {cards.map((d) => {
                    const bien = bienById.get(d.bien_id);
                    const ratio = bien && bien.loyer > 0 ? d.revenus / bien.loyer : 0;
                    const currentStage = localStages[d.id] || getStageForCandidate(d);
                    const stageIdx = STAGES.findIndex((s) => s.id === currentStage);
                    const inCompare = compareIds.includes(d.id);

                    return (
                      <div
                        key={d.id}
                        className={`rounded-xl border bg-white p-3.5 transition-all hover:shadow-md ${
                          inCompare ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
                        }`}
                      >
                        {/* Candidate header */}
                        <div className="mb-2.5 flex items-start gap-2.5">
                          <Avatar name={`${d.prenom} ${d.nom}`} id={d.id} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-900 truncate">{d.prenom} {d.nom}</span>
                              <ScorePill score={d.score} />
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-slate-500">{d.revenus.toLocaleString('fr-FR')} €/mois</span>
                              {ratio > 0 && (
                                <span className={`text-[10px] font-bold ${ratio >= 3 ? 'text-emerald-600' : ratio >= 2 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {ratio.toFixed(1)}×
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="mb-2.5 flex flex-wrap gap-1">
                          <Tag type={d.contrat === 'CDI' || d.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>{d.contrat}</Tag>
                          <GuaranteeBadge mode={d.guaranteeMode} short />
                          {d.contractReady && <Tag type="green">Prêt</Tag>}
                        </div>

                        {/* Property label */}
                        {propertyFilter === 'all' && bien && (
                          <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{bien.label}</span>
                          </div>
                        )}

                        {/* Mini audit summary */}
                        {d.auditSummary && (
                          <p className="mb-2.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] leading-4 text-slate-500 line-clamp-2">
                            {d.auditSummary}
                          </p>
                        )}

                        {/* Actions row */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onDetailCandidate(d.id)}
                            className="flex-1 rounded-lg border border-slate-200 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            Dossier
                          </button>

                          {/* Stage progression */}
                          {stageIdx < STAGES.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveCandidate(d.id, STAGES[stageIdx + 1].id)}
                              className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-amber-600 transition-colors"
                            >
                              <ChevronRight className="h-3 w-3" />
                              {STAGES[stageIdx + 1].label}
                            </button>
                          )}

                          {/* Compare checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleCompare(d.id)}
                            className={`rounded-lg p-1.5 transition-colors ${
                              inCompare ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                            title={inCompare ? 'Retirer de la comparaison' : 'Ajouter à la comparaison'}
                          >
                            <GitCompare className="h-3.5 w-3.5" />
                          </button>

                          {/* Contact */}
                          <button
                            type="button"
                            onClick={() => setContactCandidate(d)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            title="Contacter"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {cards.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                      Aucun candidat
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compare modal */}
      {showCompare && compareIds.length >= 2 && compareBien && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCompare(false)}>
          <div className="mx-4 max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Comparaison des candidats</h3>
              <button type="button" onClick={() => setShowCompare(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <CompareView
              ids={compareIds}
              candidats={filteredDossiers}
              bien={compareBien}
              onSelect={(c) => { onSelectCandidate(c); setShowCompare(false); }}
            />
          </div>
        </div>
      )}

      {/* Contact modal */}
      {contactCandidate && (
        <ContactModal
          candidate={contactCandidate}
          bien={bienById.get(contactCandidate.bien_id)}
          onClose={() => setContactCandidate(null)}
        />
      )}
    </div>
  );
}

// ── Contact Modal ────────────────────────────────────────────────────────────

function ContactModal({
  candidate,
  bien,
  onClose,
}: {
  candidate: LocalDossier;
  bien?: LocalBien;
  onClose: () => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('acknowledgment');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const template = CONTACT_TEMPLATES.find((t) => t.id === selectedTemplate);
  const messageBody = (template?.body || customMessage)
    .replace(/{prenom}/g, candidate.prenom)
    .replace(/{nom}/g, candidate.nom)
    .replace(/{adresse}/g, bien?.adresse || '—');

  const handleSend = async () => {
    setSending(true);
    try {
      await fetch(`/api/applications/${candidate.id}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          subject: template?.subject || 'Message du propriétaire',
          message: messageBody,
        }),
      });
      setSent(true);
      setTimeout(() => onClose(), 1500);
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            <MessageSquare className="mr-2 inline h-5 w-5 text-amber-500" />
            Contacter {candidate.prenom} {candidate.nom}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <div className="mb-3 flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-100">
              <Send className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-emerald-700">Message envoyé !</p>
          </div>
        ) : (
          <>
            {/* Template selector */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Modèle de message</label>
              <div className="flex flex-wrap gap-2">
                {CONTACT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedTemplate === t.id
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message preview / edit */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">Message</label>
              <textarea
                rows={8}
                value={messageBody}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Btn variant="secondary" onClick={onClose}>Annuler</Btn>
              <Btn variant="amber" disabled={sending} onClick={handleSend}>
                <Send className="h-4 w-4" /> {sending ? 'Envoi…' : 'Envoyer'}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
