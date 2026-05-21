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
 * Respecte les règles de Design Défensif :
 *   - Toutes les icônes ont w-X h-X flex-shrink-0
 *   - Texte du document name avec truncate + title
 *   - z-index local (z-[201] modal panel, z-[210] watermark layer
 *     interne à la modal — toujours < z-50 global nav extérieure)
 */

import * as React from 'react';
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
      className="pointer-events-none absolute inset-0 z-[210] overflow-hidden"
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

  return (
    <AnimatePresence>
      {open && document && (
        <>
          {/* Backdrop */}
          <motion.div
            key="viewer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm"
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
            className={`fixed inset-4 z-[201] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:inset-8 ${className}`}
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
                    <SecureDocumentPlaceholder document={document} />
                  )
                ) : (
                  <SecureDocumentPlaceholder document={document} missing />
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
}

// ─── Placeholder (document absent ou type inconnu) ───────────────────────────

function SecureDocumentPlaceholder({
  document,
  missing = false,
}: {
  document: SecureDocument;
  missing?: boolean;
}): React.ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-50 p-8">
      <div className="max-w-md rounded-2xl bg-white p-10 text-center shadow-xl ring-1 ring-slate-200">
        <div className="mx-auto mb-5 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
          {missing ? (
            <AlertCircle className="h-7 w-7 flex-shrink-0 text-amber-600" aria-hidden="true" />
          ) : (
            <FileText className="h-7 w-7 flex-shrink-0 text-emerald-700" aria-hidden="true" />
          )}
        </div>
        <h3 className="font-serif text-xl font-semibold text-emerald-900">
          {missing ? 'Document non transmis' : 'Aperçu indisponible'}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          {missing
            ? `Le candidat n'a pas encore transmis "${document.name}". Une relance peut être envoyée depuis le tableau de bord.`
            : `Le format du document ne permet pas un affichage direct. Téléchargez le fichier pour le consulter.`}
        </p>
      </div>
    </div>
  );
}
