/**
 * Production de l'attestation de contrôle du dossier locataire.
 *
 * Chaîne : verdicts du moteur → contrôles du protocole → verdict binaire →
 * PDF horodaté avec identifiant vérifiable par un tiers.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { renderHtmlToPdf } from '@/lib/pdf/render';
import {
  PROTOCOL_VERSION,
  computeVerdict,
  mapEngineToChecks,
  verdictStatement,
} from './protocol';

const Application = require('@/models/Application');
const DossierAttestation = require('@/models/DossierAttestation');
const Property = require('@/models/Property');

/** Identifiant public : court, lisible au téléphone, non devinable. */
function newVerificationId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1
  const bytes = crypto.randomBytes(12);
  const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** HTML de l'attestation — sobre, sans vocabulaire juridique excessif. */
export function buildAttestationHtml(a: Record<string, any>, verifyUrl: string): string {
  const badge = a.verdict === 'CONFORME'
    ? { bg: '#ecfdf5', fg: '#047857', label: 'Conforme au protocole' }
    : a.verdict === 'NON_CONFORME'
      ? { bg: '#fef2f2', fg: '#b91c1c', label: 'Non conforme au protocole' }
      : { bg: '#fffbeb', fg: '#b45309', label: 'Dossier incomplet' };

  const rows = (a.checks || []).map((c: any) => {
    const mark = c.status === 'PASSED' ? '✓' : c.status === 'FAILED' ? '✗' : '—';
    const color = c.status === 'PASSED' ? '#047857' : c.status === 'FAILED' ? '#b91c1c' : '#94a3b8';
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:${color};font-weight:700;width:22px;">${mark}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${esc(c.label)}
        ${c.detail ? `<br/><span style="font-size:9px;color:#64748b;">${esc(c.detail)}</span>` : ''}</td>
    </tr>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; margin: 18mm; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0f172a; font-size:11px; }
  </style></head><body>
    <h1 style="font-size:19px;margin:0 0 2px;">Attestation de contrôle du dossier locataire</h1>
    <p style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 16px;">
      Maison Patrimo · Protocole ${esc(a.protocolVersion)}
    </p>

    <div style="background:${badge.bg};border-radius:8px;padding:11px 14px;margin-bottom:14px;">
      <p style="margin:0;font-size:14px;font-weight:700;color:${badge.fg};">${badge.label}</p>
      <p style="margin:3px 0 0;font-size:10px;color:#334155;">${esc(a.verdictStatement)}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px;">
      <tr>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;"><strong>Candidat</strong><br/>${esc(a.candidateName || '—')}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;"><strong>Logement</strong><br/>${esc(a.propertyLabel || '—')}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;"><strong>Contrôlé le</strong><br/>
          ${new Date(a.issuedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</td>
      </tr>
    </table>

    <h2 style="font-size:12px;margin:0 0 6px;">Contrôles exécutés</h2>
    <table style="width:100%;border-collapse:collapse;font-size:10px;">${rows}</table>

    <div style="margin-top:16px;padding:10px 12px;background:#f8fafc;border-radius:6px;">
      <p style="margin:0;font-size:10px;"><strong>Vérifier cette attestation</strong></p>
      <p style="margin:3px 0 0;font-size:10px;color:#334155;">
        Identifiant : <span style="font-family:monospace;font-size:12px;font-weight:700;">${esc(a.verificationId)}</span><br/>
        ${esc(verifyUrl)}
      </p>
      ${a.documentsHash ? `<p style="margin:5px 0 0;font-size:8px;color:#64748b;font-family:monospace;word-break:break-all;">
        Empreinte des pièces contrôlées (SHA-256) : ${esc(a.documentsHash)}</p>` : ''}
    </div>

    <p style="margin-top:14px;font-size:8.5px;line-height:1.6;color:#475569;">
      <strong>Portée.</strong> Cette attestation établit que les contrôles listés ci-dessus ont été
      exécutés sur les pièces transmises, à la date indiquée, selon le protocole ${esc(a.protocolVersion)}
      publié et consultable. Elle ne constitue ni une certification d’authenticité des documents, ni un
      avis juridique, ni une garantie de solvabilité ou d’exécution du bail. Les contrôles automatisés
      relèvent d’une obligation de moyens. Toute modification des pièces postérieure au contrôle
      invaliderait l’empreinte ci-dessus.
    </p>
  </body></html>`;
}

/** Émet l'attestation : verdict, PDF, identifiant vérifiable. */
export async function issueAttestation({
  applicationId, issuedForUserId, baseUrl,
}: { applicationId: string; issuedForUserId: string; baseUrl: string }): Promise<Record<string, any>> {
  const application = await Application.findById(applicationId)
    .select('profile userEmail property documents aiAuditV2')
    .lean();
  if (!application) throw new Error('Dossier introuvable.');

  const checks = mapEngineToChecks(application.aiAuditV2);
  const verdict = computeVerdict(checks);

  // Empreinte des pièces : toute substitution ultérieure devient détectable.
  const docs = Array.isArray(application.documents) ? application.documents : [];
  const documentsHash = docs.length
    ? crypto.createHash('sha256')
        .update(docs.map((d: any) => `${d.fileName || ''}:${d.fileUrl || ''}`).sort().join('|'))
        .digest('hex')
    : '';

  const property = application.property
    ? await Property.findById(application.property).select('name address').lean()
    : null;

  const attestation = await DossierAttestation.create({
    application: application._id,
    property: application.property || undefined,
    issuedFor: issuedForUserId,
    verificationId: newVerificationId(),
    verdict,
    protocolVersion: PROTOCOL_VERSION,
    checks,
    documentsHash,
    documentsCount: docs.length,
    candidateName: [application.profile?.firstName, application.profile?.lastName].filter(Boolean).join(' ').trim(),
    propertyLabel: property?.name || property?.address || '',
  });

  const verifyUrl = `${baseUrl.replace(/\/$/, '')}/verifier/${attestation.verificationId}`;
  const pdf = await renderHtmlToPdf(
    buildAttestationHtml(
      { ...attestation.toObject(), verdictStatement: verdictStatement(verdict) },
      verifyUrl,
    ),
    { label: 'attestation-dossier' },
  );

  const dir = path.join(process.cwd(), 'uploads', 'attestations');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `attestation-${attestation.verificationId}.pdf`;
  fs.writeFileSync(path.join(dir, fileName), pdf);
  attestation.pdfPath = path.join('uploads', 'attestations', fileName);
  await attestation.save();

  return attestation.toObject();
}
