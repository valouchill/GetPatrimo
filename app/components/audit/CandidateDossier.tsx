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
  // V5.12 — Données IA pour aperçu synthétique (transmises au viewer)
  fileName?: string | null;
  uploadedAt?: string | null;
  dateEmission?: string | null;
  aiInsights?: {
    documentType?: string | null;
    confidence?: number | null;
    summary?: string | null;
    fraudScore?: number | null;
    flags?: string[];
    extractedFields?: Record<string, unknown>;
  };
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
  /** Profession / contexte (utilisé pour normaliser le profil si profile non fourni) */
  candidateJob?: string;
  /**
   * Profil candidat — adapte les pièces requises.
   * Si non fourni, normaliseProfile(candidateJob) est utilisé.
   */
  profile?: CandidateProfile;
  /**
   * Identité vérifiée par Didit ?
   * Si true, la catégorie "Identité" est automatiquement complète
   * (pas de CNI requise — la biométrie suffit).
   */
  diditVerified?: boolean;
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
  /**
   * Affiche le bloc "Décryptage du Scoring IA" (header + score géant +
   * 3 colonnes). Par défaut true. Mettre false pour intégrer dans une
   * modale qui affiche déjà le score (ex: CandidateAuditModal). */
  showScoring?: boolean;
  /** Affiche le header avec nom du candidat (par défaut true) */
  showHeader?: boolean;
  /** État de chargement (skeleton) */
  loading?: boolean;
  /** Message d'erreur si fetch échoue */
  error?: string | null;
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

// ─── Profils candidat (V5.8) ─────────────────────────────────────────────────

export type CandidateProfile =
  | 'SALARIE' // CDI, CDD, Fonctionnaire, Cadre
  | 'INDEPENDANT' // Freelance, Auto-entrepreneur, Profession libérale
  | 'ETUDIANT'
  | 'RETRAITE'
  | 'AUTRE';

/** Normalise une chaîne de contrat ("CDI", "Freelance", etc.) → profil */
export function normalizeProfile(contrat?: string | null): CandidateProfile {
  const c = (contrat || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!c) return 'AUTRE';
  if (
    c.includes('CDI') ||
    c.includes('CDD') ||
    c.includes('FONCTIONNAIRE') ||
    c.includes('CADRE') ||
    c.includes('SALARIE')
  )
    return 'SALARIE';
  if (
    c.includes('INDEPENDANT') ||
    c.includes('FREELANCE') ||
    c.includes('AUTO-ENTREPRENEUR') ||
    c.includes('AUTO ENTREPRENEUR') ||
    c.includes('LIBERAL') ||
    c.includes('LIBERALE') ||
    c.includes('LIBERAL') ||
    c.includes('PROFESSION LIBERALE') ||
    c.includes('MICRO-ENTREPRISE')
  )
    return 'INDEPENDANT';
  if (c.includes('ETUDIANT') || c.includes('ETUDIANTE')) return 'ETUDIANT';
  if (c.includes('RETRAITE') || c.includes('RETRAITEE')) return 'RETRAITE';
  return 'AUTRE';
}

/** Label fr du profil (affichage) */
export function getProfileLabel(profile: CandidateProfile): string {
  switch (profile) {
    case 'SALARIE':
      return 'Salarié·e';
    case 'INDEPENDANT':
      return 'Indépendant·e';
    case 'ETUDIANT':
      return 'Étudiant·e';
    case 'RETRAITE':
      return 'Retraité·e';
    case 'AUTRE':
    default:
      return 'Profil personnalisé';
  }
}

// ─── Catégories requises (V5.8 — adaptatives selon profil + Didit) ──────────

interface CategorySpec {
  type: DocumentType;
  label: string;
  /** Description courte affichée sous le titre de catégorie */
  hint: string;
  /** Nombre de pièces attendues (sera utilisé pour calculer les manquants) */
  expectedCount: number;
  /** Libellé exact de chaque pièce attendue (slot manquant) */
  expectedItems: string[];
  /** Si true, la catégorie est automatiquement validée (ex: Didit pour l'ID) */
  autoComplete?: { reason: string; certifier: string };
}

/**
 * Retourne la liste des catégories attendues selon :
 *  - le profil du candidat (Salarié / Indépendant / Étudiant / Retraité)
 *  - le statut Didit (si verified → catégorie ID auto-complète, pas de CNI requise)
 */
export function getRequiredCategories(
  profile: CandidateProfile,
  diditVerified: boolean,
): CategorySpec[] {
  // ─── Catégorie Identité ──────────────────────────────────────────────
  const idCategory: CategorySpec = diditVerified
    ? {
        type: 'ID',
        label: 'Identité',
        hint: '✓ Vérification biométrique Didit (eIDAS)',
        expectedCount: 0,
        expectedItems: [],
        autoComplete: {
          reason: 'Identité certifiée par vérification biométrique Didit',
          certifier: 'Didit eIDAS',
        },
      }
    : {
        type: 'ID',
        label: 'Identité',
        hint: 'Pièce d\'identité officielle requise',
        expectedCount: 1,
        expectedItems: ["Pièce d'identité (recto/verso)"],
      };

  // ─── Catégorie Revenus & Activité (selon profil) ────────────────────
  let financeCategory: CategorySpec;
  let proCategory: CategorySpec | null;

  switch (profile) {
    case 'SALARIE':
      financeCategory = {
        type: 'FINANCE',
        label: 'Revenus & Solvabilité',
        hint: 'Cohérence fiches de paie / avis fiscal',
        expectedCount: 4,
        expectedItems: [
          'Fiche de paie M-1',
          'Fiche de paie M-2',
          'Fiche de paie M-3',
          "Avis d'imposition (année N-1)",
        ],
      };
      proCategory = {
        type: 'PRO',
        label: 'Activité professionnelle',
        hint: 'Confirmation poste et ancienneté',
        expectedCount: 1,
        expectedItems: ['Attestation employeur ou contrat de travail'],
      };
      break;

    case 'INDEPENDANT':
      financeCategory = {
        type: 'FINANCE',
        label: 'Revenus & Solvabilité',
        hint: 'Bilans + attestation fiscale',
        expectedCount: 3,
        expectedItems: [
          'Bilan / liasse fiscale N-1',
          'Bilan / liasse fiscale N-2',
          "Avis d'imposition (année N-1)",
        ],
      };
      proCategory = {
        type: 'PRO',
        label: 'Activité professionnelle',
        hint: 'Statut entreprise + cotisations',
        expectedCount: 2,
        expectedItems: ['Extrait Kbis ou avis SIRENE', 'Attestation URSSAF'],
      };
      break;

    case 'ETUDIANT':
      financeCategory = {
        type: 'FINANCE',
        label: 'Ressources financières',
        hint: 'Bourse / aides + avis fiscal',
        expectedCount: 2,
        expectedItems: [
          'Notification de bourse CROUS ou justificatif de ressources',
          "Avis d'imposition (ou avis parental si à charge)",
        ],
      };
      proCategory = {
        type: 'PRO',
        label: 'Scolarité',
        hint: 'Établissement et cursus en cours',
        expectedCount: 1,
        expectedItems: ['Certificat de scolarité ou attestation d\'inscription'],
      };
      break;

    case 'RETRAITE':
      financeCategory = {
        type: 'FINANCE',
        label: 'Revenus de retraite',
        hint: 'Pension + avis fiscal',
        expectedCount: 2,
        expectedItems: [
          'Bulletin de pension (3 derniers mois)',
          "Avis d'imposition (année N-1)",
        ],
      };
      proCategory = null; // pas d'activité pour les retraités
      break;

    case 'AUTRE':
    default:
      financeCategory = {
        type: 'FINANCE',
        label: 'Ressources financières',
        hint: 'Tous justificatifs de revenus',
        expectedCount: 2,
        expectedItems: [
          'Justificatif de ressources',
          "Avis d'imposition (année N-1)",
        ],
      };
      proCategory = {
        type: 'PRO',
        label: 'Activité',
        hint: 'Justificatif d\'activité ou de situation',
        expectedCount: 1,
        expectedItems: ['Justificatif d\'activité ou de situation'],
      };
      break;
  }

  // ─── Catégorie Domicile (commune) ────────────────────────────────────
  const addressCategory: CategorySpec = {
    type: 'ADDRESS',
    label: 'Domicile',
    hint: 'Justificatif de moins de 3 mois',
    expectedCount: 1,
    expectedItems: ['Justificatif de domicile (facture / quittance)'],
  };

  return [idCategory, financeCategory, ...(proCategory ? [proCategory] : []), addressCategory];
}

/** Backward compat — utilisé par la démo + autres composants */
export const REQUIRED_CATEGORIES = getRequiredCategories('SALARIE', false);

interface CategoryGroup {
  spec: CategorySpec;
  received: DossierDocument[];
  missingCount: number;
  /** Labels des pièces manquantes (slots à remplir) */
  missingLabels: string[];
  /** Si autoComplete présent → catégorie validée par certificateur tiers */
  isAutoComplete: boolean;
}

/**
 * Regroupe les documents reçus par catégorie + calcule les manquants
 * à partir des `expectedItems` configurés.
 *
 * @param documents Pièces reçues du dossier
 * @param categories Config des catégories (générée par getRequiredCategories)
 */
function groupByCategory(
  documents: DossierDocument[],
  categories: CategorySpec[],
): CategoryGroup[] {
  return categories.map((spec) => {
    const received = documents.filter(
      (d) => d.type === spec.type && d.transmissionStatus === 'received',
    );
    const isAutoComplete = !!spec.autoComplete;
    const missingCount = isAutoComplete
      ? 0
      : Math.max(0, spec.expectedCount - received.length);
    const missingLabels =
      missingCount > 0 ? spec.expectedItems.slice(-missingCount) : [];
    return { spec, received, missingCount, missingLabels, isAutoComplete };
  });
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

/**
 * Slot virtuel "Identité Didit certifiée" — remplace la pièce CNI quand
 * le candidat a complété la vérification biométrique Didit.
 */
function DiditCertifiedSlot({
  reason,
  certifier,
}: {
  reason: string;
  certifier: string;
}): React.ReactElement {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 ring-1 ring-emerald-200">
        <ShieldCheck className="h-5 w-5 flex-shrink-0 text-emerald-700" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-sm font-semibold text-emerald-900" title={reason}>
          {reason}
        </p>
        <p className="mt-0.5 text-xs text-emerald-700">
          Aucune pièce à fournir — l'identité est validée par {certifier}.
        </p>
      </div>
      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800 ring-1 ring-emerald-300">
        <ShieldCheck className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        Biométrie certifiée
      </span>
    </li>
  );
}

function MissingSlot({ label, Icon }: { label: string; Icon: React.ElementType }): React.ReactElement {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 ring-1 ring-amber-200">
        <Icon className="h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-sm font-semibold text-amber-900" title={label}>
          {label}
        </p>
        <p className="mt-0.5 text-xs text-amber-700">
          Pièce manquante — non transmise par le candidat
        </p>
      </div>
      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800 ring-1 ring-amber-300">
        <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        À fournir
      </span>
    </li>
  );
}

function CategorySectionHeader({
  group,
}: {
  group: CategoryGroup;
}): React.ReactElement {
  const Icon = getDocumentIcon(group.spec.type);
  const total = group.spec.expectedCount;
  const got = group.received.length;
  const complete = group.missingCount === 0;
  const isDiditCertified = group.isAutoComplete;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 sm:gap-4">
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ${
          complete
            ? 'bg-emerald-50 ring-emerald-200'
            : 'bg-amber-50 ring-amber-200'
        }`}
      >
        <Icon
          className={`h-5 w-5 flex-shrink-0 ${
            complete ? 'text-emerald-700' : 'text-amber-700'
          }`}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-serif text-base font-bold leading-tight text-emerald-900 sm:text-lg">
          {group.spec.label}
        </h3>
        <p className="mt-0.5 truncate text-xs text-slate-500" title={group.spec.hint}>
          {group.spec.hint}
        </p>
      </div>
      <span
        className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${
          complete
            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
            : 'bg-amber-50 text-amber-800 ring-amber-200'
        }`}
      >
        {complete ? (
          <ShieldCheck className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        ) : (
          <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        )}
        {isDiditCertified
          ? 'Certifié Didit'
          : `${got}/${total} ${complete ? 'complet' : 'reçus'}`}
      </span>
    </div>
  );
}

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
  // V5.10 — Fix bouton "Consulter" : on autorise le clic dès que la pièce
  // est reçue, même si l'URL est manquante. Le SecureDocumentViewer affiche
  // alors un placeholder "Aperçu indisponible" plutôt que de bloquer l'action.
  // Avant : `received && !!doc.url` → bouton grisé pour les pièces sans URL
  // exposée par l'API (cas fréquent quand fileUrl est interne /uploads/).
  const canConsult = doc.transmissionStatus === 'received';
  const hasUrl = !!doc.url;

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
  profile,
  diditVerified = false,
  score,
  scoring,
  documents,
  viewerIdentity,
  allowDownload = false,
  showScoring = true,
  showHeader = true,
  loading = false,
  error = null,
  className = '',
}: CandidateDossierProps): React.ReactElement {
  const [activeDoc, setActiveDoc] = React.useState<DossierDocument | null>(null);

  const safeScore = Math.max(0, Math.min(100, Math.round(score || 0)));
  const breakdown = scoring || defaultScoring(safeScore);

  // V5.8 — Résolution profil + catégories adaptatives
  const resolvedProfile = React.useMemo<CandidateProfile>(
    () => profile || normalizeProfile(candidateJob),
    [profile, candidateJob],
  );
  const categories = React.useMemo(
    () => getRequiredCategories(resolvedProfile, diditVerified),
    [resolvedProfile, diditVerified],
  );

  // Statistiques globales
  const receivedCount = documents.filter((d) => d.transmissionStatus === 'received').length;
  const verifiedCount = documents.filter((d) => d.auditStatus === 'verified').length;
  const alteredCount = documents.filter((d) => d.auditStatus === 'altered').length;
  const totalExpected = React.useMemo(
    () => categories.reduce((sum, cat) => sum + cat.expectedCount, 0),
    [categories],
  );
  const totalMissing = React.useMemo(
    () =>
      groupByCategory(documents, categories).reduce(
        (sum, g) => sum + g.missingCount,
        0,
      ),
    [documents, categories],
  );

  return (
    <div className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 ${className}`}>
      {/* ─── Header optionnel (nom candidat) ─────────────────────────────── */}
      {showHeader && (candidateName || candidateJob) && (
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
      {showScoring && (
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
      )}

      {/* ─── Loading / Error states ───────────────────────────────────────── */}
      {loading && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div
            className="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"
            aria-hidden="true"
          />
          <p className="text-sm text-slate-600">
            Chargement des pièces du dossier…
          </p>
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              Impossible de charger les pièces
            </p>
            <p className="mt-0.5 text-xs text-red-700">{error}</p>
          </div>
        </div>
      )}

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
            {receivedCount}/{totalExpected} reçus · {verifiedCount} vérifiés
            {totalMissing > 0 && ` · ${totalMissing} manquant${totalMissing > 1 ? 's' : ''}`}
            {alteredCount > 0 && ` · ${alteredCount} altéré${alteredCount > 1 ? 's' : ''}`}
          </p>
        </div>

        {/* V5.8 — Groupement par catégorie + slots manquants + Didit auto ─── */}
        {(() => {
          const groups = groupByCategory(documents, categories);
          // Documents reçus mais hors catégories standard
          const orphanDocs = documents.filter(
            (d) =>
              d.transmissionStatus === 'received' &&
              !categories.some((cat) => cat.type === d.type),
          );
          const allEmpty =
            documents.length === 0 &&
            groups.every((g) => g.received.length === 0 && !g.isAutoComplete);

          if (allEmpty && !loading) {
            return (
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
            );
          }

          return (
            <div className="space-y-8">
              {groups.map((group) => {
                const CategoryIcon = getDocumentIcon(group.spec.type);
                return (
                  <section
                    key={group.spec.type}
                    aria-label={`Catégorie ${group.spec.label}`}
                  >
                    <CategorySectionHeader group={group} />
                    <ul className="flex flex-col gap-3">
                      {/* V5.8 — Slot virtuel Didit (auto-complete) en premier */}
                      {group.isAutoComplete && group.spec.autoComplete && (
                        <DiditCertifiedSlot
                          reason={group.spec.autoComplete.reason}
                          certifier={group.spec.autoComplete.certifier}
                        />
                      )}
                      {group.received.map((doc) => (
                        <DocumentRow
                          key={doc.id}
                          doc={doc}
                          onConsult={() => setActiveDoc(doc)}
                        />
                      ))}
                      {group.missingLabels.map((label, idx) => (
                        <MissingSlot
                          key={`${group.spec.type}-missing-${idx}`}
                          label={label}
                          Icon={CategoryIcon}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}

              {/* Documents hors catégories standard (ex: documents garant
                  reçus avec subjectType garant — affichés à part) */}
              {orphanDocs.length > 0 && (
                <section aria-label="Pièces complémentaires">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                      <FileText className="h-5 w-5 flex-shrink-0 text-slate-600" aria-hidden="true" />
                    </div>
                    <h3 className="font-serif text-base font-bold leading-tight text-emerald-900 sm:text-lg">
                      Pièces complémentaires
                    </h3>
                  </div>
                  <ul className="flex flex-col gap-3">
                    {orphanDocs.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        onConsult={() => setActiveDoc(doc)}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          );
        })()}
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
                // V5.12 — Passer les données IA au viewer pour aperçu synthétique
                fileName: activeDoc.fileName,
                uploadedAt: activeDoc.uploadedAt,
                dateEmission: activeDoc.dateEmission,
                aiInsights: activeDoc.aiInsights,
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
    fileName: 'cni_louna_bernasconi.jpg',
    uploadedAt: '2026-05-12T09:32:00.000Z',
    aiInsights: {
      documentType: "Carte Nationale d'Identité",
      confidence: 0.99,
      summary:
        'Pièce d\'identité française authentique. MRZ vérifié. Date d\'expiration valide. Identité biométrique alignée avec la session Didit.',
      fraudScore: 0.02,
      extractedFields: {
        nom: 'Bernasconi',
        prenom: 'Louna',
        dateNaissance: '1994-03-18',
        lieuNaissance: 'Paris',
        nationalite: 'Française',
        numeroPiece: '17AB12345',
        dateExpiration: '2032-04-22',
      },
    },
  },
  {
    id: 'doc_2',
    name: 'Fiches de paie (3 derniers mois)',
    type: 'FINANCE',
    transmissionStatus: 'received',
    auditStatus: 'verified',
    auditMessage: 'Logiciel RH détecté (SILAE). Calcul URSSAF exact.',
    url: null,
    fileName: 'fiches_paie_T1_2026.pdf',
    uploadedAt: '2026-05-12T09:34:11.000Z',
    dateEmission: '2026-04-30',
    aiInsights: {
      documentType: 'Bulletins de salaire (mars, février, janvier 2026)',
      confidence: 0.97,
      summary:
        'Bulletins authentiques générés par SILAE. Net à payer cohérent sur 3 mois. Cotisations sociales conformes aux taux URSSAF 2026. Aucune trace d\'édition manuelle.',
      fraudScore: 0.04,
      extractedFields: {
        employeur: 'TechSolutions France SAS',
        siret: '82345678900015',
        poste: 'Cheffe de Projet Sénior',
        contractType: 'CDI',
        dateEmbauche: '2023-09-04',
        netAPayer: 3450,
        salaireBrut: 4520,
        netImposable: 3680,
        periode: 'Janvier-Mars 2026',
      },
      flags: [],
    },
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
    url: null,
    fileName: 'avis_impots_2025.pdf',
    uploadedAt: '2026-05-12T09:36:42.000Z',
    dateEmission: '2025-08-15',
    aiInsights: {
      documentType: "Avis d'imposition sur les revenus 2024",
      confidence: 0.82,
      summary:
        "Avis d'imposition cohérent avec les fiches de paie déclarées. Signature manuscrite ajoutée — vérification visuelle recommandée pour confirmer l'authenticité de la signature.",
      fraudScore: 0.12,
      extractedFields: {
        revenuFiscalReference: 39800,
        nombreParts: 1,
        situationFamiliale: 'Célibataire',
        anneeRevenus: 2024,
        impotNet: 3210,
      },
      flags: ['Signature manuscrite à confirmer'],
    },
  },
  {
    id: 'doc_5',
    name: 'Justificatif de domicile',
    type: 'ADDRESS',
    transmissionStatus: 'received',
    auditStatus: 'verified',
    auditMessage: 'Facture EDF authentique (émise il y a 14 jours).',
    url: null,
    fileName: 'edf_facture_avril_2026.pdf',
    uploadedAt: '2026-05-12T09:38:05.000Z',
    dateEmission: '2026-04-28',
    aiInsights: {
      documentType: "Facture d'électricité EDF",
      confidence: 0.98,
      summary:
        'Facture EDF authentique. Référence client vérifiée. Adresse cohérente avec la déclaration du candidat. Émise il y a moins de 30 jours.',
      fraudScore: 0.01,
      extractedFields: {
        fournisseur: 'EDF',
        referenceClient: '5837192406',
        adresse: '14 rue Oberkampf, 75011 Paris',
        montantTotal: 87.45,
        periode: '01/03/2026 - 31/03/2026',
      },
    },
  },
];

export function CandidateDossierDemo(): React.ReactElement {
  // V5.8 — Toggle pour visualiser plusieurs profils + Didit
  const [profile, setProfile] = React.useState<CandidateProfile>('SALARIE');
  const [diditVerified, setDiditVerified] = React.useState(true);

  const profileJob: Record<CandidateProfile, { job: string; name: string }> = {
    SALARIE: { job: 'CDI · Cadre du Secteur Privé · Paris 11e', name: 'Louna Bernasconi' },
    INDEPENDANT: { job: 'Freelance · Designer UX/UI', name: 'Marc Dupont' },
    ETUDIANT: { job: 'Étudiant · Master 2 Droit', name: 'Léa Martin' },
    RETRAITE: { job: 'Retraitée · Ancienne enseignante', name: 'Claire Lefèvre' },
    AUTRE: { job: 'Profession libérale', name: 'Sophie Cohen' },
  };

  const current = profileJob[profile];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toggle sticky top pour la démo */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Démo · Profils
          </p>
          <div className="flex flex-wrap gap-2">
            {(['SALARIE', 'INDEPENDANT', 'ETUDIANT', 'RETRAITE'] as CandidateProfile[]).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProfile(p)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                    profile === p
                      ? 'bg-emerald-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {getProfileLabel(p)}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setDiditVerified((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                diditVerified
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              Didit {diditVerified ? 'OUI' : 'NON'}
            </button>
          </div>
        </div>
      </div>

      <CandidateDossier
        candidateName={current.name}
        candidateJob={current.job}
        profile={profile}
        diditVerified={diditVerified}
        score={98}
        documents={DEMO_DOCUMENTS}
        viewerIdentity="Démo · Propriétaire #PT-2026"
      />
    </div>
  );
}
