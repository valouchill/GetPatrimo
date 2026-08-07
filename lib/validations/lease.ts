import { z } from 'zod';

export const CompileLeaseSchema = z.object({
  propertyId: z.string().min(1, 'propertyId requis'),
  applicationId: z.string().optional(),
  candidatureId: z.string().optional(),
  formData: z.record(z.string(), z.unknown()).optional(),
});

export const CreateLeaseSchema = z.object({
  propertyId: z.string().min(1, 'propertyId requis'),
  applicationId: z.string().optional(),
  candidatureId: z.string().optional(),
  tenantFirstName: z.string().min(1, 'Prénom du locataire requis'),
  tenantLastName: z.string().min(1, 'Nom du locataire requis'),
  tenantEmail: z.string().email('Email invalide'),
  tenantPhone: z.string().optional().default(''),
  leaseType: z.enum(['VIDE', 'MEUBLE', 'MOBILITE', 'GARAGE_PARKING']),
  startDate: z.string().min(1, 'Date de début requise'),
  durationMonths: z.number().int().min(1),
  rentAmount: z.number().min(0),
  chargesAmount: z.number().min(0).default(0),
  depositAmount: z.number().min(0).default(0),
  paymentDay: z.number().int().min(1).max(31).default(5),
  additionalClauses: z.string().optional().default(''),
  generatedDocuments: z.array(z.object({
    kind: z.string(),
    template: z.string().optional().default(''),
    fileName: z.string(),
    mimeType: z.string(),
    // Sécurité : ces chemins viennent du CLIENT et sont ensuite lus sur disque
    // (et servis publiquement au signataire) → strictement confinés au dossier
    // des baux compilés, sans traversal. L'appartenance au compte est vérifiée
    // en plus côté route (préfixe userId posé par persistArtifact).
    docxPath: z.string().regex(/^uploads\/leases\/compiled\/[A-Za-z0-9._-]+\.docx$/).optional(),
    pdfPath: z.string().regex(/^uploads\/leases\/compiled\/[A-Za-z0-9._-]+\.pdf$/).optional(),
  })).optional().default([]),
});

export const SelectionSchema = z.object({
  applicationId: z.string().min(1, 'applicationId requis'),
});

// ─── Diagnostic expiry check (loi ALUR — Code construction art. L.271-4) ───

interface Diagnostic {
  type: string;
  expiryDate?: Date | string | null;
  isValid?: boolean;
}

interface DiagnosticWarning {
  type: string;
  label: string;
  expiryDate: string | null;
  message: string;
}

const DIAGNOSTIC_LABELS: Record<string, string> = {
  DPE: 'Diagnostic de performance énergétique',
  CREP: 'Constat de risque d\'exposition au plomb',
  AMIANTE: 'État d\'amiante',
  ELECTRICITE: 'Diagnostic électricité',
  GAZ: 'Diagnostic gaz',
  ERP: 'État des risques et pollutions',
  ELEC_GAZ: 'Diagnostic électricité/gaz',
  PLOMB: 'Diagnostic plomb',
};

// ─── Notice period validation (loi 89-462 art. 15 / loi ALUR / loi ÉLAN) ───

interface NoticePeriodParams {
  leaseType: string;
  initiatedBy: 'OWNER' | 'TENANT';
  requestedExitDate?: Date | string | null;
}

interface NoticePeriodResult {
  noticePeriodMonths: number;
  minimumExitDate: Date;
  warning: string | null;
}

/**
 * Calcule et valide le préavis de résiliation.
 * Propriétaire : 6 mois (vide) / 3 mois (meublé) — loi 89-462 art. 15
 * Locataire : 3 mois (vide, 1 mois zone tendue) / 1 mois (meublé/mobilité)
 */
export function validateNoticePeriod(params: NoticePeriodParams): NoticePeriodResult {
  const type = (params.leaseType || '').toUpperCase();
  let noticePeriodMonths: number;

  if (params.initiatedBy === 'TENANT') {
    noticePeriodMonths = (type === 'MEUBLE' || type === 'MOBILITE') ? 1 : 3;
  } else {
    noticePeriodMonths = type === 'MEUBLE' ? 3 : 6;
  }

  const now = new Date();
  const minimumExitDate = new Date(now);
  minimumExitDate.setMonth(minimumExitDate.getMonth() + noticePeriodMonths);

  let warning: string | null = null;

  if (params.requestedExitDate) {
    const requested = new Date(params.requestedExitDate);
    if (requested < minimumExitDate) {
      const legalRef = params.initiatedBy === 'OWNER'
        ? 'art. 15 de la loi du 6 juillet 1989'
        : 'art. 15 de la loi du 6 juillet 1989 / art. 25-8 loi ALUR';
      warning = `La date de sortie demandée (${requested.toLocaleDateString('fr-FR')}) est antérieure au délai légal de préavis de ${noticePeriodMonths} mois (${legalRef}). Date minimum : ${minimumExitDate.toLocaleDateString('fr-FR')}.`;
    }
  }

  return { noticePeriodMonths, minimumExitDate, warning };
}

/**
 * Vérifie les dates d'expiration des diagnostics techniques obligatoires.
 * Retourne un tableau de warnings (pas de blocage).
 */
export function checkDiagnosticExpiry(diagnostics: Diagnostic[]): DiagnosticWarning[] {
  if (!diagnostics?.length) return [];

  const now = new Date();
  const warnings: DiagnosticWarning[] = [];

  for (const diag of diagnostics) {
    if (!diag.expiryDate) continue;

    const expiry = new Date(diag.expiryDate);
    if (expiry <= now) {
      warnings.push({
        type: diag.type,
        label: DIAGNOSTIC_LABELS[diag.type] || diag.type,
        expiryDate: expiry.toISOString().split('T')[0],
        message: `Le ${DIAGNOSTIC_LABELS[diag.type] || diag.type} a expiré le ${expiry.toLocaleDateString('fr-FR')}. Un nouveau diagnostic est requis avant la signature du bail (art. L.271-4 Code de la construction).`,
      });
    }
  }

  return warnings;
}
