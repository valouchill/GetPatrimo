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
/** Revue F3 : fenêtre de validité du consentement OTP (anti-rejeu du lien). */
const OTP_CONSENT_WINDOW_MINUTES = 20;
/** Relances automatiques du signataire courant : J+2 puis J+5 après l'invitation. */
const SIGNATURE_REMINDER_DAYS = [2, 5];
/** Au-delà (signataire muet malgré les relances), on alerte le bailleur une fois. */
const SIGNATURE_STALE_ALERT_DAYS = 8;

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
/**
 * Sécurité (revue F1) : tout chemin issu de la base est confiné sous
 * <cwd>/uploads (les artefacts de bail viennent de uploads/leases/...).
 * @returns {string|null} chemin absolu sûr, ou null
 */
function safeUploadsPath(relOrAbs) {
  if (!relOrAbs) return null;
  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const abs = path.resolve(
    path.isAbsolute(relOrAbs) ? relOrAbs : path.join(process.cwd(), relOrAbs),
  );
  return abs.startsWith(uploadsRoot + path.sep) && fs.existsSync(abs) ? abs : null;
}

function hashFile(absolutePath) {
  try {
    return sha256(fs.readFileSync(absolutePath));
  } catch {
    return '';
  }
}

/**
 * Sécurité (revue F2) : l'image de signature est la SEULE valeur injectée non
 * échappée dans le HTML du certificat (attribut src). WeasyPrint résout file://
 * et http:// → une chaîne arbitraire permettrait d'exfiltrer un fichier local
 * dans le PDF. On n'accepte donc qu'un data-URL PNG/JPEG base64 strict.
 */
const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
function isSafeSignatureImage(value) {
  const v = String(value || '');
  return v.length <= 400000 && SAFE_DATA_IMAGE.test(v);
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

  // Revue F4 : purge COMPLÈTE (l'index unique {lease,role,slot} faisait échouer
  // toute relance dès qu'une signature existait). Les campagnes annulées sont
  // tracées par les events ; une campagne déjà complète n'est pas relançable.
  const already = await LeaseSignature.countDocuments({ lease: lease._id, status: 'SIGNED' });
  if (already > 0 && lease.leaseStatus === 'ACTIVE') {
    throw new Error('Ce bail est déjà signé par toutes les parties.');
  }
  await LeaseSignature.deleteMany({ lease: lease._id });

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

  // Revue F6 : empreinte de RÉFÉRENCE du document présenté aux signataires,
  // figée à l'ouverture. Toute recompilation du bail en cours de campagne sera
  // détectée (les parties doivent signer le MÊME document).
  const refDoc = (lease.generatedDocuments || []).find((d) => d.kind === 'LEASE')
    || (lease.generatedDocuments || [])[0];
  if (refDoc?.pdfPath) {
    const abs = safeUploadsPath(refDoc.pdfPath);
    lease.signatureDocumentHash = abs ? hashFile(abs) : '';
  }
  lease.leaseStatus = 'PENDING_SIGNATURE';
  lease.signatureStatus = 'PENDING';
  await lease.save();

  // Signature séquentielle : seul le premier reçoit son lien maintenant.
  const first = created.sort((a, b) => a.doc.order - b.doc.order)[0];
  let firstSentTo = null;
  let inviteSent = false;
  if (first) {
    // Revue F7 : l'échec d'envoi était avalé → campagne gelée en silence (le
    // token brut n'est pas récupérable). On remonte l'info à l'appelant.
    inviteSent = await sendSignatureInvite(lease, first.doc, first.rawToken)
      .then(() => true)
      .catch(() => false);
    first.doc.inviteSentAt = inviteSent ? new Date() : null;
    first.doc.inviteError = inviteSent ? '' : 'Envoi email impossible';
    await first.doc.save();
    firstSentTo = first.doc.email;
  }
  return { signers: created.length, firstSentTo, inviteSent };
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

/**
 * Montant d'engagement de la caution : loyer + charges × durée du bail.
 * Sert à VÉRIFIER la mention saisie par la caution, jamais à la pré-remplir.
 */
function computeGuaranteeAmount(lease) {
  const monthly = Number(lease?.rentAmount || 0) + Number(lease?.chargesAmount || 0);
  const months = Math.max(Number(lease?.durationMonths || 12), 1);
  return Math.round(monthly * months * 100) / 100;
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
  // Anti-spam : 30 s minimum entre deux envois de code (le bouton « Renvoyer »
  // est public — sans garde-fou il permettait d'arroser la boîte du signataire).
  const existing = await OtpToken.findOne({ email: `sign:${signature._id}` }).lean();
  if (existing?.expiresAt) {
    const sentAt = new Date(existing.expiresAt).getTime() - OTP_TTL_MINUTES * 60 * 1000;
    const waitMs = sentAt + 30 * 1000 - Date.now();
    if (waitMs > 0) {
      const err = new Error(`Un code vient d'être envoyé — patientez ${Math.ceil(waitMs / 1000)} s avant d'en redemander un.`);
      err.statusCode = 429;
      throw err;
    }
  }
  const code = String(crypto.randomInt(100000, 999999));
  await OtpToken.deleteMany({ email: `sign:${signature._id}` });
  // Revue F4 : un nouvel envoi rouvre la fenêtre de tentatives (sinon 5 erreurs
  // verrouillaient le signataire définitivement, sans recours).
  signature.otpAttempts = 0;
  signature.otpVerifiedAt = null;
  await signature.save();
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
async function recordSignature(signature, { signatureImage, ip, userAgent, guaranteeMention }) {
  if (!signature.otpVerifiedAt) throw new Error('Code de confirmation non validé');
  // Revue F3 : le consentement OTP expire — le seul lien ne suffit pas à signer
  // des jours plus tard (lien transféré, navigateur partagé).
  const consentAgeMs = Date.now() - new Date(signature.otpVerifiedAt).getTime();
  if (consentAgeMs > OTP_CONSENT_WINDOW_MINUTES * 60 * 1000) {
    signature.otpVerifiedAt = null;
    await signature.save();
    throw new Error('Session de signature expirée — demandez un nouveau code.');
  }
  // Revue F2 : image de signature strictement validée (anti-injection HTML).
  if (!isSafeSignatureImage(signatureImage)) {
    throw new Error('Signature manuscrite invalide.');
  }

  const lease = await Lease.findById(signature.lease);
  if (!lease) throw new Error('Bail introuvable');

  // Intégrité : empreinte du PDF présenté au signataire.
  const docs = Array.isArray(lease.generatedDocuments) ? lease.generatedDocuments : [];
  const leaseDoc = docs.find((d) => d.kind === 'LEASE') || docs[0];
  const abs = leaseDoc?.pdfPath ? safeUploadsPath(leaseDoc.pdfPath) : null;
  signature.documentHash = abs ? hashFile(abs) : '';
  // Revue F6 : toutes les parties doivent signer le MÊME document. Si le bail a
  // été recompilé depuis l'ouverture de la campagne, on refuse la signature.
  if (
    lease.signatureDocumentHash &&
    signature.documentHash &&
    lease.signatureDocumentHash !== signature.documentHash
  ) {
    throw new Error(
      'Le contrat a été modifié depuis l’envoi en signature. Le bailleur doit relancer une nouvelle campagne.',
    );
  }

  // Art. 2297 C. civ. : la caution personne physique appose ELLE-MÊME la mention
  // exprimant la nature et l'étendue de son engagement, à peine de NULLITÉ.
  // Une mention pré-imprimée par le système ne vaut pas engagement.
  if (signature.role === 'GUARANTOR') {
    const expected = computeGuaranteeAmount(lease);
    const mention = String(guaranteeMention || '').trim();
    if (mention.length < 20) {
      throw new Error(
        'La caution doit écrire elle-même la mention d’engagement (art. 2297 du Code civil).',
      );
    }
    // La mention doit porter le montant : on vérifie que le nombre y figure,
    // en tolérant les séparateurs (1 234,56 / 1234.56 / 1 234).
    const digitsOnly = mention.replace(/[^0-9]/g, '');
    const expectedDigits = String(Math.round(expected));
    if (!digitsOnly.includes(expectedDigits)) {
      throw new Error(
        `La mention doit indiquer le montant exact de votre engagement : ${expected.toLocaleString('fr-FR')} €.`,
      );
    }
    signature.guaranteeMention = mention.slice(0, 1000);
    signature.guaranteeAmount = expected;
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
    // Revue F5 : le PDF définitif (bail + certificat) DOIT exister avant de
    // déclarer le bail actif — sinon le bien est marqué occupé alors que les
    // parties n'ont aucun document signé, sans reprise possible.
    await lease.save();
    const finalPath = await finalizeSignedPdf(String(lease._id));
    if (!finalPath) {
      throw new Error(
        'Signature enregistrée mais le document définitif n’a pas pu être produit. Réessayez dans un instant.',
      );
    }
    const fresh = await Lease.findById(lease._id);
    fresh.leaseStatus = 'ACTIVE';
    await fresh.save();
    if (fresh.property) {
      await Property.updateOne({ _id: fresh.property }, { $set: { status: 'OCCUPIED' } }).catch(() => {});
    }
    // Remise d'un exemplaire à chaque partie (art. 3, loi du 6/7/1989) :
    // le PDF signé + certificat part en pièce jointe à tous les signataires.
    // Best-effort MAIS tracé : l'échec était totalement avalé, or c'est une
    // obligation de remise (art. 3, loi du 6/7/1989). Le bail reste actif — on
    // ne défait pas une signature valide pour un email —, mais l'incident
    // remonte pour permettre un renvoi manuel.
    await sendFinalPdfToParties(String(lease._id)).catch((err) => {
      console.error('[lease-signature] livraison du bail signé échouée', {
        leaseId: String(lease._id),
        error: err?.message || err,
      });
    });
    return { complete: true, nextSentTo: null };
  }

  await lease.save();
  // File séquentielle : on invite le suivant avec un token FRAIS.
  const next = remaining[0];
  const rawToken = crypto.randomBytes(32).toString('hex');
  next.tokenHash = sha256(rawToken);
  next.tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await next.save();
  const nextSent = await sendSignatureInvite(lease, next, rawToken)
    .then(() => true)
    .catch(() => false);
  next.inviteSentAt = nextSent ? new Date() : null;
  next.inviteError = nextSent ? '' : 'Envoi email impossible';
  await next.save();
  nextSentTo = next.email;

  return { complete: false, nextSentTo };
}

/**
 * Signataire courant d'une campagne : le premier de la file (order croissant)
 * qui n'a pas encore signé. Les EXPIRED sont inclus : un renvoi régénère leur
 * token et les remet en course.
 */
async function getCurrentSigner(leaseId) {
  return LeaseSignature.findOne({
    lease: leaseId,
    status: { $in: ['PENDING', 'VIEWED', 'EXPIRED'] },
  }).sort({ order: 1 });
}

/**
 * Renvoie son lien au signataire courant, avec un token FRAIS (le brut n'est
 * jamais stocké → impossible de re-envoyer l'ancien ; la régénération prolonge
 * aussi la validité, ce qui ressuscite une campagne expirée).
 *
 * Utilisé par le bouton « Renvoyer le lien » du bailleur ET par le cron de
 * relance quotidien.
 * @returns {Promise<{sentTo: string, role: string}>}
 */
async function resendInviteToCurrentSigner(leaseId) {
  const lease = await Lease.findById(leaseId);
  if (!lease) throw new Error('Bail introuvable');
  if (lease.leaseStatus !== 'PENDING_SIGNATURE') {
    throw new Error("Ce bail n'est pas en cours de signature.");
  }
  // Relancer vers un bail dont le PDF est absent enverrait le signataire sur un
  // document introuvable : on bloque en amont plutôt qu'à l'ouverture du lien.
  const leaseDocs = Array.isArray(lease.generatedDocuments) ? lease.generatedDocuments : [];
  const refDoc = leaseDocs.find((d) => d.kind === 'LEASE') || leaseDocs[0];
  if (!refDoc?.pdfPath || !safeUploadsPath(refDoc.pdfPath)) {
    throw new Error(
      'Le document du bail est introuvable — régénérez-le avant de relancer les signataires.',
    );
  }
  const signer = await getCurrentSigner(lease._id);
  if (!signer) throw new Error('Aucun signataire en attente.');

  const rawToken = crypto.randomBytes(32).toString('hex');
  signer.tokenHash = sha256(rawToken);
  signer.tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  if (signer.status === 'EXPIRED') signer.status = signer.viewedAt ? 'VIEWED' : 'PENDING';
  await signer.save();

  const sent = await sendSignatureInvite(lease, signer, rawToken)
    .then(() => true)
    .catch(() => false);
  signer.inviteSentAt = sent ? new Date() : signer.inviteSentAt;
  signer.inviteError = sent ? '' : 'Envoi email impossible';
  if (sent) signer.remindersSentAt.push(new Date());
  await signer.save();
  if (!sent) throw new Error("L'email n'a pas pu être envoyé. Vérifiez l'adresse du signataire.");
  return { sentTo: signer.email, role: signer.role };
}

/**
 * Envoie le PDF final signé à TOUTES les parties (pièce jointe).
 * La remise d'un exemplaire à chaque partie est une obligation du bail
 * (art. 3, loi n° 89-462 du 6 juillet 1989). Best-effort par destinataire.
 * @returns {Promise<number>} nombre d'envois réussis
 */
async function sendFinalPdfToParties(leaseId) {
  const lease = await Lease.findById(leaseId).lean();
  if (!lease?.signedPdfPath) return 0;
  const abs = safeUploadsPath(lease.signedPdfPath);
  if (!abs) return 0;
  const pdfBuffer = fs.readFileSync(abs);
  const signatures = await LeaseSignature.find({ lease: lease._id }).sort({ order: 1 }).lean();

  let sent = 0;
  for (const s of signatures) {
    if (!s.email) continue;
    const ok = await sendEmail({
      to: s.email,
      subject: '🎉 Votre bail est signé par toutes les parties — Maison Patrimo',
      html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:20px;margin:0 0 4px;">Maison Patrimo</h1>
  <p style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;margin:0 0 20px;">Bail signé</p>
  <p style="font-size:15px;line-height:1.7;">${escapeHtml(s.fullName || 'Bonjour')},</p>
  <p style="font-size:15px;line-height:1.7;">Toutes les parties ont signé le contrat de location.
  Vous trouverez en pièce jointe <strong>votre exemplaire du bail signé</strong>, accompagné du
  certificat de signature électronique (horodatage, empreinte SHA-256, identités vérifiées).</p>
  <p style="font-size:13px;line-height:1.6;color:#64748b;">Conservez ce document : il fait foi
  au sens de l'article 1367 du Code civil. Chaque partie en reçoit un exemplaire.</p>
</div>`,
      text: 'Toutes les parties ont signé le bail. Votre exemplaire signé est en pièce jointe.',
      attachments: [{ filename: 'bail-signe-maison-patrimo.pdf', content: pdfBuffer }],
    })
      .then(() => true)
      .catch(() => false);
    if (ok) sent += 1;
  }
  return sent;
}

/**
 * Cron quotidien : relance les signataires silencieux (J+2 puis J+5 après
 * l'invitation — plan produit), ressuscite les tokens expirés au passage
 * (chaque relance = token frais), et alerte le bailleur UNE fois quand un
 * signataire reste muet malgré les deux relances.
 * @returns {Promise<{reminded:number, ownerAlerts:number}>}
 */
async function runSignatureReminders() {
  const pending = await Lease.find({ leaseStatus: 'PENDING_SIGNATURE' }).select('_id').lean();
  let reminded = 0;
  let ownerAlerts = 0;

  for (const { _id: leaseId } of pending) {
    try {
      const signer = await getCurrentSigner(leaseId);
      if (!signer) continue;

      // Invitation jamais partie (échec SMTP à l'ouverture) → on retente.
      if (!signer.inviteSentAt) {
        await resendInviteToCurrentSigner(leaseId).then(() => { reminded += 1; }).catch(() => {});
        continue;
      }

      const daysSinceInvite = (Date.now() - new Date(signer.inviteSentAt).getTime()) / 86400000;
      const remindersSent = (signer.remindersSentAt || []).length;

      if (
        remindersSent < SIGNATURE_REMINDER_DAYS.length &&
        daysSinceInvite >= SIGNATURE_REMINDER_DAYS[remindersSent]
      ) {
        await resendInviteToCurrentSigner(leaseId).then(() => { reminded += 1; }).catch(() => {});
        continue;
      }

      // Signataire muet malgré les relances → le bailleur doit le savoir
      // (appel téléphonique, autre email…), sinon la campagne meurt en silence.
      if (
        daysSinceInvite >= SIGNATURE_STALE_ALERT_DAYS &&
        !signer.ownerAlertedAt &&
        signer.role !== 'OWNER'
      ) {
        const owner = await LeaseSignature.findOne({ lease: leaseId, role: 'OWNER' }).lean();
        if (owner?.email) {
          const ok = await sendEmail({
            to: owner.email,
            subject: '⚠️ Votre bail attend toujours une signature — Maison Patrimo',
            text: `${signer.fullName || signer.email} n'a pas signé le bail malgré nos relances (invitation envoyée il y a ${Math.floor(daysSinceInvite)} jours, 2 rappels). Vous pouvez renvoyer le lien depuis votre espace (onglet Baux) ou le contacter directement.`,
          })
            .then(() => true)
            .catch(() => false);
          if (ok) {
            signer.ownerAlertedAt = new Date();
            await signer.save();
            ownerAlerts += 1;
          }
        }
      }
    } catch {
      // un bail en erreur ne doit pas bloquer les autres
    }
  }
  return { reminded, ownerAlerts };
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
        ${s.diditVerified ? '<br/><span style="color:#047857;font-size:11px;">✔ Identité vérifiée par contrôle biométrique lors de la candidature</span>' : ''}
        ${s.guaranteeMention ? `<br/><span style="color:#334155;font-size:10px;font-style:italic;">Mention apposée par la caution (art. 2297 C. civ.) :<br/>« ${escapeHtml(s.guaranteeMention)} »</span>` : ''}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#334155;">
        ${s.signedAt ? new Date(s.signedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—'}<br/>
        <span style="color:#64748b;">Code email validé${s.otpVerifiedAt ? ' ✔' : ''}</span><br/>
        <span style="color:#94a3b8;">IP ${escapeHtml(s.ip || '—')}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
        ${isSafeSignatureImage(s.signatureImage) ? `<img src="${s.signatureImage}" style="max-height:52px;max-width:150px;" />` : '—'}
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
      Signature électronique <strong>simple</strong> au sens du règlement (UE) n° 910/2014 (eIDAS)
      et de l'article 1367 du Code civil. Le consentement de chaque signataire a été recueilli par
      code à usage unique envoyé sur son adresse email.
    </p>
    <p style="font-size:10px;line-height:1.6;color:#475569;background:#f8fafc;padding:9px 11px;border-radius:6px;margin:10px 0 0;">
      <strong>Portée de la preuve.</strong> Ce certificat établit&nbsp;: la maîtrise de l'adresse
      email du signataire (code à usage unique), la date et l'heure de signature, l'adresse IP,
      et l'intégrité du document au moment de la signature (empreinte SHA-256 ci-dessous).
      La mention « identité vérifiée » atteste d'un contrôle biométrique réalisé
      <strong>lors de la candidature</strong>, sur la personne titulaire de cette adresse email&nbsp;;
      elle ne constitue pas une vérification d'identité au moment même de la signature.
      S'agissant d'une signature électronique simple, la charge de la preuve en cas de
      contestation incombe à celui qui s'en prévaut (art. 1367 C. civ.).
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
  computeGuaranteeAmount,
  finalizeSignedPdf,
  getCurrentSigner,
  openSignatureCampaign,
  resendInviteToCurrentSigner,
  runSignatureReminders,
  sendFinalPdfToParties,
  resolveSignatureByToken,
  sendSignatureOtp,
  verifySignatureOtp,
  recordSignature,
  buildCertificateHtml,
  // exportés pour les tests
  _internals: { sha256, isSafeSignatureImage, safeUploadsPath, TOKEN_TTL_DAYS, MAX_OTP_ATTEMPTS, OTP_CONSENT_WINDOW_MINUTES, SIGNATURE_REMINDER_DAYS, SIGNATURE_STALE_ALERT_DAYS },
};
