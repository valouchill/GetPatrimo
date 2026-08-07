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
    assert.match(html, /Identité vérifiée eIDAS/); // valorise la vérif Didit
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
