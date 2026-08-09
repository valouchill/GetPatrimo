const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  verifyPayslipArithmetic,
  applyPayslipArithmeticVerdict,
} = require('../src/utils/payslipArithmetic');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * Deux garde-fous issus de l'audit sécurité :
 *  - le contrôle arithmétique du bulletin était DÉCIDÉ par le modèle sur un
 *    document non fiable (prompt-injection possible) ;
 *  - le certificat de signature affirmait « identité vérifiée eIDAS » alors que
 *    l'email du signataire est saisi par le bailleur.
 */

describe('contrôle arithmétique serveur du bulletin de salaire', () => {
  it('valide un bulletin cohérent (brut - cotisations = net)', () => {
    const r = verifyPayslipArithmetic({ gross: 3000, deductions: 660, net: 2340 });
    assert.equal(r.checked, true);
    assert.equal(r.coherent, true);
  });

  it('tolère le « net imposable » capté au lieu du « net à payer » (anti faux positif)', () => {
    // Sans le garde-fou des 2 %, un bulletin AUTHENTIQUE serait accusé de fraude.
    const r = verifyPayslipArithmetic({ gross: 3000, deductions: 660, net: 2400 });
    assert.equal(r.coherent, true);
  });

  it('détecte un net gonflé (falsification)', () => {
    const r = verifyPayslipArithmetic({ gross: 3000, deductions: 660, net: 3200 });
    assert.equal(r.coherent, false);
    assert.ok(r.diff > r.tolerance);
  });

  it('ne conclut JAMAIS sur des montants manquants (un doute n’est pas une fraude)', () => {
    assert.equal(verifyPayslipArithmetic({ gross: 3000, deductions: null, net: 2340 }).checked, false);
    assert.equal(verifyPayslipArithmetic({ gross: 0, deductions: 0, net: 0 }).checked, false);
  });

  it('le verdict serveur ÉCRASE un math_validation menteur du modèle', () => {
    const trust = { fraud_score: 0, math_validation: true, forensic_alerts: [] };
    const flagged = applyPayslipArithmeticVerdict(trust, { gross: 3000, deductions: 660, net: 3200 });
    assert.equal(flagged, true);
    assert.equal(trust.math_validation, false);
    assert.equal(trust.fraud_score, 30);
    assert.match(trust.forensic_alerts[0], /contrôle serveur/);
  });

  it('un calcul juste ne BLANCHIT pas les autres signaux forensiques', () => {
    const trust = { fraud_score: 60, forensic_alerts: ['métadonnées suspectes'] };
    applyPayslipArithmeticVerdict(trust, { gross: 3000, deductions: 660, net: 2340 });
    assert.equal(trust.fraud_score, 60, 'le score ne doit jamais baisser');
    assert.equal(trust.math_validation, true);
  });

  it('les DEUX chemins d’analyse appliquent le contrôle serveur', () => {
    for (const rel of [
      'src/services/documentAnalysisService.js',
      'src/services/visionAnalysisService.js',
    ]) {
      assert.match(read(rel), /applyPayslipArithmeticVerdict/, `${rel} doit recalculer côté serveur`);
    }
    // le chemin vision ne doit plus se contenter du verdict du modèle
    const vision = read('src/services/visionAnalysisService.js');
    assert.ok(!/math_validation: mathValidation,\n    \},/.test(vision));
  });
});

describe('non-répudiation de la signature électronique', () => {
  it('le badge « identité vérifiée » exige que le signataire SOIT le candidat vérifié', () => {
    const src = read('app/api/leases/[id]/signature/route.ts');
    // sans ce lien, un bailleur pouvait mettre son propre email et auto-signer
    assert.match(src, /verifiedEmail === signerEmail/);
    assert.match(src, /select\('didit userEmail'\)/);
  });

  it('le certificat énonce la portée exacte de la preuve, sans amalgame', () => {
    const src = read('src/services/leaseSignatureService.js');
    assert.match(src, /Portée de la preuve/);
    assert.match(src, /lors de la candidature/);
    assert.match(src, /ne constitue pas une vérification d'identité au moment même de la signature/);
    assert.match(src, /charge de la preuve/);
    // l'ancienne formulation trompeuse a disparu
    assert.ok(!src.includes('Identité vérifiée eIDAS (biométrie)'));
  });
});
