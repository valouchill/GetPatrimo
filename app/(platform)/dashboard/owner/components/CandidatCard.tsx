'use client';

/**
 * <CandidatCard> — Wrapper qui rend la nouvelle <TenantCard> "Banque Privée"
 * tout en préservant l'API utilisée par TunnelSelection (mode compare,
 * mode sealed, callbacks onSelect/onDetail/onToggleCompare).
 *
 * Migration V5.1 : suppression de l'ancien design "Dashboard SaaS"
 * (Avatar+badges+barres de progression), remplacement par TenantCard
 * (avatar monogramme emerald-900/amber-500 + jauge SVG Sésame + métriques
 * aérées + alerte intégrée + CTA emerald "Ouvrir le dossier certifié").
 *
 * Le CompareView (table de comparaison) reste inchangé.
 */

import React from 'react';
import { Lock, Check } from 'lucide-react';
import { ScorePill, GuaranteeBadge, Avatar, Tag } from './ui';
import type { LocalDossier, LocalBien } from './ui';
import { formatPrice, getMetalLevel, METAL_LABELS } from '@/lib/product-lexicon';
import { resolveVerdict } from '@/lib/verdict-system';
import { TenantCard, type TenantCardData } from '@/app/components/audit/TenantCard';

// ────────────────────────────────────────────────────────────────────────────
// Mapping LocalDossier → TenantCardData
// ────────────────────────────────────────────────────────────────────────────

function buildAlerte(c: LocalDossier): string | undefined {
  // 1. Audit forensic en alerte → message le plus fort
  if (c.auditStatus === 'ALERT') {
    return c.auditSummary || 'Incohérences détectées dans les documents fournis par l\'audit forensic.';
  }
  // 2. Documents rejetés
  const rejected = c.rejectedDocuments || 0;
  if (rejected > 0) {
    return `${rejected} pièce${rejected > 1 ? 's' : ''} rejetée${rejected > 1 ? 's' : ''} par l'audit IA — vérification manuelle requise.`;
  }
  // 3. Première watchout si présente
  if (c.watchouts && c.watchouts.length > 0) {
    return c.watchouts[0];
  }
  // 4. Pas de garant
  if (!c.guaranteeMode || c.guaranteeMode === 'NONE') {
    return 'Aucune garantie détectée — Visale fortement recommandée pour sécuriser le bail.';
  }
  return undefined;
}

function mapDossierToTenantCard(c: LocalDossier, bien: LocalBien): TenantCardData {
  // V6.6 — Métal institutionnel (PLATINUM/GOLD/SILVER/ALERTE)
  const metalLevel = getMetalLevel(c.score);
  // Effort rate déjà stocké en 0-1 dans toDossier ; sinon dérivé
  const effortPct =
    typeof c.effortRate === 'number' && c.effortRate > 0
      ? Math.round(c.effortRate * 100)
      : bien.loyer > 0 && c.revenus > 0
      ? Math.round((bien.loyer / c.revenus) * 100)
      : 0;

  return {
    prenom: c.prenom || '',
    nom: c.nom || '',
    profession: c.contrat || 'Profil',
    score: Math.max(0, Math.min(100, Math.round(c.score || 0))),
    grade: METAL_LABELS[metalLevel],
    revenus: formatPrice(c.revenus || 0),
    loyer: formatPrice(bien.loyer || 0),
    effort: `${effortPct}%`,
    alerte: buildAlerte(c),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// CandidatCard — wrapper avec compare mode + sealed
// ────────────────────────────────────────────────────────────────────────────

export function CandidatCard({
  c,
  bien,
  onSelect: _onSelect,
  onDetail,
  compareMode,
  inCompare,
  onToggleCompare,
}: {
  c: LocalDossier;
  bien: LocalBien;
  /** @deprecated — la sélection se fait désormais depuis la modale d'audit */
  onSelect: (c: LocalDossier) => void;
  onDetail: (c: LocalDossier) => void;
  compareMode: boolean;
  inCompare: boolean;
  onToggleCompare: (id: string) => void;
}) {
  // ─── État "scellé" (paywall) ──────────────────────────────────────────────
  if (c.isSealed) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-400">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-semibold text-slate-500">
              {c.sealedLabel || 'Candidat scellé'}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Déverrouillez pour consulter le dossier certifié
            </p>
          </div>
        </div>
      </div>
    );
  }

  const data = mapDossierToTenantCard(c, bien);

  // ─── Mode compare : carte cliquable avec overlay checkbox ──────────────
  if (compareMode) {
    return (
      <button
        type="button"
        onClick={() => onToggleCompare(c.id)}
        aria-pressed={inCompare}
        className={`relative block w-full text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
          inCompare ? 'scale-[1.01]' : ''
        }`}
      >
        {/* Overlay ring de sélection */}
        <span
          className={`pointer-events-none absolute inset-0 z-10 rounded-2xl ring-2 ring-offset-2 transition-all ${
            inCompare ? 'ring-emerald-500' : 'ring-transparent'
          }`}
          aria-hidden="true"
        />
        {/* Checkbox overlay top-left */}
        <span
          className={`absolute -left-2 -top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all ${
            inCompare
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-300 ring-1 ring-slate-200'
          }`}
          aria-hidden="true"
        >
          <Check className="h-4 w-4" />
        </span>
        {/* Carte (rendue sans CTA — la carte entière est le bouton) */}
        <TenantCardCompareInner data={data} />
      </button>
    );
  }

  // ─── Mode normal : CTA "Ouvrir le dossier certifié" → onDetail ─────────
  return (
    <TenantCard
      candidat={data}
      onOpen={() => onDetail(c)}
    />
  );
}

/**
 * Variante interne de TenantCard sans CTA bottom (pour le mode compare où
 * la carte entière est le bouton de sélection).
 */
function TenantCardCompareInner({ data }: { data: TenantCardData }) {
  // On réutilise TenantCard mais on retire visuellement le CTA via un
  // wrapper qui mask le bouton (plus simple que dupliquer le JSX complet).
  return (
    <div className="[&_button:last-child]:hidden">
      <TenantCard candidat={data} onOpen={undefined} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CompareView — table de comparaison (inchangée)
// ────────────────────────────────────────────────────────────────────────────

export function CompareView({
  ids,
  candidats,
  bien,
  onSelect,
}: {
  ids: string[];
  candidats: LocalDossier[];
  bien: LocalBien;
  onSelect: (c: LocalDossier) => void;
}) {
  const cs = candidats.filter((c) => ids.includes(c.id));
  const rows: { label: string; fn: (c: LocalDossier) => React.ReactNode }[] = [
    { label: 'Indice de Résilience', fn: (c) => <ScorePill score={c.score} /> },
    { label: 'Grade', fn: (c) => <Tag type="indigo">Grade {c.grade}</Tag> },
    { label: 'Revenus', fn: (c) => <b className="text-emerald-700">{formatPrice(c.revenus)}</b> },
    {
      label: 'Ratio',
      fn: (c) => {
        const r = c.revenus / (bien.loyer || 1);
        return (
          <span
            className={`font-bold ${
              r >= 3 ? 'text-emerald-600' : r >= 2 ? 'text-amber-600' : 'text-red-600'
            }`}
          >
            {r.toFixed(1)}×
          </span>
        );
      },
    },
    {
      label: 'Contrat',
      fn: (c) => (
        <Tag type={c.contrat === 'CDI' || c.contrat === 'Fonctionnaire' ? 'green' : 'amber'}>
          {c.contrat}
        </Tag>
      ),
    },
    { label: 'Reste à vivre', fn: (c) => <span className="text-xs">{c.remainingIncomeLabel || '—'}</span> },
    { label: 'Effort locatif', fn: (c) => <span className="text-xs">{c.effortRateLabel || '—'}</span> },
    { label: 'Garantie', fn: (c) => <GuaranteeBadge mode={c.guaranteeMode} /> },
    {
      label: 'Qualité',
      fn: (c) => (
        <span
          className={
            (c.qualityScore ?? 0) >= 70 ? 'font-semibold text-emerald-600' : 'text-amber-600'
          }
        >
          {c.qualityScore ?? '—'}/100
        </span>
      ),
    },
    {
      label: 'Audit Forensic',
      fn: (c) => (
        <Tag
          type={
            c.auditStatus === 'CLEAR'
              ? 'green'
              : c.auditStatus === 'ALERT'
              ? 'red'
              : 'amber'
          }
        >
          {c.auditStatus === 'CLEAR' ? 'Validé' : c.auditStatus === 'ALERT' ? 'Alerte' : 'En cours'}
        </Tag>
      ),
    },
    {
      label: 'Prêt à signer',
      fn: (c) => (
        <span
          className={
            c.contractReady ? 'font-semibold text-emerald-600' : 'text-slate-400'
          }
        >
          {c.contractReady ? 'Oui' : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[500px] border-collapse">
        <thead>
          <tr>
            <th className="w-36 bg-slate-50 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Critères
            </th>
            {cs.map((c) => (
              <th key={c.id} className="border-l border-slate-100 bg-emerald-50 px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Avatar name={`${c.prenom} ${c.nom}`} id={c.id} size="sm" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {c.prenom} {c.nom}
                    </div>
                    <div className="text-xs text-slate-500">{c.contrat}</div>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, ri) => (
            <tr key={row.label} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-4 py-3 text-sm font-medium text-slate-600">{row.label}</td>
              {cs.map((c) => (
                <td key={c.id} className="border-l border-slate-100 px-4 py-3 text-center text-sm">
                  {row.fn(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-4 py-3" />
            {cs.map((c) => (
              <td key={c.id} className="border-l border-slate-100 px-3 py-3">
                <button
                  type="button"
                  onClick={() => onSelect(c)}
                  className="w-full rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600"
                >
                  Choisir {c.prenom} →
                </button>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
