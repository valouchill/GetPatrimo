const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function loadTs(rel) {
  const out = ts.transpileModule(read(rel), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const tmp = path.join(require('os').tmpdir(), `att-${Date.now()}-${Math.round(process.hrtime()[1])}.js`);
  fs.writeFileSync(tmp, out);
  const mod = require(tmp);
  fs.unlinkSync(tmp);
  return mod;
}

const P = loadTs('lib/attestation/protocol.ts');

describe('protocole de contrôle — le verdict est une décision, pas un score', () => {
  const all = (status) => P.PROTOCOL_CHECKS.map((c) => ({ code: c.code, label: c.label, status }));

  it('CONFORME quand tous les contrôles bloquants passent', () => {
    assert.equal(P.computeVerdict(all('PASSED')), 'CONFORME');
  });

  it('un SEUL contrôle bloquant en échec suffit — aucune moyenne, aucune pondération', () => {
    const checks = all('PASSED');
    const blocking = P.PROTOCOL_CHECKS.find((c) => c.blocking);
    checks.find((c) => c.code === blocking.code).status = 'FAILED';
    assert.equal(P.computeVerdict(checks), 'NON_CONFORME');
  });

  it('un contrôle NON bloquant en échec ne rend pas le dossier non conforme', () => {
    const checks = all('PASSED');
    const soft = P.PROTOCOL_CHECKS.find((c) => !c.blocking);
    checks.find((c) => c.code === soft.code).status = 'FAILED';
    assert.equal(P.computeVerdict(checks), 'CONFORME');
  });

  it('INCOMPLET si un contrôle bloquant n’a pas pu être exécuté (un doute n’est pas une fraude)', () => {
    const checks = all('PASSED');
    const blocking = P.PROTOCOL_CHECKS.find((c) => c.blocking);
    checks.find((c) => c.code === blocking.code).status = 'UNAVAILABLE';
    assert.equal(P.computeVerdict(checks), 'INCOMPLET');
  });

  it('INCOMPLET si un contrôle bloquant est absent du résultat', () => {
    const blocking = P.PROTOCOL_CHECKS.filter((c) => c.blocking);
    const partial = all('PASSED').filter((c) => c.code !== blocking[0].code);
    assert.equal(P.computeVerdict(partial), 'INCOMPLET');
  });

  it('les contrôles bloquants sont DÉTERMINISTES (un calcul se défend, un score non)', () => {
    for (const c of P.PROTOCOL_CHECKS.filter((x) => x.blocking)) {
      assert.equal(c.kind, 'deterministic', `${c.code} bloque le verdict : il doit être déterministe`);
    }
  });
});

describe('vocabulaire — ne jamais sur-promettre sur une pièce opposée', () => {
  const forbidden = ['opposable', 'force probante', 'valeur probante', 'présomption', 'certifié authentique'];

  it('ni le protocole ni le service ne revendiquent une valeur qu’ils n’ont pas', () => {
    for (const rel of ['lib/attestation/protocol.ts', 'lib/attestation/service.ts']) {
      const src = read(rel).toLowerCase();
      for (const word of forbidden) {
        // toléré uniquement dans un commentaire d'interdiction
        const inProhibition = src.includes(`« ${word} »`) || src.includes('vocabulaire interdit');
        assert.ok(!src.includes(word) || inProhibition, `${rel} contient « ${word} »`);
      }
    }
  });

  it('l’attestation énonce sa portée et l’obligation de moyens', () => {
    const src = read('lib/attestation/service.ts');
    assert.match(src, /ne constitue ni une certification d’authenticité/);
    assert.match(src, /obligation de moyens/);
  });
});

describe('vérification par un tiers', () => {
  it('la page publique ne divulgue AUCUNE donnée personnelle ni pièce', () => {
    const src = read('app/verifier/[id]/page.tsx');
    // seuls existence, date, verdict et protocole sont sélectionnés
    assert.match(src, /\.select\('verificationId verdict protocolVersion checks issuedAt revokedAt documentsCount'\)/);
    assert.ok(!src.includes('candidateName'), 'le nom du candidat ne doit jamais apparaître');
    assert.match(src, /robots: \{ index: false/);
  });

  it('une attestation révoquée est signalée, jamais effacée', () => {
    assert.match(read('app/verifier/[id]/page.tsx'), /Attestation révoquée/);
    assert.match(read('models/DossierAttestation.js'), /revokedAt/);
  });

  it('l’identifiant évite les caractères ambigus (recopié à la main)', () => {
    const src = read('lib/attestation/service.ts');
    assert.match(src, /sans I\/O\/0\/1/);
    assert.ok(!/ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/.test(src));
  });
});

describe('traduction des verdicts du moteur', () => {
  const S = P; // fonction pure, dans le protocole (aucune dépendance PDF/base)

  it('un contrôle non exécuté n’est JAMAIS marqué comme réussi', () => {
    const checks = S.mapEngineToChecks(null);
    const blocking = ['PAYSLIP_ARITHMETIC', 'TAX_NOTICE_SEAL', 'IDENTITY_CONCORDANCE'];
    for (const code of blocking) {
      const c = checks.find((x) => x.code === code);
      assert.equal(c.status, 'UNAVAILABLE', `${code} sans donnée doit être UNAVAILABLE, pas PASSED`);
    }
    assert.equal(P.computeVerdict(checks), 'INCOMPLET');
  });

  it('un calcul de bulletin faux rend le dossier NON CONFORME', () => {
    const checks = S.mapEngineToChecks({
      trust_and_security: { math_validation: false, forensic_alerts: ['Écart de 860,00 € entre Brut - Cotisations et Net'] },
      fiscalSeal: true,
      identityConcordance: { consistent: true },
    });
    assert.equal(P.computeVerdict(checks), 'NON_CONFORME');
    assert.match(checks.find((c) => c.code === 'PAYSLIP_ARITHMETIC').detail, /Écart/);
  });

  it('un dossier complet et cohérent est CONFORME', () => {
    const checks = S.mapEngineToChecks({
      trust_and_security: { math_validation: true, forensic_alerts: [] },
      fiscalSeal: true,
      identityConcordance: { consistent: true },
    });
    assert.equal(P.computeVerdict(checks), 'CONFORME');
  });
});
