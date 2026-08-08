/**
 * PDF d'état des lieux (décret n°2016-382, loi ALUR art. 3-2).
 *
 * Migré de PDFKit vers le renderer HTML partagé (lib/pdf/render.ts, WeasyPrint) :
 * l'ancien générateur texte n'embarquait NI les photos NI les signatures
 * apposées dans le wizard (il imprimait « Signature : ____ » alors que les
 * images existaient en base) — or les photos horodatées et les signatures sont
 * précisément la valeur probante d'un EDL.
 *
 * Sécurité : les chemins de photos sont strictement confinés à
 * uploads/edl/<inspectionId>/ et les signatures n'acceptent qu'un data-URL
 * PNG/JPEG base64 (même règle que le certificat de signature du bail — une
 * chaîne arbitraire permettrait d'exfiltrer un fichier local via WeasyPrint).
 */
import fs from 'fs';
import path from 'path';

import { renderHtmlToPdf } from '@/lib/pdf/render';

const CONDITION_FR: Record<string, string> = {
  TRES_BON: 'Très bon',
  BON: 'Bon',
  USAGE_NORMAL: 'Usure normale',
  MAUVAIS_ETAT: 'Mauvais état',
  HORS_SERVICE: 'Hors service',
  // Legacy (rétrocompatibilité)
  GOOD: 'Bon',
  NORMAL_WEAR: 'Usure normale',
  DEGRADED: 'Mauvais état',
  NEEDS_RENOVATION: 'Hors service',
};

/** Conditions au-delà de l'usure normale → badge rouge dans le PDF. */
const CONDITION_BAD = new Set(['MAUVAIS_ETAT', 'HORS_SERVICE', 'DEGRADED', 'NEEDS_RENOVATION']);

const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_PHOTOS_PER_ROOM = 12;

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Valide qu'une URL de photo appartient bien à CET état des lieux et existe
 * sur disque. @returns chemin relatif (résolu par WeasyPrint via base_url) ou null.
 */
function safePhotoSrc(url: unknown, inspectionId: string): string | null {
  const s = String(url || '');
  const re = new RegExp(`^/uploads/edl/${inspectionId}/[A-Za-z0-9._-]+$`);
  if (!re.test(s)) return null;
  const rel = s.replace(/^\//, '');
  return fs.existsSync(path.join(process.cwd(), rel)) ? rel : null;
}

function conditionBadge(condition: string): string {
  const label = CONDITION_FR[condition] || condition || '—';
  const bad = CONDITION_BAD.has(String(condition));
  return `<span style="display:inline-block;padding:1px 8px;border-radius:99px;font-size:9px;font-weight:600;${
    bad ? 'background:#fef2f2;color:#b91c1c;' : 'background:#f1f5f9;color:#334155;'
  }">${esc(label)}</span>`;
}

export async function generateInspectionPdf(inspection: Record<string, unknown>): Promise<string> {
  const ins = typeof (inspection as { toObject?: () => Record<string, unknown> }).toObject === 'function'
    ? (inspection as { toObject: () => Record<string, unknown> }).toObject()
    : inspection;

  const inspectionId = String(ins._id);
  const type = ins.type as string;
  const date = ins.date ? new Date(ins.date as string) : new Date();
  const rooms = (ins.rooms || []) as {
    name: string;
    wallCondition: string;
    floorCondition: string;
    ceilingCondition: string;
    comment?: string;
    equipment?: { name: string; condition: string; comment?: string }[];
    photos?: { url: string; caption?: string; uploadedAt?: Date }[];
  }[];
  const meterReadings = ins.meterReadings as { water?: number; gas?: number; electricity?: number; heating?: number } | undefined;
  const keysDelivered = (ins.keysDelivered || []) as { type: string; quantity: number; description?: string }[];
  const signatures = (ins.signatures || {}) as {
    owner?: { data?: string; date?: Date; name?: string };
    tenant?: { data?: string; date?: Date; name?: string };
  };
  const comparison = ins.comparison as {
    retentions?: { room?: string; item?: string; description?: string; amount?: number }[];
    totalRetention?: number;
    depositAmount?: number;
    refundAmount?: number;
  } | undefined;

  const Property = require('@/models/Property');
  const Lease = require('@/models/Lease');
  const User = require('@/models/User');

  const property = await Property.findById(ins.property).lean();
  const lease = await Lease.findById(ins.lease).lean();
  const owner = await User.findById(ins.user).lean();

  const propertyAddress = (property as { address?: string })?.address || 'Adresse non renseignée';
  const tenantName = lease
    ? `${(lease as { tenantFirstName?: string }).tenantFirstName || ''} ${(lease as { tenantLastName?: string }).tenantLastName || ''}`.trim()
    : 'Locataire';
  const ownerName = owner
    ? `${(owner as { firstName?: string }).firstName || ''} ${(owner as { lastName?: string }).lastName || ''}`.trim()
      || (owner as { email?: string }).email
      || 'Propriétaire'
    : 'Propriétaire';

  const title = type === 'ENTRY' ? "État des lieux d'entrée" : 'État des lieux de sortie';

  // ── Sections HTML ──
  const metersHtml = meterReadings
    ? [
        { label: 'Eau', value: meterReadings.water },
        { label: 'Gaz', value: meterReadings.gas },
        { label: 'Électricité', value: meterReadings.electricity },
        { label: 'Chauffage', value: meterReadings.heating },
      ]
        .filter((m) => m.value != null)
        .map((m) => `<td style="padding:6px 14px;border:1px solid #e2e8f0;"><strong>${m.label}</strong><br/>${esc(m.value)}</td>`)
        .join('')
    : '';

  const keysHtml = keysDelivered.length
    ? keysDelivered
        .map((k) => `<li>${esc(k.type)} × ${Number(k.quantity) || 1}${k.description ? ` — ${esc(k.description)}` : ''}</li>`)
        .join('')
    : '<li>Néant / Non renseigné</li>';

  const roomsHtml = rooms
    .map((room) => {
      const equipment = (room.equipment || [])
        .map(
          (eq) => `<tr>
            <td style="padding:4px 10px;border-bottom:1px solid #f1f5f9;">${esc(eq.name)}</td>
            <td style="padding:4px 10px;border-bottom:1px solid #f1f5f9;">${conditionBadge(eq.condition)}</td>
            <td style="padding:4px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:9px;">${esc(eq.comment || '')}</td>
          </tr>`,
        )
        .join('');

      const photos = (room.photos || [])
        .slice(0, MAX_PHOTOS_PER_ROOM)
        .map((ph) => ({ src: safePhotoSrc(ph.url, inspectionId), caption: ph.caption, uploadedAt: ph.uploadedAt }))
        .filter((ph) => ph.src)
        .map(
          (ph) => `<figure style="display:inline-block;width:31%;margin:0 1% 8px 0;vertical-align:top;">
            <img src="${ph.src}" style="width:100%;border-radius:6px;border:1px solid #e2e8f0;"/>
            <figcaption style="font-size:8px;color:#64748b;margin-top:2px;">${esc(ph.caption || '')}${
              ph.uploadedAt ? ` · ${new Date(ph.uploadedAt).toLocaleDateString('fr-FR')}` : ''
            }</figcaption>
          </figure>`,
        )
        .join('');

      return `<section style="margin:14px 0;page-break-inside:avoid;">
        <h3 style="font-size:12px;margin:0 0 6px;border-bottom:2px solid #064e3b;padding-bottom:3px;">${esc(room.name)}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:6px;">
          <tr>
            <td style="padding:4px 10px;">Murs ${conditionBadge(room.wallCondition)}</td>
            <td style="padding:4px 10px;">Sol ${conditionBadge(room.floorCondition)}</td>
            <td style="padding:4px 10px;">Plafond ${conditionBadge(room.ceilingCondition)}</td>
          </tr>
        </table>
        ${equipment ? `<table style="width:100%;border-collapse:collapse;font-size:10px;">${equipment}</table>` : ''}
        ${room.comment ? `<p style="font-size:9px;color:#475569;margin:6px 0 0;"><strong>Observations :</strong> ${esc(room.comment)}</p>` : ''}
        ${photos ? `<div style="margin-top:8px;">${photos}</div>` : ''}
      </section>`;
    })
    .join('');

  // Retenues sur dépôt (EDL de sortie avec comparaison chiffrée)
  const retentions = comparison?.retentions || [];
  const retentionsHtml =
    type === 'EXIT' && retentions.length
      ? `<section style="margin:16px 0;page-break-inside:avoid;">
          <h2 style="font-size:13px;margin:0 0 8px;">Retenues sur dépôt de garantie</h2>
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <thead><tr style="background:#f1f5f9;">
              <th style="text-align:left;padding:6px 10px;">Pièce</th>
              <th style="text-align:left;padding:6px 10px;">Élément</th>
              <th style="text-align:left;padding:6px 10px;">Justification</th>
              <th style="text-align:right;padding:6px 10px;">Montant</th>
            </tr></thead>
            <tbody>${retentions
              .map(
                (r) => `<tr>
                  <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;">${esc(r.room || '—')}</td>
                  <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;">${esc(r.item || '—')}</td>
                  <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;color:#64748b;">${esc(r.description || '')}</td>
                  <td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:right;">${(Number(r.amount) || 0).toLocaleString('fr-FR')} €</td>
                </tr>`,
              )
              .join('')}</tbody>
          </table>
          <p style="font-size:11px;text-align:right;margin:8px 0 0;">
            Total retenu : <strong>${(Number(comparison?.totalRetention) || 0).toLocaleString('fr-FR')} €</strong>
            ${comparison?.depositAmount ? ` · Dépôt versé : ${Number(comparison.depositAmount).toLocaleString('fr-FR')} €` : ''}
            ${comparison?.refundAmount != null ? ` · <strong>À restituer : ${Number(comparison.refundAmount).toLocaleString('fr-FR')} €</strong>` : ''}
          </p>
        </section>`
      : '';

  const signatureBlock = (
    label: string,
    name: string,
    sig?: { data?: string; date?: Date },
  ) => `<td style="width:50%;padding:10px 14px;border:1px solid #e2e8f0;vertical-align:top;">
    <p style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin:0 0 4px;">${label}</p>
    <p style="font-size:11px;font-weight:600;margin:0 0 8px;">${esc(name)}</p>
    ${
      sig?.data && SAFE_DATA_IMAGE.test(String(sig.data))
        ? `<img src="${sig.data}" style="max-height:60px;max-width:190px;"/>` +
          (sig.date ? `<p style="font-size:8px;color:#94a3b8;margin:4px 0 0;">Signé le ${new Date(sig.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>` : '')
        : '<p style="font-size:10px;color:#94a3b8;margin:16px 0;">Signature : ____________________</p>'
    }
  </td>`;

  const legalHtml =
    type === 'ENTRY'
      ? "Le locataire dispose d'un délai de 10 jours calendaires à compter de la remise du présent document pour demander sa modification, par lettre recommandée avec avis de réception. À défaut de réclamation dans ce délai, l'état des lieux d'entrée est réputé accepté. Durant le premier mois de la période de chauffe, le locataire peut également demander que l'état des lieux soit complété par l'état des éléments de chauffage."
      : "Le présent état des lieux de sortie constitue un constat contradictoire de l'état du logement au moment de la restitution des clés. Il est établi en présence des deux parties ou de leurs mandataires.";

  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; margin: 16mm; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #0f172a; font-size: 11px; }
    h1, h2, h3 { color: #0f172a; }
  </style></head><body>
    <h1 style="font-size:19px;text-align:center;margin:0 0 2px;">${title}</h1>
    <p style="text-align:center;font-size:9px;color:#64748b;margin:0 0 4px;">
      Établi contradictoirement entre les parties conformément au décret n°2016-382 du 30 mars 2016
    </p>
    <p style="text-align:center;font-size:11px;margin:0 0 16px;">Date : ${date.toLocaleDateString('fr-FR')}</p>

    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px;">
      <tr>
        <td style="padding:6px 12px;border:1px solid #e2e8f0;"><strong>Bailleur</strong><br/>${esc(ownerName)}</td>
        <td style="padding:6px 12px;border:1px solid #e2e8f0;"><strong>Locataire</strong><br/>${esc(tenantName)}</td>
        <td style="padding:6px 12px;border:1px solid #e2e8f0;"><strong>Bien</strong><br/>${esc(propertyAddress)}</td>
      </tr>
    </table>

    ${metersHtml ? `<h2 style="font-size:13px;margin:0 0 6px;">Relevés de compteurs</h2>
    <table style="border-collapse:collapse;font-size:10px;margin-bottom:14px;"><tr>${metersHtml}</tr></table>` : ''}

    <h2 style="font-size:13px;margin:0 0 6px;">Clés et moyens d'accès remis</h2>
    <ul style="font-size:10px;margin:0 0 14px;padding-left:18px;">${keysHtml}</ul>

    <h2 style="font-size:13px;margin:0 0 4px;">État des pièces</h2>
    ${roomsHtml || '<p style="font-size:10px;color:#64748b;">Aucune pièce renseignée.</p>'}

    ${retentionsHtml}

    <h2 style="font-size:13px;margin:18px 0 8px;page-break-inside:avoid;">Signatures</h2>
    <table style="width:100%;border-collapse:collapse;page-break-inside:avoid;"><tr>
      ${signatureBlock('Bailleur', signatures.owner?.name || ownerName, signatures.owner)}
      ${signatureBlock('Locataire', signatures.tenant?.name || tenantName, signatures.tenant)}
    </tr></table>

    <p style="font-size:8px;color:#374151;margin-top:16px;"><strong>MENTION LÉGALE (LOI ALUR ART. 3-2 — LOI N°89-462 DU 6 JUILLET 1989)</strong><br/>
    <span style="color:#6b7280;">${legalHtml}</span></p>
    <p style="font-size:8px;color:#94a3b8;text-align:center;margin-top:10px;">
      Document généré par Maison Patrimo — Conforme au décret n°2016-382 du 30 mars 2016.
    </p>
  </body></html>`;

  const pdfBuffer = await renderHtmlToPdf(html, { timeoutMs: 30000, label: 'edl-pdf' });

  const pdfDir = path.join(process.cwd(), 'uploads', 'edl');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
  const fileName = `edl_${type.toLowerCase()}_${inspectionId}.pdf`;
  fs.writeFileSync(path.join(pdfDir, fileName), pdfBuffer);
  return `/uploads/edl/${fileName}`;
}
