const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * Correctifs de l'audit cybersécurité plateforme (0 critique, 2 HIGH, 1 MEDIUM, 1 LOW).
 * Garde-fous de source : ces failles ne doivent pas réapparaître.
 */

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('#1 HIGH — plus aucun credential Mongo en dur', () => {
  it('rebuild.sh ne contient plus de mot de passe en clair', () => {
    assert.ok(!read('rebuild.sh').includes('password123'));
  });
  it('backfill-aiAnalysis.js lit exclusivement process.env, sans repli en dur', () => {
    const src = read('scripts/backfill-aiAnalysis.js');
    assert.ok(!src.includes('password123'));
    assert.match(src, /process\.env\.MONGO_URI/);
    assert.match(src, /process\.exit\(1\)/); // échec explicite si absent
  });
});

describe('#2 HIGH — droit à l’effacement RGPD opérant sur l’identité KYC', () => {
  it('DELETE /api/user/data purge IdentitySession, Guarantor et CoTenant', () => {
    const src = read('app/api/user/data/route.ts');
    assert.match(src, /IdentitySession\.deleteMany/);
    assert.match(src, /Guarantor\.deleteMany/);
    assert.match(src, /CoTenant\.deleteMany/);
    // la jointure se fait par applyToken collecté AVANT suppression des applications
    assert.match(src, /applyToken: \{ \$in: applyTokens \}/);
  });

  it('le cron RGPD matche les statuts en insensible à la casse', () => {
    const src = read('src/cron/rgpdPurge.js');
    assert.match(src, /\/\^approved\$\/i/); // le webhook écrit 'approved' en minuscules
    assert.ok(!/\$in: \['VERIFIED', 'APPROVED'/.test(src), 'plus de filtre MAJUSCULES qui ne matchait jamais');
  });

  it('le cron efface les VRAIS champs d’identité (pas des champs fantômes)', () => {
    const src = read('src/cron/rgpdPurge.js');
    assert.match(src, /firstName: '',/);
    assert.match(src, /birthDate: '',/);
    assert.ok(!src.includes("'verificationData.selfie'"), 'ces champs n’existent pas dans le schéma');
    assert.match(src, /IDENTITY_RETENTION_DAYS/); // rétention explicite
  });
});

describe('#3 MEDIUM — octroi de crédits idempotent (anti double-quota)', () => {
  const src = read('app/api/webhooks/stripe/route.ts');
  it('le quota est gardé par session Stripe (rejeu ne double jamais)', () => {
    assert.match(src, /checkoutSessionsApplied: \{ \$ne: session\.id \}/);
    assert.match(src, /\$push: \{ checkoutSessionsApplied: session\.id \}/);
  });
  it('le cumul utilise $inc (atomique), plus read+SET', () => {
    assert.match(src, /\$inc: \{ dossiersQuota: newPackQuota \}/);
  });
});

describe('#4 LOW — plus de fuite PII/KYC sur l’endpoint public dossier', () => {
  it('la route [docType] n’expose plus les champs OCR bruts', () => {
    const src = read('app/api/public/dossier/[slug]/[docType]/route.ts');
    // extractAiInsights ne doit plus retourner extractedFields
    const fn = src.slice(src.indexOf('function extractAiInsights'), src.indexOf('function extractAiInsights') + 800);
    assert.ok(!/extractedFields,/.test(fn), 'extractedFields ne doit plus être dans la réponse publique');
    assert.match(fn, /fraudScore/); // les métadonnées de confiance restent
  });
});
