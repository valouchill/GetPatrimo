const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Correctifs de l'état des lieux plateforme (75 findings, vague « Maintenant »). */

describe('module loyers — génération mensuelle réparée', () => {
  const {
    BILLABLE_LEASE_STATUSES,
    billableLeaseFilter,
    calculateProrata,
  } = require('../src/services/rentGenerationService');

  it('ne facture QUE les baux signés et en cours', () => {
    // Un bail DRAFT/PENDING_SIGNATURE générait des loyers → puis des relances,
    // jusqu'à une mise en demeure à J+30 sur un contrat non signé.
    assert.deepEqual(BILLABLE_LEASE_STATUSES, ['ACTIVE', 'EXPIRING']);
    const f = billableLeaseFilter(new Date());
    assert.deepEqual(f.leaseStatus, { $in: ['ACTIVE', 'EXPIRING'] });
  });

  it('le cron ne réécrit plus le champ tenant inexistant (bug : 0 loyer généré)', () => {
    const cron = read('src/cron/monthlyPayments.js');
    assert.ok(!cron.includes('lease.tenantId'), 'Lease n’a jamais eu ce champ');
    assert.match(cron, /createMonthlyPaymentForLease/);
    assert.match(cron, /billableLeaseFilter/);
  });

  it('le locataire est résolu par email (Lease stocke un email, Payment exige un ObjectId)', () => {
    const svc = read('src/services/rentGenerationService.js');
    assert.match(svc, /User\.findOne\(\{ email: tenantEmail \}\)/);
  });

  it('calcule le prorata d’entrée en cours de mois', () => {
    // bail démarrant le 16 d'un mois de 30 jours → 15 jours occupés
    const p = calculateProrata({ startDate: new Date(2026, 3, 16), endDate: null }, 4, 2026);
    assert.equal(p.isProrata, true);
    assert.equal(p.daysInMonth, 30);
    assert.equal(p.daysOccupied, 15);
  });

  it('mois complet = pas de prorata', () => {
    const p = calculateProrata({ startDate: new Date(2026, 0, 1), endDate: null }, 4, 2026);
    assert.equal(p.isProrata, false);
    assert.equal(p.ratio, 1);
  });
});

describe('observabilité des crons', () => {
  it('un rapport contenant des erreurs est escaladé en logger.error (donc Sentry)', () => {
    const server = read('server.js');
    assert.match(server, /terminé AVEC ERREURS/);
    assert.match(server, /Array\.isArray\(result\?\.errors\)/);
  });

  it('le cron de backup interne (mongodump absent, dossier éphémère) est retiré', () => {
    const server = read('server.js');
    assert.ok(!server.includes('runMongoBackup'), 'la sauvegarde réelle est un cron HÔTE');
    assert.match(server, /scripts\/mongo-backup\.sh/); // documenté dans le code
  });
});

describe('conversion — on ne vend plus comme « bientôt » ce qui est livré', () => {
  const landing = read('app/(platform)/LandingClient.tsx');

  it('le pilier bail n’est plus annoncé « bientôt disponible »', () => {
    assert.ok(!landing.includes('Le Scellement — bientôt disponible'));
    assert.match(landing, /Signature électronique en ligne/);
  });

  it('la gestion locative est vendue UNIQUEMENT si elle est achetable', () => {
    // Ce test affirmait auparavant qu'il suffisait du flag de feature — ce qui
    // encodait le bug : la landing annonçait 4,99 € alors que la souscription
    // répondait 503 faute de prix Stripe.
    assert.match(landing, /isEnabled\('MANAGEMENT'\) && managementPurchasable \?/);
    assert.match(landing, /4,99 € \/ mois/);
    assert.match(landing, /Activer la gestion locative/);
  });

  it('un outil d’annonce aux inscrits existe, idempotent et en dry-run par défaut', () => {
    const script = read('scripts/notify-waitlist-launch.js');
    assert.match(script, /--send/);
    assert.match(script, /notifiedAt: null/); // ne renotifie jamais
    assert.match(read('models/Lead.js'), /notifiedAt/);
  });
});

describe('UX — l’échec d’upload garant ne se déguise plus en succès', () => {
  const src = read('app/(platform)/verify-guarantor/[token]/GuarantorVerificationClient.tsx');

  it('une carte en erreur n’est plus verte avec une coche', () => {
    assert.match(src, /const hasError = Boolean\(document\?\.uploadError\)/);
    assert.match(src, /!document\.uploading && !hasError/);
  });

  it('le message d’erreur est affiché et annoncé', () => {
    assert.match(src, /role="alert"/);
    assert.match(src, /Touchez pour réessayer/);
  });

  it('le format et la taille sont validés avant envoi', () => {
    assert.match(src, /Format non accepté/);
    assert.match(src, /trop lourd/);
  });
});

describe('conformité — mentions légales à source unique', () => {
  it('plus aucun placeholder technique dans les pages légales', () => {
    assert.equal(read('app/(platform)/mentions-legales/page.tsx').includes('À COMPLÉTER'), false);
    assert.equal(read('app/(platform)/privacy/page.tsx').includes('À COMPLÉTER'), false);
  });

  it('l’hébergeur déclaré est celui du serveur (vérifié AS16276 OVH)', () => {
    const c = read('lib/legal/company.ts');
    assert.match(c, /OVH SAS/);
    assert.match(c, /Roubaix/);
  });

  it('un garde-fou permet de vérifier la complétude avant commercialisation', () => {
    const c = read('lib/legal/company.ts');
    assert.match(c, /export function isCompanyIdentityComplete/);
    assert.match(c, /À RENSEIGNER AVANT TOUTE EXPLOITATION COMMERCIALE/);
  });
});
