/**
 * leaseSignatureService — signature électronique INTERNE (eIDAS « simple »).
 *
 * Remplace OpenSign (dont le code reste dormant, non branché) : 0 € par
 * signature, et capitalise sur l'identité biométrique Didit déjà vérifiée
 * pendant la candidature — argument différenciant.
 *
 * Chaîne de preuve par signataire (cf. models/LeaseSignature.js) :
 *   lien à usage unique (token aléatoire, seul le HASH est stocké)
 *   → OTP email 6 chiffres (consentement)
 *   → signature manuscrite (canvas)
 *   → empreinte SHA-256 du PDF + horodatage serveur + IP + user-agent
 *   → certificat d'audit annexé au PDF final.
 *
 * Fail-safe : aucune fonction ne lève vers l'appelant HTTP sans message clair ;
 * les envois d'email sont best-effort (la signature reste valide sans email).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Lease = require('../../models/Lease');
const LeaseSignature = require('../../models/LeaseSignature');
const OtpToken = require('../../models/OtpToken');
const Property = require('../../models/Property');
const { sendEmail } = require('./emailService');

const TOKEN_TTL_DAYS = 7;
const OTP_TTL_MINUTES = 15;
const MAX_OTP_ATTEMPTS = 5;

function getBaseUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://maisonpatrimo.com'
  ).replace(/\/$/, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Empreinte du document au moment de la signature (intégrité). */
function hashFile(absolutePath) {
  try {
    return sha256(fs.readFileSync(absolutePath));
  } catch {
    return '';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Construit la liste ordonnée des signataires d'un bail.
 * Règle métier : le garant VISALE ne signe PAS (la garantie est portée par
 * Action Logement, pas par une personne physique).
 */
function buildSignerList(lease) {
  const signers = [];
  signers.push({
    role: 'OWNER',
    slot: 1,
    order: 0,
    email: lease.ownerEmail || '',
    fullName: lease.ownerFullName || 'Le bailleur',
  });
  signers.push({
    role: 'TENANT',
    slot: 1,
    order: 1,
    email: lease.tenantEmail,
    fullName: [lease.tenantFirstName, lease.tenantLastName].filter(Boolean).join(' ').trim(),
  });
  (lease.coTenants || []).forEach((ct, i) => {
    if (!ct?.email) return;
    signers.push({
      role: 'COTENANT',
      slot: i + 2,
      order: 2 + i,
      email: ct.email,
      fullName: [ct.firstName, ct.lastName].filter(Boolean).join(' ').trim(),
    });
  });
  const g = lease.guarantor || {};
  const isVisale = Boolean(g.visaleNumber);
  if (g.email && !isVisale) {
    signers.push({
      role: 'GUARANTOR',
      slot: 1,
      order: 90,
      email: g.email,
      fullName: [g.firstName, g.lastName].filter(Boolean).join(' ').trim(),
    });
  }
  return signers.filter((s) => s.email);
}

/**
 * Ouvre la campagne de signature : crée un LeaseSignature par signataire,
 * envoie le lien au premier de la file (signature séquentielle).
 * @returns {Promise<{signers:number, firstSentTo:string|null}>}
 */
async function openSignatureCampaign(leaseId, { ownerEmail, ownerFullName, diditVerified } = {}) {
  const lease = await Lease.findById(leaseId);
  if (!lease) throw new Error('Bail introuvable');

  const enriched = Object.assign({}, lease.toObject(), { ownerEmail, ownerFullName });
  const signers = buildSignerList(enriched);
  if (signers.length < 2) throw new Error('Signataires insuffisants (bailleur + locataire requis)');

  await LeaseSignature.deleteMany({ lease: lease._id, status: { $in: ['PENDING', 'VIEWED'] } });

  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const created = [];
  for (const s of signers) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const doc = await LeaseSignature.create({
      lease: lease._id,
      property: lease.property,
      role: s.role,
      slot: s.slot,
      order: s.order,
      fullName: s.fullName,
      email: String(s.email).toLowerCase(),
      tokenHash: sha256(rawToken),
      tokenExpiresAt: expiresAt,
      diditVerified: s.role === 'TENANT' ? Boolean(diditVerified) : false,
    });
    created.push({ doc, rawToken });
  }

  lease.leaseStatus = 'PENDING_SIGNATURE';
  lease.signatureStatus = 'PENDING';
  await lease.save();

  // Signature séquentielle : seul le premier reçoit son lien maintenant.
  const first = created.sort((a, b) => a.doc.order - b.doc.order)[0];
  let firstSentTo = null;
  if (first) {
    await sendSignatureInvite(lease, first.doc, first.rawToken).catch(() => {});
    firstSentTo = first.doc.email;
  }
  return { signers: created.length, firstSentTo };
}

async function sendSignatureInvite(lease, signature, rawToken) {
  const url = `${getBaseUrl()}/sign/${rawToken}`;
  const who = signature.fullName || 'Bonjour';
  const roleLabel =
    signature.role === 'OWNER'
      ? 'en tant que bailleur'
      : signature.role === 'GUARANTOR'
        ? 'en tant que garant'
        : 'en tant que locataire';
  return sendEmail({
    to: signature.email,
    subject: '✍️ Votre bail est prêt à signer — Maison Patrimo',
    html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:20px;margin:0 0 4px;">Maison Patrimo</h1>
  <p style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;margin:0 0 20px;">Signature électronique</p>
  <p style="font-size:15px;line-height:1.7;">${escapeHtml(who)},</p>
  <p style="font-size:15px;line-height:1.7;">Le contrat de location est prêt à être signé ${roleLabel}.
  La signature se fait en ligne, en moins de 3 minutes : vous relisez le bail, vous recevez un
  code de confirmation par email, vous signez du doigt ou à la souris.</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="${url}" style="background:#064e3b;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block;">
      Lire et signer le bail
    </a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#64748b;">Ce lien est personnel et valable ${TOKEN_TTL_DAYS} jours.
  Signature électronique conforme à l'article 1367 du Code civil (règlement eIDAS).</p>
</div>`,
    text: `Votre bail est prêt à signer : ${url} (lien personnel, valable ${TOKEN_TTL_DAYS} jours)`,
  });
}

/** Résout un token brut → document de signature (null si invalide/expiré). */
async function resolveSignatureByToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) return null;
  const sig = await LeaseSignature.findOne({ tokenHash: sha256(rawToken) });
  if (!sig) return null;
  if (sig.tokenExpiresAt && sig.tokenExpiresAt.getTime() < Date.now()) {
    if (sig.status === 'PENDING' || sig.status === 'VIEWED') {
      sig.status = 'EXPIRED';
      await sig.save();
    }
    return null;
  }
  return sig;
}

/** Envoie le code OTP de consentement au signataire. */
async function sendSignatureOtp(signature) {
  const code = String(crypto.randomInt(100000, 999999));
  await OtpToken.deleteMany({ email: `sign:${signature._id}` });
  await OtpToken.create({
    email: `sign:${signature._id}`,
    code: sha256(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
  });
  await sendEmail({
    to: signature.email,
    subject: `Code de signature : ${code}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-size:15px;">Votre code de confirmation pour signer le bail :</p>
      <p style="font-size:34px;font-weight:800;letter-spacing:.22em;color:#064e3b;margin:18px 0;">${code}</p>
      <p style="font-size:13px;color:#64748b;">Valable ${OTP_TTL_MINUTES} minutes. Ne le communiquez à personne.</p>
    </div>`,
    text: `Code de signature : ${code} (valable ${OTP_TTL_MINUTES} min)`,
  });
  return true;
}

/** Vérifie l'OTP saisi. @returns {Promise<boolean>} */
async function verifySignatureOtp(signature, code) {
  if (signature.otpAttempts >= MAX_OTP_ATTEMPTS) return false;
  const token = await OtpToken.findOne({ email: `sign:${signature._id}` });
  if (!token) return false;
  const ok = token.code === sha256(String(code || '').trim());
  if (!ok) {
    signature.otpAttempts += 1;
    await signature.save();
    return false;
  }
  await OtpToken.deleteOne({ _id: token._id });
  signature.otpVerifiedAt = new Date();
  await signature.save();
  return true;
}

/**
 * Enregistre la signature (après OTP validé) et fait avancer la file.
 * @returns {Promise<{complete:boolean, nextSentTo:string|null}>}
 */
async function recordSignature(signature, { signatureImage, ip, userAgent }) {
  if (!signature.otpVerifiedAt) throw new Error('Code de confirmation non validé');

  const lease = await Lease.findById(signature.lease);
  if (!lease) throw new Error('Bail introuvable');

  // Intégrité : empreinte du PDF présenté au signataire.
  const docs = Array.isArray(lease.generatedDocuments) ? lease.generatedDocuments : [];
  const leaseDoc = docs.find((d) => d.kind === 'LEASE') || docs[0];
  if (leaseDoc?.pdfPath) {
    const abs = path.isAbsolute(leaseDoc.pdfPath)
      ? leaseDoc.pdfPath
      : path.join(process.cwd(), leaseDoc.pdfPath);
    signature.documentHash = hashFile(abs);
  }

  signature.signatureImage = String(signatureImage || '').slice(0, 400000);
  signature.ip = String(ip || '').slice(0, 64);
  signature.userAgent = String(userAgent || '').slice(0, 300);
  signature.signedAt = new Date();
  signature.status = 'SIGNED';
  await signature.save();

  const all = await LeaseSignature.find({ lease: lease._id }).sort({ order: 1 });
  const remaining = all.filter((s) => s.status !== 'SIGNED');

  // Statut agrégé (enum existant du modèle Lease).
  const ownerSigned = all.some((s) => s.role === 'OWNER' && s.status === 'SIGNED');
  const tenantSigned = all.some((s) => s.role === 'TENANT' && s.status === 'SIGNED');
  if (ownerSigned && tenantSigned) lease.signatureStatus = 'SIGNED_BOTH';
  else if (ownerSigned) lease.signatureStatus = 'SIGNED_BY_OWNER';
  else if (tenantSigned) lease.signatureStatus = 'SIGNED_BY_TENANT';
  if (signature.role === 'OWNER') lease.ownerSignedAt = signature.signedAt;
  if (signature.role === 'TENANT') lease.tenantSignedAt = signature.signedAt;

  let nextSentTo = null;
  if (remaining.length === 0) {
    lease.leaseStatus = 'ACTIVE';
    await lease.save();
    // Le bien passe en occupé (parité avec l'ancien flux OpenSign).
    if (lease.property) {
      await Property.updateOne({ _id: lease.property }, { $set: { status: 'OCCUPIED' } }).catch(() => {});
    }
    return { complete: true, nextSentTo: null };
  }

  await lease.save();
  // File séquentielle : on invite le suivant avec un token FRAIS.
  const next = remaining[0];
  const rawToken = crypto.randomBytes(32).toString('hex');
  next.tokenHash = sha256(rawToken);
  next.tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await next.save();
  await sendSignatureInvite(lease, next, rawToken).catch(() => {});
  nextSentTo = next.email;

  return { complete: false, nextSentTo };
}

/** HTML du certificat de signature (annexé au PDF final). */
function buildCertificateHtml(lease, signatures) {
  const rows = signatures
    .map(
      (s) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
        <strong>${escapeHtml(s.fullName || s.email)}</strong><br/>
        <span style="color:#64748b;font-size:11px;">${escapeHtml(s.email)} · ${
          s.role === 'OWNER' ? 'Bailleur' : s.role === 'GUARANTOR' ? 'Garant' : 'Locataire'
        }</span>
        ${s.diditVerified ? '<br/><span style="color:#047857;font-size:11px;">✔ Identité vérifiée eIDAS (biométrie)</span>' : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#334155;">
        ${s.signedAt ? new Date(s.signedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—'}<br/>
        <span style="color:#64748b;">Code email validé${s.otpVerifiedAt ? ' ✔' : ''}</span><br/>
        <span style="color:#94a3b8;">IP ${escapeHtml(s.ip || '—')}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
        ${s.signatureImage ? `<img src="${s.signatureImage}" style="max-height:52px;max-width:150px;" />` : '—'}
      </td>
    </tr>`,
    )
    .join('');

  const hash = signatures.find((s) => s.documentHash)?.documentHash || '—';

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; margin: 18mm; }
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#0f172a; }
  </style></head><body>
    <h1 style="font-size:20px;margin:0 0 2px;">Certificat de signature électronique</h1>
    <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:0 0 18px;">Maison Patrimo · Piste d'audit</p>
    <p style="font-size:12px;line-height:1.7;">
      Contrat de location — ${escapeHtml(lease.tenantFirstName || '')} ${escapeHtml(lease.tenantLastName || '')}<br/>
      Signature électronique simple au sens du règlement (UE) n° 910/2014 (eIDAS) et de
      l'article 1367 du Code civil. Le consentement de chaque signataire a été recueilli par
      code à usage unique envoyé sur son adresse email.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:12px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="text-align:left;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#475569;">Signataire</th>
        <th style="text-align:left;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#475569;">Horodatage &amp; preuve</th>
        <th style="text-align:center;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#475569;">Signature</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:18px;font-size:10px;color:#64748b;line-height:1.6;">
      <strong>Empreinte du document (SHA-256)</strong><br/>
      <span style="font-family:monospace;word-break:break-all;">${escapeHtml(hash)}</span><br/>
      Toute modification ultérieure du contrat modifierait cette empreinte et invaliderait la preuve.
    </p>
  </body></html>`;
}

/**
 * Produit le PDF FINAL : bail compilé + page « Certificat de signature »
 * (WeasyPrint) fusionnés avec pdf-lib. Écrit dans uploads/leases/signed/ et
 * renseigne `Lease.signedPdfPath`.
 * @returns {Promise<string|null>} chemin relatif du PDF signé
 */
async function finalizeSignedPdf(leaseId) {
  const lease = await Lease.findById(leaseId);
  if (!lease) return null;
  const signatures = await LeaseSignature.find({ lease: lease._id }).sort({ order: 1 }).lean();
  if (!signatures.length || signatures.some((s) => s.status !== 'SIGNED')) return null;

  const docs = Array.isArray(lease.generatedDocuments) ? lease.generatedDocuments : [];
  const leaseDoc = docs.find((d) => d.kind === 'LEASE') || docs[0];
  if (!leaseDoc?.pdfPath) return null;
  const sourceAbs = path.isAbsolute(leaseDoc.pdfPath)
    ? leaseDoc.pdfPath
    : path.join(process.cwd(), leaseDoc.pdfPath);
  if (!fs.existsSync(sourceAbs)) return null;

  // 1. Certificat HTML → PDF (renderer partagé WeasyPrint)
  const { renderHtmlToPdf } = require('../../lib/pdf/render');
  const certBuffer = await renderHtmlToPdf(buildCertificateHtml(lease, signatures), {
    label: 'lease-signature-certificate',
  });

  // 2. Fusion bail + certificat
  const { PDFDocument } = require('pdf-lib');
  const merged = await PDFDocument.create();
  const base = await PDFDocument.load(fs.readFileSync(sourceAbs));
  const cert = await PDFDocument.load(certBuffer);
  const basePages = await merged.copyPages(base, base.getPageIndices());
  basePages.forEach((p) => merged.addPage(p));
  const certPages = await merged.copyPages(cert, cert.getPageIndices());
  certPages.forEach((p) => merged.addPage(p));
  merged.setTitle(`Bail signé — ${lease.tenantLastName || ''}`.trim());
  merged.setProducer('Maison Patrimo');
  const finalBytes = await merged.save();

  // 3. Persistance
  const dir = path.join(process.cwd(), 'uploads', 'leases', 'signed');
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `bail-signe-${String(lease._id)}.pdf`;
  fs.writeFileSync(path.join(dir, fileName), Buffer.from(finalBytes));
  const relPath = path.join('uploads', 'leases', 'signed', fileName);
  lease.signedPdfPath = relPath;
  await lease.save();
  return relPath;
}

module.exports = {
  buildSignerList,
  finalizeSignedPdf,
  openSignatureCampaign,
  resolveSignatureByToken,
  sendSignatureOtp,
  verifySignatureOtp,
  recordSignature,
  buildCertificateHtml,
  // exportés pour les tests
  _internals: { sha256, TOKEN_TTL_DAYS, MAX_OTP_ATTEMPTS },
};
