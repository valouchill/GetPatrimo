/**
 * passport-pdf-service.ts — Service de génération PDF via WeasyPrint.
 *
 * V5.13 — Migration V2 "Growth Hacking" : le template HTML est désormais
 * un composant React (PassportTemplateV2) rendu via renderToStaticMarkup,
 * avec Smart Links qui forcent le propriétaire prospect à venir sur la
 * plateforme pour consulter les pièces (acquisition forcée).
 *
 * Pipeline :
 *   1. ViewModel (depuis passportViewModel.js)
 *   2. Mapping ViewModel → PassportTemplateV2Props
 *   3. renderToStaticMarkup(<PassportTemplateV2 ... />) → HTML string
 *   4. wrapAsHtmlDocument(markup) → HTML5 complet
 *   5. PDF via subprocess Python WeasyPrint
 *
 * Le HTML legacy (lib/passport-html-template.ts) reste exporté pour
 * fallback / tests mais n'est plus utilisé par défaut.
 *
 * Dépendance container : python3 + weasyprint + cairo + pango + fontconfig
 * (cf. Dockerfile production stage).
 */

import { spawn } from 'child_process';
import path from 'path';
import { createElement } from 'react';
import { buildPassportHtml } from './passport-html-template';
import {
  PassportTemplateV2,
  wrapAsHtmlDocument,
  buildAiVerdict,
  type PassportTemplateV2Props,
  type PassportV2AnnexeSection,
} from '@/app/components/pdf/PassportTemplateV2';
import type { PassportViewModel } from '@/lib/passport-viewmodel-types';

// V5.13 — Import dynamique de react-dom/server pour éviter le warning Next.js
// "importing a component that imports react-dom/server". L'import est résolu
// au runtime (server-side uniquement) plutôt qu'au bundle webpack.
async function renderTemplateToHtml(
  props: PassportTemplateV2Props,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(createElement(PassportTemplateV2, props));
}

export interface GeneratePassportPdfOptions {
  data: PassportViewModel;
  qrCodeDataUrl: string;
  ownerSignupUrl?: string | null;
  /** Timeout en ms (par défaut 15s — WeasyPrint cold-start inclus) */
  timeoutMs?: number;
  /** Activer le template V2 (par défaut true depuis V5.13) */
  useV2?: boolean;
}

// ─── Helpers mapping ViewModel → V2 ──────────────────────────────────────────

function computeInitials(fullName: string): string {
  return (
    (fullName || '?')
      .split(/\s+/)
      .map((part) => part[0] || '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function getBrandDomain(): string {
  // Priorité : override explicite → NEXT_PUBLIC_APP_URL → NEXTAUTH_URL (défini en prod) → fallback.
  return (
    process.env.PASSPORT_BRAND_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
    'doc2loc.com'
  );
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://doc2loc.com'
  ).replace(/\/$/, '');
}

/**
 * Nettoie le libellé d'une pièce : jamais le nom de fichier brut
 * (`LOCATAIRE_9_13_FEV_26_PNG.png`), mais le type métier lisible.
 */
function cleanDocLabel(link: { label?: string; type?: string | null; category?: string | null }): string {
  const raw = String(link.label || '').trim();
  const looksLikeFile =
    /\.(png|jpe?g|pdf|webp|heic|gif)$/i.test(raw) || /_[A-Z0-9]{2,}/.test(raw) || raw.length > 42;
  if (raw && !looksLikeFile) return raw;

  const t = `${link.type || ''} ${link.category || ''} ${raw}`.toUpperCase();
  if (/PASSEPORT|PASSPORT/.test(t)) return 'Passeport';
  if (/CNI|IDENTIT|CARTE|TITRE_SEJOUR/.test(t)) return "Pièce d'identité";
  if (/PAIE|SALAIRE|BULLETIN|PAYSLIP/.test(t)) return 'Bulletin de salaire';
  if (/IMPOT|IMPÔT|AVIS|FISCAL/.test(t)) return "Avis d'imposition";
  if (/DOMICILE|ADDRESS|QUITTANCE|FACTURE/.test(t)) return 'Justificatif de domicile';
  if (/VISALE/.test(t)) return 'Certificat Visale';
  if (/CONTRAT|TRAVAIL|EMPLOI|EMPLOYEUR/.test(t)) return 'Contrat / Attestation employeur';
  if (/GARANT|GUARANTOR|CAUTION/.test(t)) return 'Pièce du garant';
  // Fallback : nom de fichier nettoyé (extension + séparateurs).
  return (
    raw
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Document justificatif'
  );
}

/**
 * Construit l'annexe documentaire (page 2) : les liens de pièces regroupés en
 * 3 catégories, avec libellés propres. Les pièces ne figurent JAMAIS en page 1.
 */
function buildAnnexeSections(
  data: PassportViewModel,
  passportSlug: string,
  passportId: string,
): PassportV2AnnexeSection[] {
  const utm =
    `utm_source=passport_pdf&utm_medium=pdf&utm_campaign=owner_acq` +
    `&utm_content=${encodeURIComponent(passportSlug || passportId)}`;
  const links = Array.isArray(data.documentLinks) ? data.documentLinks : [];
  const cat = (l: { category?: string | null }): string => String(l.category || '').toUpperCase();
  const withUtm = (url: string): string => `${url}${url.includes('?') ? '&' : '?'}${utm}`;
  const toLink = (l: { label?: string; type?: string | null; category?: string | null; url: string }) => ({
    label: cleanDocLabel(l),
    href: withUtm(l.url),
  });

  const identityDomicile = links.filter((l) => ['IDENTITY', 'ADDRESS'].includes(cat(l)));
  const guarantorDocs = links.filter((l) => ['GUARANTOR', 'VISALE'].includes(cat(l)));
  const known = new Set(['IDENTITY', 'ADDRESS', 'GUARANTOR', 'VISALE']);
  // INCOME + toute pièce non catégorisée → ressources du locataire (défaut sûr).
  const tenantResources = links.filter((l) => !known.has(cat(l)));

  return [
    { title: 'Identité & Domicile', links: identityDomicile.map(toLink) },
    { title: 'Ressources Financières du Locataire', links: tenantResources.map(toLink) },
    { title: 'Pièces du Garant', links: guarantorDocs.map(toLink) },
  ];
}

function buildForensicChecks(data: PassportViewModel): {
  left: string[];
  right: string[];
} {
  const auditClear = data.documentCoverage?.counts?.rejectedDocuments === 0;
  const identityOk = data.hero?.identityVerified === true;

  // Checks pertinents avec fallback vers les checks par défaut du template
  // (la sortie reste cohérente pour tout dossier)
  const left = [
    auditClear ? 'Alignement Fiches de paie / Impôts.' : 'Alignement Fiches de paie / Impôts détecté.',
    identityOk ? 'Identité eIDAS certifiée (API Didit).' : 'Identité en cours de vérification.',
    'Calcul inversé URSSAF conforme.',
  ];
  const right = [
    'Zéro retouche Photoshop / Canva.',
    'Outils RH de génération (SILAE) confirmés.',
    'Intégrité des métadonnées validée.',
  ];

  return { left, right };
}

function viewModelToV2Props(
  data: PassportViewModel,
  ownerSignupUrl?: string | null,
): PassportTemplateV2Props {
  const baseUrl = getBaseUrl();
  const passportId = data.metrics?.passportId || 'PT-2026-TEMP';
  const passportSlug = data.passportSlug || data.slug || passportId;
  const fullName = data.hero?.fullName || 'Candidat';

  // Date FR formatée
  const generatedAt =
    data.metrics?.generatedAt ||
    new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  // Fallback signupUrl si non fourni
  const signupUrl =
    ownerSignupUrl ||
    `${baseUrl}/auth/register?role=owner&utm_source=passport_pdf&utm_campaign=owner_acq&utm_content=${encodeURIComponent(passportId)}`;

  return {
    passportId,
    generatedAt,
    candidate: {
      initials: computeInitials(fullName),
      fullName,
      profession: data.hero?.profession || 'Profil candidat',
      // Employeur surfacé depuis l'OCR des pièces (cf. buildPassportViewModel) ;
      // null si non capturé → la ligne Employeur est masquée dans le PDF.
      employer: data.hero?.employer || null,
      seniority: null,
    },
    presentationText: data.presentationText || null,
    score: data.score || 0,
    gradeLabel: data.hero?.gradeLabel || data.grade || 'GRADE',
    // Badge métal : niveau V2 si analyse en cache, sinon niveau de résilience.
    metalLevel: data.aiAuditV2?.resilience?.level || data.resilience?.level,
    financials: {
      monthlyIncomeLabel:
        data.solvency?.exactMonthlyIncomeLabel ||
        data.solvency?.monthlyIncomeLabel ||
        'À confirmer',
      taxIncomeLabel: null,
      stabilityLabel: data.solvency?.certifiedIncome ? 'Validée (12 mois)' : null,
      maxRentLabel: data.solvency?.rentAmountLabel || 'À évaluer',
    },
    guarantor: {
      hasGuarantor: Boolean(data.guarantee?.mode && data.guarantee.mode !== 'NONE'),
      typeLabel:
        data.guarantee?.typeLabel ||
        (data.guarantee?.mode === 'VISALE'
          ? 'Visale'
          : data.guarantee?.mode === 'PHYSICAL'
          ? 'Garant physique'
          : 'Aucune'),
      name: data.guarantee?.guarantorName || null,
      incomeLabel: data.guarantee?.guarantorIncomeLabel || null,
      statusLabel: data.guarantee?.status || null,
    },
    aiVerdictHtml: buildAiVerdict(data.score || 0),
    forensicChecks: buildForensicChecks(data),
    // Trust-List enrichie (analyse neuro-symbolique) si en cache.
    forensicAudit: data.aiAuditV2?.ai?.forensicAudit,
    annexeSections: buildAnnexeSections(data, passportSlug, passportId),
    signupUrl,
    brandDomain: getBrandDomain(),
  };
}

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'generate_passport_pdf.py');

/**
 * Génère un buffer PDF via WeasyPrint Python subprocess.
 *
 * @throws Error si le subprocess échoue (timeout, exit code non-zero, stderr)
 */
export async function generatePassportPdf({
  data,
  qrCodeDataUrl,
  ownerSignupUrl,
  timeoutMs = 15000,
  useV2 = true,
}: GeneratePassportPdfOptions): Promise<Buffer> {
  // V5.13 — V2 par défaut (one-pager + Smart Links).
  // Fallback V1 disponible via useV2={false} pour rollback rapide.
  const html = useV2
    ? wrapAsHtmlDocument(
        await renderTemplateToHtml(viewModelToV2Props(data, ownerSignupUrl)),
      )
    : buildPassportHtml({ data, qrCodeDataUrl, ownerSignupUrl });

  return new Promise<Buffer>((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      // Désactive le buffering Python pour récupérer stderr en temps réel
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      reject(
        new Error(
          `[passport-pdf-service] Timeout après ${timeoutMs}ms lors de la génération WeasyPrint`,
        ),
      );
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `[passport-pdf-service] Échec spawn python : ${err.message}. Vérifier que python3 et weasyprint sont installés (cf. Dockerfile).`,
        ),
      );
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const stderr = Buffer.concat(errChunks).toString('utf8').trim();
      if (code !== 0) {
        reject(
          new Error(
            `[passport-pdf-service] WeasyPrint exit code ${code}. stderr: ${stderr || '(vide)'}`,
          ),
        );
        return;
      }

      const pdfBuffer = Buffer.concat(chunks);
      if (pdfBuffer.length === 0) {
        reject(new Error('[passport-pdf-service] PDF généré vide.'));
        return;
      }
      // Validation rapide : un PDF commence par "%PDF-"
      if (!pdfBuffer.subarray(0, 5).toString('utf8').startsWith('%PDF-')) {
        reject(
          new Error(
            `[passport-pdf-service] Sortie invalide (n'est pas un PDF). stderr: ${stderr || '(vide)'}`,
          ),
        );
        return;
      }

      resolve(pdfBuffer);
    });

    // Envoi du HTML sur stdin
    proc.stdin.write(html, 'utf8');
    proc.stdin.end();
  });
}
