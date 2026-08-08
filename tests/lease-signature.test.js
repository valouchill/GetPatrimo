const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Signature électronique interne (eIDAS simple) — règles métier pures.
 * Pas de DB : on teste la construction de la liste des signataires, la
 * politique de token/OTP et la présence des éléments de preuve.
 */

const SERVICE = path.join(__dirname, '..', 'src', 'services', 'leaseSignatureService.js');
const { buildSignerList, buildCertificateHtml, _internals } = require(SERVICE);

describe('signataires du bail', () => {
  const base = {
    ownerEmail: 'bailleur@test.fr',
    ownerFullName: 'Alice Bailleur',
    tenantEmail: 'locataire@test.fr',
    tenantFirstName: 'Bob',
    tenantLastName: 'Locataire',
  };

  it('inclut bailleur et locataire, dans cet ordre', () => {
    const signers = buildSignerList(base);
    assert.equal(signers.length, 2);
    assert.equal(signers[0].role, 'OWNER');
    assert.equal(signers[1].role, 'TENANT');
    assert.ok(signers[0].order < signers[1].order);
  });

  it('ajoute un garant personne physique', () => {
    const signers = buildSignerList({
      ...base,
      guarantor: { email: 'garant@test.fr', firstName: 'Carl', lastName: 'Garant' },
    });
    assert.equal(signers.length, 3);
    assert.equal(signers[2].role, 'GUARANTOR');
  });

  it("EXCLUT le garant Visale (la garantie est portée par Action Logement)", () => {
    const signers = buildSignerList({
      ...base,
      guarantor: { email: 'visale@test.fr', visaleNumber: 'V123456789' },
    });
    assert.equal(signers.length, 2);
    assert.ok(!signers.some((s) => s.role === 'GUARANTOR'));
  });

  it('ajoute les colocataires avec un slot distinct', () => {
    const signers = buildSignerList({
      ...base,
      coTenants: [{ email: 'coloc@test.fr', firstName: 'Dan', lastName: 'Coloc' }],
    });
    const coloc = signers.find((s) => s.role === 'COTENANT');
    assert.ok(coloc);
    assert.equal(coloc.slot, 2);
  });

  it('ignore les signataires sans email', () => {
    const signers = buildSignerList({ ...base, coTenants: [{ firstName: 'SansMail' }] });
    assert.ok(signers.every((s) => s.email));
  });
});

describe('politique de preuve', () => {
  it('le token brut n’est jamais stocké : seul son SHA-256 l’est', () => {
    const src = fs.readFileSync(SERVICE, 'utf8');
    assert.match(src, /tokenHash: sha256\(rawToken\)/);
    // aucune écriture d'un champ "token" brut
    assert.ok(!/\btoken:\s*rawToken/.test(src));
  });

  it('les tentatives OTP sont bornées', () => {
    assert.ok(_internals.MAX_OTP_ATTEMPTS > 0 && _internals.MAX_OTP_ATTEMPTS <= 10);
  });

  it('les liens de signature expirent', () => {
    assert.ok(_internals.TOKEN_TTL_DAYS > 0 && _internals.TOKEN_TTL_DAYS <= 30);
  });

  it('le hash SHA-256 est déterministe et de la bonne longueur', () => {
    const h = _internals.sha256('bail');
    assert.equal(h.length, 64);
    assert.equal(h, crypto.createHash('sha256').update('bail').digest('hex'));
  });
});

describe('certificat de signature (piste d’audit)', () => {
  const lease = { tenantFirstName: 'Bob', tenantLastName: 'Locataire' };
  const signatures = [
    {
      role: 'TENANT',
      fullName: 'Bob Locataire',
      email: 'locataire@test.fr',
      signedAt: new Date('2026-03-01T10:00:00Z'),
      otpVerifiedAt: new Date('2026-03-01T09:59:00Z'),
      ip: '203.0.113.9',
      documentHash: 'a'.repeat(64),
      diditVerified: true,
      signatureImage: 'data:image/png;base64,AAA',
    },
  ];

  it('mentionne le fondement juridique, l’empreinte et l’horodatage', () => {
    const html = buildCertificateHtml(lease, signatures);
    assert.match(html, /1367 du Code civil/);
    assert.match(html, /eIDAS/);
    assert.match(html, /a{64}/); // empreinte SHA-256
    assert.match(html, /Identité vérifiée par contrôle biométrique/); // valorise la vérif Didit, sans amalgame
    assert.match(html, /203\.0\.113\.9/);
  });

  it('échappe les données utilisateur (anti-injection HTML)', () => {
    const html = buildCertificateHtml(lease, [
      { ...signatures[0], fullName: '<script>alert(1)</script>' },
    ]);
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.match(html, /&lt;script&gt;/);
  });
});

describe('correctifs de revue adversariale', () => {
  const { isSafeSignatureImage, safeUploadsPath, OTP_CONSENT_WINDOW_MINUTES } = _internals;

  it('F2 — refuse toute image de signature hors data-URL PNG/JPEG strict', () => {
    assert.ok(isSafeSignatureImage('data:image/png;base64,AAAA'));
    assert.ok(isSafeSignatureImage('data:image/jpeg;base64,AAA='));
    // injection HTML (exfiltration de fichier local dans le PDF via WeasyPrint)
    assert.ok(!isSafeSignatureImage('data:image/png;base64,AA" /><link rel="attachment" href="file:///etc/passwd" /><img src="x'));
    assert.ok(!isSafeSignatureImage('data:image/svg+xml,<svg onload=alert(1)>'));
    assert.ok(!isSafeSignatureImage('file:///etc/passwd'));
    assert.ok(!isSafeSignatureImage('data:image/png;base64,' + 'A'.repeat(500000)));
  });

  it('F1 — confine les chemins de documents sous uploads/', () => {
    assert.equal(safeUploadsPath('/etc/passwd'), null);
    assert.equal(safeUploadsPath('uploads/../../etc/passwd'), null);
    assert.equal(safeUploadsPath(''), null);
  });

  it('F3 — la fenêtre de consentement OTP est courte (anti-rejeu du lien)', () => {
    assert.ok(OTP_CONSENT_WINDOW_MINUTES > 0 && OTP_CONSENT_WINDOW_MINUTES <= 60);
    const src = fs.readFileSync(SERVICE, 'utf8');
    assert.match(src, /Session de signature expirée/);
  });

  it('F5 — le PDF final est produit AVANT de basculer le bail en ACTIVE', () => {
    const src = fs.readFileSync(SERVICE, 'utf8');
    const finalizeIdx = src.indexOf('const finalPath = await finalizeSignedPdf');
    const activeIdx = src.indexOf("fresh.leaseStatus = 'ACTIVE'");
    assert.ok(finalizeIdx > 0 && activeIdx > finalizeIdx);
  });

  it('F6 — une recompilation en cours de campagne bloque la signature', () => {
    const src = fs.readFileSync(SERVICE, 'utf8');
    assert.match(src, /signatureDocumentHash !== signature\.documentHash/);
  });

  it('F4 — un nouvel envoi de code réinitialise le compteur de tentatives', () => {
    const src = fs.readFileSync(SERVICE, 'utf8');
    const sendIdx = src.indexOf('async function sendSignatureOtp');
    const resetIdx = src.indexOf('signature.otpAttempts = 0', sendIdx);
    assert.ok(resetIdx > sendIdx);
  });
});

describe('améliorations module contrat (relances, renvoi, livraison finale)', () => {
  const service = require(SERVICE);

  it('les relances automatiques suivent le plan produit : J+2 puis J+5', () => {
    const { SIGNATURE_REMINDER_DAYS, SIGNATURE_STALE_ALERT_DAYS } = _internals;
    assert.deepEqual(SIGNATURE_REMINDER_DAYS, [2, 5]);
    // l'alerte bailleur ne part qu'APRÈS l'épuisement des relances
    assert.ok(SIGNATURE_STALE_ALERT_DAYS > SIGNATURE_REMINDER_DAYS[1]);
  });

  it('le service expose relance, renvoi et livraison finale', () => {
    assert.equal(typeof service.runSignatureReminders, 'function');
    assert.equal(typeof service.resendInviteToCurrentSigner, 'function');
    assert.equal(typeof service.sendFinalPdfToParties, 'function');
  });

  it('le renvoi régénère TOUJOURS un token frais (le brut n’est jamais stocké)', () => {
    const src = fs.readFileSync(SERVICE, 'utf8');
    const fn = src.slice(
      src.indexOf('async function resendInviteToCurrentSigner'),
      src.indexOf('async function sendFinalPdfToParties'),
    );
    assert.match(fn, /crypto\.randomBytes\(32\)/);
    assert.match(fn, /tokenHash = sha256\(rawToken\)/);
    // un renvoi ressuscite un lien expiré
    assert.match(fn, /status === 'EXPIRED'/);
  });

  it('à la complétion, chaque partie reçoit son exemplaire signé en pièce jointe', () => {
    const src = fs.readFileSync(SERVICE, 'utf8');
    // branché dans recordSignature (obligation de remise, art. 3 loi 89-462)
    const complete = src.slice(src.indexOf("fresh.leaseStatus = 'ACTIVE'"), src.indexOf('return { complete: true'));
    assert.match(complete, /sendFinalPdfToParties/);
    // et l'email embarque bien le PDF
    const deliver = src.slice(src.indexOf('async function sendFinalPdfToParties'), src.indexOf('async function runSignatureReminders'));
    assert.match(deliver, /attachments: \[\{ filename: 'bail-signe-maison-patrimo\.pdf', content: pdfBuffer \}\]/);
    // chemin confiné (pas de lecture disque arbitraire)
    assert.match(deliver, /safeUploadsPath/);
  });

  it('le cron de relance est câblé dans server.js', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.match(server, /safeCron\('signature-reminders', runSignatureReminders\)/);
  });

  it('le bailleur peut renvoyer le lien et télécharger le bail signé (ownership vérifiée)', () => {
    for (const rel of [
      'app/api/leases/[id]/signature/remind/route.ts',
      'app/api/leases/[id]/signature/document/route.ts',
    ]) {
      const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      assert.match(src, /String\(lease\.user\) !== String\(user\._id\)/, `${rel} doit vérifier l'ownership`);
    }
    // le téléchargement bailleur reste confiné sous uploads/
    const doc = fs.readFileSync(path.join(__dirname, '..', 'app/api/leases/[id]/signature/document/route.ts'), 'utf8');
    assert.match(doc, /startsWith\(uploadsRoot \+ path\.sep\)/);
  });

  it('l’alerte « signataire muet » ne part qu’une fois et jamais au bailleur pour lui-même', () => {
    const src = fs.readFileSync(SERVICE, 'utf8');
    const cron = src.slice(src.indexOf('async function runSignatureReminders'));
    assert.match(cron, /!signer\.ownerAlertedAt/);
    assert.match(cron, /signer\.role !== 'OWNER'/);
  });
});
