'use client';

/**
 * <CandidateDossier> — Vue "Audit de Confiance" du dossier candidat.
 *
 * Style Banque Privée / Forensic. Le propriétaire ne consulte plus un
 * Google Drive — il lit un rapport d'audit certifié.
 *
 * Structure :
 *   A. Décryptage du Scoring IA — encadré emerald-900 premium avec score
 *      géant + 3 colonnes (Stabilité / Intégrité / Risque)
 *   B. Trust-List — grille élégante des documents avec statut transmission
 *      et statut audit forensic + bouton Consulter
 *
 * Le bouton Consulter ouvre <SecureDocumentViewer> avec filigrane.
 */

import * as React from 'react';
import {
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  AlertCircle,
  XCircle,
  Inbox,
  Eye,
  Sparkles,
  TrendingUp,
  ScanSearch,
  Building2,
  CreditCard,
  Home as HomeIcon,
  User as UserIcon,
  Briefcase,
} from 'lucide-react';
import {
  SecureDocumentViewer,
  type SecureDocument,
  type DocumentAuditStatus,
} from './SecureDocumentViewer';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentTransmissionStatus = 'received' | 'missing';
export type DocumentType = 'ID' | 'FINANCE' | 'PRO' | 'ADDRESS' | 'OTHER';

export interface DossierDocument {
  id: string;
  name: string;
  type: DocumentType;
  transmissionStatus: DocumentTransmissionStatus;
  auditStatus: DocumentAuditStatus;
  auditMessage?: string;
  url: string | null;
}

export interface ScoringBreakdown {
  /** Stabilité financière (ex: "Revenus pérennes certifiés") */
  stabilite: { label: string; value: string };
  /** Intégrité documentaire (ex: "0% d'altération détectée") */
  integrite: { label: string; value: string };
  /** Risque de défaut (ex: "Historiquement nul") */
  defaut: { label: string; value: string };
}

export interface CandidateDossierProps {
  /** Nom du candidat affiché dans le header */
  candidateName?: string;
  /** Profession / contexte */
  candidateJob?: string;
  /** Indice de Résilience 0-100 */
  score: number;
  /** Détail du scoring (sinon dérivé par défaut depuis le score) */
  scoring?: ScoringBreakdown;
  /** Liste des documents du dossier */
  documents: DossierDocument[];
  /** Identité du viewer pour le filigrane (ex: "Mlle Dupont · 2026-05-21") */
  viewerIdentity?: string;
  /** Permettre le téléchargement (par défaut : non, sécurité) */
  allowDownload?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultScoring(score: number): ScoringBreakdown {
  if (score >= 85) {
    return {
      stabilite: { label: 'Stabilité Financière', value: 'Revenus pérennes certifiés' },
      integrite: { label: 'Intégrité Documentaire', value: "0% d'altération détectée" },
      defaut: { label: 'Risque de Défaut', value: 'Historiquement nul' },
    };
  }
  if (score >= 60) {
    return {
      stabilite: { label: 'Stabilité Financière', value: 'Revenus stables certifiés' },
      integrite: { label: 'Intégrité Documentaire', value: 'Vérifications complètes' },
      defaut: { label: 'Risque de Défaut', value: 'Faible · à surveiller' },
    };
  }
  return {
    stabilite: { label: 'Stabilité Financière', value: 'Incohérences détectées' },
    integrite: { label: 'Intégrité Documentaire', value: 'Anomalies relevées' },
    defaut: { label: 'Risque de Défaut', value: 'Élevé · vigilance requise' },
  };
}

function getDocumentIcon(type: DocumentType): React.ElementType {
  switch (type) {
    case 'ID':
      return UserIcon;
    case 'FINANCE':
      return CreditCard;
    case 'PRO':
      return Briefcase;
    case 'ADDRESS':
      return HomeIcon;
    case 'OTHER':
    default:
      return FileText;
  }
}

function getAuditBadge(status: DocumentAuditStatus): {
  bg: string;
  text: string;
  ring: string;
  icon: React.ElementType;
  label: string;
} {
  switch (status) {
    case 'verified':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        ring: 'ring-emerald-200',
        icon: ShieldCheck,
        label: 'Vérifié (Intact)',
      };
    case 'manual_review':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        ring: 'ring-amber-200',
        icon: AlertCircle,
        label: 'Contrôle manuel requis',
      };
    case 'altered':
      return {
        bg: 'bg-red-50',
        text: 'text-red-800',
        ring: 'ring-red-200',
        icon: XCircle,
        label: 'Altération détectée',
      };
    case 'pending':
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        ring: 'ring-slate-200',
        icon: Inbox,
        label: 'En attente',
      };
  }
}

function getTransmissionBadge(status: DocumentTransmissionStatus): {
  bg: string;
  text: string;
  ring: string;
  label: string;
} {
  if (status === 'received') {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      ring: 'ring-emerald-200',
      label: 'Reçu',
    };
  }
  return {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    ring: 'ring-amber-200',
    label: 'Manquant',
  };
}

// ─── Sub-component : Score breakdown column ──────────────────────────────────

function ScoringColumn({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-emerald-950/40 p-5 ring-1 ring-emerald-800/40 backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-5 w-5 flex-shrink-0 text-amber-400" aria-hidden="true" />
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          {label}
        </p>
      </div>
      <p className="font-serif text-base font-semibold leading-snug text-white">
        {value}
      </p>
    </div>
  );
}

// ─── Sub-component : Document row ────────────────────────────────────────────

function DocumentRow({
  doc,
  onConsult,
}: {
  doc: DossierDocument;
  onConsult: () => void;
}): React.ReactElement {
  const Icon = getDocumentIcon(doc.type);
  const audit = getAuditBadge(doc.auditStatus);
  const AuditIcon = audit.icon;
  const transmission = getTransmissionBadge(doc.transmissionStatus);
  const canConsult = doc.transmissionStatus === 'received' && !!doc.url;

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:gap-6">
      {/* Icon + nom */}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
          <Icon className="h-6 w-6 flex-shrink-0 text-emerald-700" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-serif text-base font-semibold text-emerald-900"
            title={doc.name}
          >
            {doc.name}
          </h3>
          {doc.auditMessage && (
            <p
              className="mt-0.5 line-clamp-1 text-xs text-slate-500"
              title={doc.auditMessage}
            >
              {doc.auditMessage}
            </p>
          )}
        </div>
      </div>

      {/* Badges transmission + audit */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${transmission.bg} ${transmission.text} ${transmission.ring}`}
        >
          {transmission.label}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${audit.bg} ${audit.text} ${audit.ring}`}
        >
          <AuditIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{audit.label}</span>
        </span>
      </div>

      {/* CTA Consulter */}
      <button
        type="button"
        onClick={onConsult}
        disabled={!canConsult}
        className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-50 hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        aria-label={canConsult ? `Consulter ${doc.name}` : `${doc.name} non disponible`}
      >
        <Eye className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        Consulter
      </button>
    </li>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function CandidateDossier({
  candidateName,
  candidateJob,
  score,
  scoring,
  documents,
  viewerIdentity,
  allowDownload = false,
  className = '',
}: CandidateDossierProps): React.ReactElement {
  const [activeDoc, setActiveDoc] = React.useState<DossierDocument | null>(null);

  const safeScore = Math.max(0, Math.min(100, Math.round(score || 0)));
  const breakdown = scoring || defaultScoring(safeScore);

  // Statistiques globales
  const receivedCount = documents.filter((d) => d.transmissionStatus === 'received').length;
  const verifiedCount = documents.filter((d) => d.auditStatus === 'verified').length;
  const alteredCount = documents.filter((d) => d.auditStatus === 'altered').length;

  return (
    <div className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 ${className}`}>
      {/* ─── Header optionnel (nom candidat) ─────────────────────────────── */}
      {(candidateName || candidateJob) && (
        <header className="mb-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Audit de Confiance
          </p>
          {candidateName && (
            <h1
              className="font-serif text-3xl font-bold leading-tight text-emerald-900 sm:text-4xl line-clamp-2"
              title={candidateName}
            >
              {candidateName}
            </h1>
          )}
          {candidateJob && (
            <p className="mt-1.5 truncate text-sm text-slate-500" title={candidateJob}>
              {candidateJob}
            </p>
          )}
        </header>
      )}

      {/* ─── A. Décryptage du Scoring IA (encadré premium emerald-900) ──── */}
      <section
        className="mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-900 to-emerald-800 p-8 text-white shadow-xl sm:p-10"
        aria-label="Décryptage du scoring IA"
      >
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:gap-10">
          {/* Score géant à gauche */}
          <div className="flex flex-shrink-0 flex-col items-center gap-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400">
              Indice de Résilience
            </p>
            <p className="font-serif text-7xl font-bold leading-none text-amber-400 sm:text-8xl">
              {safeScore}
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              sur 100
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300 ring-1 ring-amber-500/30">
              <Sparkles className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              Décryptage IA
            </div>
          </div>

          {/* 3 colonnes du breakdown */}
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
            <ScoringColumn
              icon={TrendingUp}
              label={breakdown.stabilite.label}
              value={breakdown.stabilite.value}
            />
            <ScoringColumn
              icon={ScanSearch}
              label={breakdown.integrite.label}
              value={breakdown.integrite.value}
            />
            <ScoringColumn
              icon={ShieldCheck}
              label={breakdown.defaut.label}
              value={breakdown.defaut.value}
            />
          </div>
        </div>
      </section>

      {/* ─── B. Trust-List (grille des documents) ─────────────────────────── */}
      <section aria-label="Pièces du dossier">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Trust-List
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold leading-tight text-emerald-900">
              Pièces du dossier &amp; Audit Forensic
            </h2>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {receivedCount}/{documents.length} reçus · {verifiedCount} vérifiés
            {alteredCount > 0 && ` · ${alteredCount} altéré${alteredCount > 1 ? 's' : ''}`}
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mb-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
              <Inbox className="h-6 w-6 flex-shrink-0 text-slate-400" aria-hidden="true" />
            </div>
            <p className="font-serif text-lg font-semibold text-emerald-900">
              Aucune pièce transmise pour le moment
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Le candidat n'a pas encore commencé à compléter son dossier.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onConsult={() => setActiveDoc(doc)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ─── SecureDocumentViewer (modale) ─────────────────────────────────── */}
      <SecureDocumentViewer
        open={activeDoc !== null}
        document={
          activeDoc
            ? ({
                id: activeDoc.id,
                name: activeDoc.name,
                type: activeDoc.type,
                url: activeDoc.url,
                auditStatus: activeDoc.auditStatus,
                auditMessage: activeDoc.auditMessage,
              } satisfies SecureDocument)
            : null
        }
        onClose={() => setActiveDoc(null)}
        viewerIdentity={viewerIdentity}
        allowDownload={allowDownload}
      />
    </div>
  );
}

// ─── Demo wrapper ────────────────────────────────────────────────────────────

const DEMO_DOCUMENTS: DossierDocument[] = [
  {
    id: 'doc_1',
    name: "Carte Nationale d'Identité",
    type: 'ID',
    transmissionStatus: 'received',
    auditStatus: 'verified',
    auditMessage: 'Certifié eIDAS (Authenticité validée)',
    url: '/mock-cni.jpg',
  },
  {
    id: 'doc_2',
    name: 'Fiches de paie (3 derniers mois)',
    type: 'FINANCE',
    transmissionStatus: 'received',
    auditStatus: 'verified',
    auditMessage: 'Logiciel RH détecté (SILAE). Calcul URSSAF exact.',
    url: '/mock-payslips.pdf',
  },
  {
    id: 'doc_3',
    name: 'Attestation Employeur',
    type: 'PRO',
    transmissionStatus: 'missing',
    auditStatus: 'pending',
    auditMessage: 'En attente du locataire',
    url: null,
  },
  {
    id: 'doc_4',
    name: "Avis d'imposition 2025",
    type: 'FINANCE',
    transmissionStatus: 'received',
    auditStatus: 'manual_review',
    auditMessage: 'Document scanné, signature manuscrite à vérifier visuellement.',
    url: '/mock-tax-notice.pdf',
  },
  {
    id: 'doc_5',
    name: 'Justificatif de domicile',
    type: 'ADDRESS',
    transmissionStatus: 'received',
    auditStatus: 'verified',
    auditMessage: 'Facture EDF authentique (émise il y a 14 jours).',
    url: '/mock-edf.pdf',
  },
];

export function CandidateDossierDemo(): React.ReactElement {
  return (
    <div className="min-h-screen bg-slate-50">
      <CandidateDossier
        candidateName="Louna Bernasconi"
        candidateJob="CDI · Cadre du Secteur Privé · Paris 11e"
        score={98}
        documents={DEMO_DOCUMENTS}
        viewerIdentity="Démo · Propriétaire #PT-2026"
      />
    </div>
  );
}
