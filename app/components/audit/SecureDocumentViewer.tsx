'use client';

/**
 * <SecureDocumentViewer> — Visionneuse sécurisée des pièces du dossier.
 *
 * Affiche un PDF / image avec une couche filigranée (watermark) répétitive
 * inclinée à 45° pour empêcher la réutilisation malveillante du document
 * (captures d'écran, photos de l'écran).
 *
 * Conçu pour le contexte "Audit Forensic Banque Privée" — l'utilisateur
 * doit avoir l'impression de consulter un coffre-fort certifié.
 *
 * V5.9 — Rendu via React Portal au niveau du document.body pour échapper
 * au stacking context de la modale parente (CandidateAuditModal). Sans
 * portal, le motion.div parent crée un nouveau contexte qui piège les
 * enfants `fixed` et empêche le viewer de couvrir tout l'écran.
 *
 * Respecte les règles de Design Défensif :
 *   - Toutes les icônes ont w-X h-X flex-shrink-0
 *   - Texte du document name avec truncate + title
 *   - z-index : backdrop z-[400] / panel z-[401] (au-dessus de toute
 *     modale parente — l'app ne dépasse jamais z-[300] ailleurs)
 *   - Watermark : z-10 relatif au panel (stacking context isolé)
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  AlertCircle,
  Lock,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentAuditStatus = 'verified' | 'manual_review' | 'altered' | 'pending';

export interface DocumentAiInsights {
  /** Type de document détecté par l'IA (ex: "Fiche de paie", "CNI") */
  documentType?: string | null;
  /** Confiance de l'IA (0–1) */
  confidence?: number | null;
  /** Synthèse rédigée par l'IA */
  summary?: string | null;
  /** Score de fraude (0–1, 0 = aucun risque) */
  fraudScore?: number | null;
  /** Flags / alertes détectées */
  flags?: string[];
  /** Champs extraits (clé → valeur) — ex: { netAPayer: 2850, employeur: "..." } */
  extractedFields?: Record<string, unknown>;
}

export interface SecureDocument {
  id: string;
  name: string;
  type: string;
  /** URL du fichier à afficher (PDF, JPG, PNG…) */
  url: string | null;
  /** Statut de l'audit IA */
  auditStatus: DocumentAuditStatus;
  /** Message court à afficher dans le badge */
  auditMessage?: string;
  /** V5.12 — Nom du fichier original */
  fileName?: string | null;
  /** V5.12 — Date d'upload (ISO) */
  uploadedAt?: string | null;
  /** V5.12 — Date d'émission du document (si extraite) */
  dateEmission?: string | null;
  /** V5.12 — Données extraites par l'IA pour aperçu synthétique */
  aiInsights?: DocumentAiInsights;
}

export interface SecureDocumentViewerProps {
  open: boolean;
  document: SecureDocument | null;
  onClose: () => void;
  /** Texte répété en filigrane (par défaut générique) */
  watermarkText?: string;
  /** Identifiant unique du viewer (utilisateur connecté, horodatage) pour
   *  traçabilité dans le watermark — affiché en bas de chaque répétition */
  viewerIdentity?: string;
  /** Activer le bouton Download (par défaut désactivé pour sécurité) */
  allowDownload?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectMimeType(url: string | null): 'pdf' | 'image' | 'unknown' {
  if (!url) return 'unknown';
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.pdf')) return 'pdf';
  if (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif')
  ) {
    return 'image';
  }
  return 'unknown';
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
        label: 'Scan Forensic Validé',
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
        icon: AlertCircle,
        label: 'Altération détectée',
      };
    case 'pending':
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        ring: 'ring-slate-200',
        icon: Lock,
        label: 'En attente',
      };
  }
}

// ─── Sub-component : Watermark layer (motif répété 45° opacity faible) ──────

function WatermarkLayer({
  text,
  identity,
}: {
  text: string;
  identity?: string;
}): React.ReactElement {
  // Grille de répétitions pour couvrir tout le viewport
  // 5 colonnes × 8 lignes = 40 répétitions
  const cells = React.useMemo(() => {
    const arr: { row: number; col: number }[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 5; col++) {
        arr.push({ row, col });
      }
    }
    return arr;
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="grid h-full w-full -rotate-12"
        style={{
          gridTemplateColumns: 'repeat(5, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
        }}
      >
        {cells.map(({ row, col }) => (
          <div
            key={`${row}-${col}`}
            className="flex flex-col items-center justify-center text-center select-none"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-black/10 sm:text-xs">
              {text}
            </p>
            {identity && (
              <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-black/[0.07] sm:text-[9px]">
                {identity}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function SecureDocumentViewer({
  open,
  document,
  onClose,
  watermarkText,
  viewerIdentity,
  allowDownload = false,
  className = '',
}: SecureDocumentViewerProps): React.ReactElement {
  // ESC ferme le viewer
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll
    const originalOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  // Horodatage défensif inclus dans le watermark pour traçabilité
  const finalWatermark = React.useMemo(() => {
    return watermarkText || 'CONFIDENTIEL · PATRIMOTRUST · AUDIT STRICT';
  }, [watermarkText]);

  const finalIdentity = React.useMemo(() => {
    if (viewerIdentity) return viewerIdentity;
    const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return `Consulté le ${ts}`;
  }, [viewerIdentity]);

  const mimeType = document ? detectMimeType(document.url) : 'unknown';
  const audit = document ? getAuditBadge(document.auditStatus) : null;
  const AuditIcon = audit?.icon ?? ShieldCheck;
  const TypeIcon = mimeType === 'pdf' ? FileText : ImageIcon;

  // V5.9 — Mount portal target uniquement côté client (évite hydration mismatch)
  const [portalReady, setPortalReady] = React.useState(false);
  React.useEffect(() => {
    setPortalReady(true);
  }, []);

  if (!portalReady || typeof window === 'undefined') return <></>;

  const viewerNode = (
    <AnimatePresence>
      {open && document && (
        <>
          {/* Backdrop — click pour fermer */}
          <motion.div
            key="viewer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[400] bg-slate-950/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Viewer panel */}
          <motion.div
            key="viewer-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Visionneuse sécurisée : ${document.name}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed inset-4 z-[401] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:inset-8 ${className}`}
          >
            {/* ─── A. Header ───────────────────────────────────────────── */}
            <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
                  <TypeIcon
                    className="h-5 w-5 flex-shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    className="truncate font-serif text-base font-semibold text-emerald-900 sm:text-lg"
                    title={document.name}
                  >
                    {document.name}
                  </h2>
                  {audit && (
                    <p
                      className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${audit.bg} ${audit.text} ${audit.ring}`}
                    >
                      <AuditIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{audit.label}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                {/* Lock icon — signal visuel "protégé" */}
                <span
                  className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 ring-1 ring-slate-200 sm:inline-flex"
                  title="Document protégé par filigrane forensic"
                >
                  <Lock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                  Protégé
                </span>
                {allowDownload && document.url && (
                  <a
                    href={document.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900"
                    title="Télécharger le document"
                    aria-label="Télécharger le document"
                  >
                    <Download className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  aria-label="Fermer la visionneuse"
                >
                  <X className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* ─── B. Document viewer + Watermark layer ─────────────────── */}
            <div className="relative flex-1 overflow-hidden bg-slate-100">
              {/* Document */}
              <div className="relative h-full w-full overflow-auto">
                {document.url ? (
                  mimeType === 'pdf' ? (
                    <iframe
                      src={`${document.url}#toolbar=0&navpanes=0&scrollbar=0`}
                      title={document.name}
                      className="h-full w-full border-0 bg-white"
                    />
                  ) : mimeType === 'image' ? (
                    <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={document.url}
                        alt={document.name}
                        className="max-h-full max-w-full rounded-lg bg-white shadow-xl ring-1 ring-slate-200"
                        draggable={false}
                        onContextMenu={(e) => e.preventDefault()}
                      />
                    </div>
                  ) : (
                    <SecureDocumentPlaceholder
                      document={document}
                      reason="format-unknown"
                    />
                  )
                ) : (
                  /* V5.11 — Le bouton "Consulter" n'est cliquable que pour les
                     pièces reçues. Donc si on arrive ici sans URL, c'est que
                     l'URL n'a pas été exposée par l'API (pas que la pièce est
                     manquante). Message corrigé pour éviter l'incohérence. */
                  <SecureDocumentPlaceholder
                    document={document}
                    reason="no-preview"
                  />
                )}
              </div>

              {/* Watermark — couche supérieure, pointer-events-none */}
              <WatermarkLayer text={finalWatermark} identity={finalIdentity} />
            </div>

            {/* ─── C. Footer status ─────────────────────────────────────── */}
            <footer className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-6 sm:py-3">
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <Lock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                Filigrane forensic actif · Traçabilité PatrimoTrust
              </p>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:inline">
                {finalIdentity}
              </p>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // V5.9 — Rendu via portal au niveau du body pour échapper au stacking
  // context de la modale parente (CandidateAuditModal).
  return createPortal(viewerNode, window.document.body);
}

// ─── Aperçu synthétique IA (document sans URL ou format non prévisualisable) ──

/**
 * V5.12 — Rapport d'aperçu synthétique généré depuis les données extraites
 * par l'IA. Affiché à la place du PDF/image quand l'URL n'est pas exposée
 * ou que le format n'est pas prévisualisable.
 *
 * Le propriétaire voit :
 *  - Métadonnées (nom, date, type détecté)
 *  - Synthèse IA (summary)
 *  - Champs extraits clé/valeur (montant, employeur, etc.)
 *  - Confiance IA + score de fraude
 *  - Statut audit
 */
type PlaceholderReason = 'no-preview' | 'format-unknown';

/** Formatage humain d'une clé "snake_case" ou "camelCase" en label lisible */
function formatFieldKey(key: string): string {
  // Mapping commun (priorité aux libellés métier explicites)
  const known: Record<string, string> = {
    netAPayer: 'Net à payer',
    netImposable: 'Net imposable',
    salaireBrut: 'Salaire brut',
    employeur: 'Employeur',
    employer: 'Employeur',
    societe: 'Société',
    nomSociete: 'Société',
    poste: 'Poste',
    contractType: 'Type de contrat',
    dateEmbauche: "Date d'embauche",
    periode: 'Période',
    mois: 'Mois',
    annee: 'Année',
    revenuFiscalReference: 'Revenu fiscal de référence',
    revenuFiscal: 'Revenu fiscal',
    nom: 'Nom',
    prenom: 'Prénom',
    dateNaissance: 'Date de naissance',
    lieuNaissance: 'Lieu de naissance',
    numeroPiece: 'N° de pièce',
    dateExpiration: "Date d'expiration",
    nationalite: 'Nationalité',
    adresse: 'Adresse',
    codePostal: 'Code postal',
    ville: 'Ville',
    fournisseur: 'Fournisseur',
    referenceClient: 'Référence client',
    montantTotal: 'Montant total',
    siren: 'SIREN',
    siret: 'SIRET',
  };
  if (known[key]) return known[key];
  // Conversion automatique : snake_case → "Snake Case", camelCase → "Camel Case"
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Formatage humain d'une valeur extraite (number, string, date, object…) */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    // Heuristique : si nombre > 100, on suppose un montant euro
    if (Number.isFinite(value) && value > 100 && value < 1_000_000_000) {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return new Intl.NumberFormat('fr-FR').format(value);
  }
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'string') {
    // Détection date ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
        }
      } catch {
        /* ignore */
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatFieldValue(v)).join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 0).slice(0, 80);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Affiche une date ISO sous forme lisible française */
function formatDateLong(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function SecureDocumentPlaceholder({
  document,
  reason,
}: {
  document: SecureDocument;
  reason: PlaceholderReason;
}): React.ReactElement {
  const auditStyle = getAuditBadge(document.auditStatus);
  const AuditIcon = auditStyle.icon;
  const ai = document.aiInsights;

  // Filtre les champs extraits significatifs (non vides) — max 12 pour rester lisible
  const extractedEntries = React.useMemo(() => {
    const fields = ai?.extractedFields || {};
    return Object.entries(fields)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 12);
  }, [ai?.extractedFields]);

  const confidencePct =
    typeof ai?.confidence === 'number' ? Math.round(ai.confidence * 100) : null;
  const fraudPct =
    typeof ai?.fraudScore === 'number' ? Math.round(ai.fraudScore * 100) : null;
  const uploadedLabel = formatDateLong(document.uploadedAt);
  const emissionLabel = formatDateLong(document.dateEmission);
  const hasRichData =
    !!(ai?.summary || extractedEntries.length > 0 || ai?.documentType);

  return (
    <div className="h-full w-full overflow-auto bg-gradient-to-br from-slate-100 via-white to-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-8">
        {/* Header : eyebrow + titre + raison */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
            <FileText
              className="h-6 w-6 flex-shrink-0 text-emerald-700"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
              Aperçu synthétique IA
            </p>
            <h3
              className="font-serif text-xl font-semibold leading-tight text-emerald-900"
              title={document.name}
            >
              {ai?.documentType || document.name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {reason === 'format-unknown'
                ? 'Format non prévisualisable — extraction IA ci-dessous'
                : 'Aperçu du fichier non exposé — extraction IA ci-dessous'}
            </p>
          </div>
        </div>

        {/* Bloc Audit Forensic */}
        <div className={`mb-4 rounded-xl border ${auditStyle.ring} ${auditStyle.bg} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              <AuditIcon
                className={`h-4 w-4 flex-shrink-0 ${auditStyle.text}`}
                aria-hidden="true"
              />
              <span className={`text-xs font-bold uppercase tracking-[0.14em] ${auditStyle.text}`}>
                {auditStyle.label}
              </span>
            </div>
            {confidencePct !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">
                Confiance {confidencePct}%
              </span>
            )}
          </div>
          {document.auditMessage && (
            <p className={`mt-2 text-xs leading-relaxed ${auditStyle.text}`}>
              {document.auditMessage}
            </p>
          )}
        </div>

        {/* Synthèse IA (si disponible) */}
        {ai?.summary && (
          <div className="mb-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              <ShieldCheck className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              Synthèse de l'IA
            </p>
            <p className="font-serif text-sm italic leading-relaxed text-slate-800">
              {ai.summary}
            </p>
          </div>
        )}

        {/* Champs extraits */}
        {extractedEntries.length > 0 && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
              Données extraites par l'IA
            </p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {extractedEntries.map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {formatFieldKey(key)}
                  </dt>
                  <dd className="mt-0.5 truncate font-medium text-sm text-emerald-900" title={String(value)}>
                    {formatFieldValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Métadonnées (filename, dates) */}
        {(document.fileName || uploadedLabel || emissionLabel || fraudPct !== null) && (
          <div className="mb-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {document.fileName && (
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Fichier
                </p>
                <p className="mt-0.5 truncate font-medium text-slate-700" title={document.fileName}>
                  {document.fileName}
                </p>
              </div>
            )}
            {uploadedLabel && (
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Transmis le
                </p>
                <p className="mt-0.5 font-medium text-slate-700">{uploadedLabel}</p>
              </div>
            )}
            {emissionLabel && (
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Émis le
                </p>
                <p className="mt-0.5 font-medium text-slate-700">{emissionLabel}</p>
              </div>
            )}
            {fraudPct !== null && (
              <div
                className={`rounded-lg px-3 py-2 ${
                  fraudPct < 15
                    ? 'bg-emerald-50'
                    : fraudPct < 40
                    ? 'bg-amber-50'
                    : 'bg-red-50'
                }`}
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Score de fraude
                </p>
                <p
                  className={`mt-0.5 font-bold ${
                    fraudPct < 15
                      ? 'text-emerald-700'
                      : fraudPct < 40
                      ? 'text-amber-700'
                      : 'text-red-700'
                  }`}
                >
                  {fraudPct}% {fraudPct < 15 ? '· Aucun risque' : fraudPct < 40 ? '· À surveiller' : '· Élevé'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Flags / alertes IA */}
        {ai?.flags && ai.flags.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800">
              <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              Points de vigilance détectés
            </p>
            <ul className="space-y-1.5">
              {ai.flags.map((flag, i) => (
                <li
                  key={`${flag}-${i}`}
                  className="flex items-start gap-2 text-xs text-amber-900"
                >
                  <span
                    className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-600"
                    aria-hidden="true"
                  />
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer rassurant */}
        <p className="mt-4 border-t border-slate-100 pt-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {hasRichData
            ? '✓ Pièce transmise · Données extraites par l\'IA'
            : "✓ Pièce transmise · Aperçu visuel non disponible"}
        </p>
      </div>
    </div>
  );
}
