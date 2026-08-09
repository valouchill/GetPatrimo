const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

/** Vague 2 de l'état des lieux : dette, fiabilité, UX, monétisation, conformité. */

describe('dette — surfaces mortes supprimées', () => {
  it('la chaîne OpenSign dormante n’existe plus (jamais provisionnée, supplantée)', () => {
    for (const rel of [
      'src/services/opensignService.js',
      'src/controllers/webhookController.js',
      'src/routes/webhookRoutes.js',
      'app/api/webhooks/opensign/route.ts',
      'app/api/leases/[id]/opensign/launch/route.ts',
    ]) {
      assert.ok(!exists(rel), `${rel} doit être supprimé`);
    }
  });

  it('le contrôleur bail Express (26 Ko masqués) est supprimé', () => {
    assert.ok(!exists('src/controllers/leaseController.js'));
    assert.ok(!exists('src/routes/leaseRoutes.js'));
  });
});

describe('fiabilité — le serveur ne meurt plus pour un cron', () => {
  it('connectDB lève au lieu de tuer le process (les crons tournent DANS le serveur)', () => {
    const src = read('src/config/db.js');
    // on cible l'APPEL, pas la mention en commentaire qui documente le correctif
    assert.ok(!/^\s*process\.exit\(/m.test(src), 'un incident Mongo pendant un cron tuait tout le site');
    assert.match(src, /throw new Error/);
    assert.match(src, /readyState === 1/); // idempotent
  });

  it('les appels OpenAI sont bornés dans le temps (fetch n’a aucun timeout par défaut)', () => {
    const helper = read('src/utils/openaiFetch.js');
    assert.match(helper, /AbortController/);
    assert.match(helper, /isRetryableStatus/);
    for (const rel of ['src/services/documentAnalysisService.js', 'src/services/aiService.js', 'src/services/taxOcrService.js']) {
      assert.match(read(rel), /openaiFetch\(/, `${rel} doit utiliser le client borné`);
    }
  });

  it('les emails critiques sont réessayés sur erreur transitoire', () => {
    const src = read('src/services/emailService.js');
    assert.match(src, /MAX_SEND_ATTEMPTS/);
    assert.match(src, /isTransientSmtpError/);
    // une 5xx définitive ne doit PAS être réessayée
    const { _internals } = require('../src/services/emailService');
    assert.equal(_internals.isTransientSmtpError({ responseCode: 550 }), false);
    assert.equal(_internals.isTransientSmtpError({ responseCode: 421 }), true);
    assert.equal(_internals.isTransientSmtpError({ code: 'ETIMEDOUT' }), true);
  });

  it('le healthcheck teste la liveness, pas la disponibilité de Mongo', () => {
    const dockerfile = read('Dockerfile');
    assert.match(dockerfile, /localhost:3000\/healthz/);
    assert.ok(!/CMD curl -f http:\/\/localhost:3000\/health \|\|/.test(dockerfile));
  });

  it('la purge RGPD attrape les documents sans updatedAt', () => {
    const src = read('src/cron/rgpdPurge.js');
    assert.match(src, /objectIdFromDate/);
    assert.match(src, /updatedAt: \{ \$exists: false \}/);
  });

  it('la livraison du bail signé n’avale plus son échec', () => {
    const src = read('src/services/leaseSignatureService.js');
    assert.ok(!src.includes('sendFinalPdfToParties(String(lease._id)).catch(() => {})'));
    assert.match(src, /livraison du bail signé échouée/);
  });
});

describe('UX — plus d’action muette ni d’envoi surprise', () => {
  it('une relance en masse demande confirmation (emails réels, irréversible)', () => {
    const src = read('app/(platform)/dashboard/owner/components/LoyersPanel.tsx');
    assert.match(src, /confirmRemindAll/);
    assert.match(src, /Envoyer les relances \?/);
    assert.match(src, /from '@\/app\/components\/ui\/Modal'/); // primitive réutilisée
  });

  it('renouvellement et résiliation remontent leurs erreurs', () => {
    const src = read('app/(platform)/dashboard/owner/components/BauxPanel.tsx');
    assert.ok(!src.includes('/* silent */'));
    assert.match(src, /setActionError/);
    assert.match(src, /role="alert"/);
  });

  it('le funnel de candidature ne charge plus d’image externe', () => {
    assert.ok(!read('app/apply/[id]/ApplyClient.tsx').includes('images.unsplash.com'));
  });

  it('la page de bail démo redirige au lieu de servir de fausses données', () => {
    const src = read('app/(platform)/dashboard/owner/lease/page.tsx');
    assert.match(src, /redirect\('\/dashboard\/owner\/contracts'\)/);
    assert.ok(!/^import .*LeasePreparationPage/m.test(src), 'le composant démo ne doit plus être rendu');
  });

  it('plus de modèle sans fichier ni carte « PDF » servant un .docx', () => {
    const src = read('app/(platform)/dashboard/owner/components/LeasePreparationPage.tsx');
    assert.ok(!src.includes("file: 'bail-civil'"), 'aucun bail-civil.docx dans public/templates');
    assert.ok(!src.includes('format="PDF"'), 'la carte PDF téléchargeait un .docx renommé');
  });
});

describe('monétisation — funnel mesurable et prix compétitif', () => {
  it('un event est émis à l’ENTRÉE du checkout (conversion calculable)', () => {
    assert.match(read('app/api/billing/management/route.ts'), /checkout_started/);
    assert.match(read('app/api/billing/subscribe/route.ts'), /checkout_started/);
  });

  it('un plan annuel existe, avec repli automatique sur le tarif standard', () => {
    const route = read('app/api/billing/management/route.ts');
    assert.match(route, /billingCycle: BillingCycle/);
    assert.match(route, /resolvePriceId\(billingCycle, activeSubscriptions\)/);
    // le repli mensuel/standard est désormais testé dans tests/management-pricing.test.js
    const upsell = read('app/(platform)/dashboard/owner/components/ManagementUpsell.tsx');
    assert.match(upsell, /priceFor\('yearly', activeSubscriptions\)/);
  });
});

describe('conformité — documents légaux exacts', () => {
  it('aucun placeholder ne subsiste dans les trois documents', () => {
    for (const rel of [
      'app/(platform)/cgv/page.tsx',
      'app/(platform)/privacy/page.tsx',
      'app/(platform)/mentions-legales/page.tsx',
    ]) {
      const src = read(rel);
      assert.ok(!src.includes('À COMPLÉTER'), `${rel}`);
      assert.ok(!src.includes('À DÉSIGNER'), `${rel}`);
    }
  });

  it('la base légale du KYC biométrique est le consentement explicite (art. 9.2.a)', () => {
    const src = read('app/(platform)/privacy/page.tsx');
    // « obligation légale » était faux : aucune obligation de KYC pour un bailleur
    assert.match(src, /art\. 9\.2\.a/);
    assert.match(src, /Consentement explicite/);
    assert.ok(!/Vérification d&apos;identité \(Didit KYC\)[\s\S]{0,120}Obligation légale/.test(src));
  });

  it('la rétention KYC annoncée correspond au cron (90 jours)', () => {
    assert.match(read('app/(platform)/privacy/page.tsx'), /90 jours/);
    assert.match(read('src/cron/rgpdPurge.js'), /IDENTITY_RETENTION_DAYS = 90/);
  });

  it('la TVA n’est plus affirmée à 20 % sans connaître le régime', () => {
    const cgv = read('app/(platform)/cgv/page.tsx');
    assert.ok(!cgv.includes('TVA française de 20 %'));
    assert.match(cgv, /293 B du CGI/); // franchise en base mentionnée
  });
});
