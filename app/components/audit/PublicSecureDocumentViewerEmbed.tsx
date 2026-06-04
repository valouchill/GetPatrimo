'use client';

import * as React from 'react';
import { AlertCircle, Eye, FileText, ShieldCheck, Sparkles, XCircle } from 'lucide-react';
import { SecureDocumentViewer, type SecureDocument } from '@/app/components/audit/SecureDocumentViewer';

type PublicAuditStatus = 'verified' | 'manual_review' | 'altered' | 'pending';

interface PublicDocument {
  id: string;
  name: string;
  category?: string | null;
  auditStatus: PublicAuditStatus;
  url: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  dateEmission: string | null;
  aiInsights?: {
    documentType?: string | null;
    confidence?: number | null;
    summary?: string | null;
    fraudScore?: number | null;
    flags?: string[];
    extractedFields?: Record<string, unknown>;
  };
}

function pickAuditStyle(status: PublicAuditStatus) {
  switch (status) {
    case 'verified':
      return {
        icon: ShieldCheck,
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        ring: 'ring-emerald-200',
        label: 'Vérifié — Authenticité validée',
      };
    case 'manual_review':
      return {
        icon: AlertCircle,
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        ring: 'ring-amber-200',
        label: 'Contrôle manuel requis',
      };
    case 'altered':
      return {
        icon: XCircle,
        bg: 'bg-red-50',
        text: 'text-red-800',
        ring: 'ring-red-200',
        label: 'Altération détectée',
      };
    case 'pending':
    default:
      return {
        icon: Sparkles,
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        ring: 'ring-slate-200',
        label: "En cours d'analyse",
      };
  }
}

function formatExtractedValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    if (Number.isFinite(value) && value > 100) {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toLocaleString('fr-FR');
  }
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 90);
  return String(value);
}

export function PublicSecureDocumentViewerEmbed({
  document,
}: {
  document: PublicDocument;
}): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const audit = pickAuditStyle(document.auditStatus);
  const AuditIcon = audit.icon;
  const teaserFields = React.useMemo(
    () => Object.entries(document.aiInsights?.extractedFields || {}).slice(0, 3),
    [document.aiInsights?.extractedFields],
  );

  const secureDoc: SecureDocument = {
    id: document.id,
    name: document.name,
    type: document.category || 'OTHER',
    url: null,
    auditStatus: document.auditStatus,
    auditMessage: document.aiInsights?.summary || undefined,
    fileName: document.fileName,
    uploadedAt: document.uploadedAt,
    dateEmission: document.dateEmission,
    aiInsights: document.aiInsights,
  };

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
            <FileText className="h-6 w-6 flex-shrink-0 text-emerald-700" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="truncate font-serif text-base font-semibold text-emerald-900 sm:text-lg"
              title={document.aiInsights?.documentType || document.name}
            >
              {document.aiInsights?.documentType || document.name}
            </h3>
            <p
              className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ${audit.bg} ${audit.text} ${audit.ring}`}
            >
              <AuditIcon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {audit.label}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-900 transition-colors hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 sm:text-sm"
          aria-label={`Voir l'aperçu sécurisé de ${document.name}`}
        >
          <Eye className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Voir l'aperçu sécurisé
        </button>
      </div>

      {teaserFields.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 sm:px-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Aperçu données extraites par l'IA
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-3">
            {teaserFields.map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                </dt>
                <dd className="mt-0.5 truncate text-xs font-medium text-emerald-900" title={formatExtractedValue(value)}>
                  {formatExtractedValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <SecureDocumentViewer
        open={open}
        document={secureDoc}
        onClose={() => setOpen(false)}
        watermarkText="PATRIMOTRUST · CONSULTATION PUBLIQUE · INSCRIPTION REQUISE"
        viewerIdentity={`Consultation publique · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`}
      />
    </article>
  );
}
