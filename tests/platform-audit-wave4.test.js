const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('acte de cautionnement — art. 2297 C. civ.', () => {
  const { computeGuaranteeAmount } = require('../src/services/leaseSignatureService');

  it('calcule l’engagement sur loyer + charges × durée', () => {
    assert.equal(computeGuaranteeAmount({ rentAmount: 800, chargesAmount: 50, durationMonths: 12 }), 10200);
    assert.equal(computeGuaranteeAmount({ rentAmount: 500, durationMonths: 1 }), 500);
  });

  it('la caution doit APPOSER elle-même sa mention (pré-remplie = nullité)', () => {
    const src = read('src/services/leaseSignatureService.js');
    assert.match(src, /signature\.role === 'GUARANTOR'/);
    assert.match(src, /art\. 2297/);
    // la mention doit porter le montant exact
    assert.match(src, /digitsOnly\.includes\(expectedDigits\)/);
    // longueur minimale : une mention vide ou d'un mot ne vaut pas engagement
    assert.match(src, /mention\.length < 20/);
  });

  it('la mention figure au certificat comme élément de preuve', () => {
    assert.match(read('src/services/leaseSignatureService.js'), /Mention apposée par la caution/);
  });

  it('le parcours public expose le montant sans pré-remplir le texte', () => {
    const route = read('app/api/public/sign/[token]/route.ts');
    assert.match(route, /computeGuaranteeAmount\(lease\)/);
    const ui = read('app/sign/[token]/SignClient.tsx');
    assert.match(ui, /Recopiez cette mention/);
    // le champ ne doit PAS être pré-rempli : seulement un placeholder d'exemple
    assert.match(ui, /value=\{guaranteeMention\}/);
    assert.match(ui, /placeholder=\{`Exemple/);
    assert.match(ui, /guaranteeMention\.trim\(\)\.length < 20/); // bouton bloqué
  });
});

describe('quittances — un seul document possible', () => {
  it('generateReceipt délègue à la V2 (les deux mises en page divergeaient)', () => {
    const src = read('lib/services/paymentService.ts');
    const alias = src.slice(src.indexOf('export async function generateReceipt(p'), src.indexOf('async function generateReceiptLegacyV1'));
    assert.match(alias, /return generateReceiptV2\(payment\)/);
  });
});

describe('retour de paiement Stripe', () => {
  const src = read('app/(platform)/dashboard/owner/OwnerDashboardClient.tsx');
  it('sonde plusieurs fois au lieu d’un unique refresh à 2,5 s', () => {
    assert.match(src, /const delays = \[1500, 3000, 5000, 8000, 12000\]/);
    assert.ok(!src.includes('setTimeout(() => { refresh(); }, 2500)'));
  });
  it('affiche « activation en cours » puis un recours manuel', () => {
    assert.match(src, /activation de votre offre en cours/);
    assert.match(src, /Actualiser/);
  });
});

describe('upsell Gestion — présent au bon moment', () => {
  it('est aussi rendu dans l’onglet Baux (juste après la signature)', () => {
    const src = read('app/(platform)/dashboard/owner/OwnerDashboardClient.tsx');
    assert.match(src, /import \{ ManagementUpsell \}/);
    const bauxBlock = src.slice(src.indexOf("{page === 'baux'"), src.indexOf('<BauxPanel'));
    assert.match(bauxBlock, /ManagementUpsell/);
  });
});

describe('vague 4b — UX, accessibilité, onboarding', () => {
  it('le tunnel de candidature est navigable au clavier', () => {
    const src = read('app/apply/[id]/ApplyClient.tsx');
    // les étapes étaient des motion.div cliquables : inatteignables au clavier
    assert.match(src, /<motion\.button\s+type="button"\s+aria-current=\{isActive \? 'step' : undefined\}/);
    assert.match(src, /focus-visible:ring-2/);
  });

  it('le tableau de comparaison EDL scrolle sur mobile', () => {
    const src = read('app/(platform)/dashboard/owner/components/EdlPanel.tsx');
    assert.match(src, /overflow-x-auto rounded-xl border border-slate-200/);
    assert.match(src, /min-w-\[34rem\]/);
  });

  it('les modules gestion respectent le contraste AA (plus de slate-400)', () => {
    for (const rel of [
      'app/(platform)/dashboard/owner/components/LoyersPanel.tsx',
      'app/(platform)/dashboard/owner/components/BauxPanel.tsx',
      'app/(platform)/dashboard/owner/components/EdlPanel.tsx',
      'app/(platform)/dashboard/owner/components/SignatureQueue.tsx',
    ]) {
      assert.ok(!read(rel).includes('text-slate-400'), `${rel} : slate-400 ≈ 2,9:1, sous le seuil AA`);
    }
  });

  it('plus de statistique marketing inventée dans l’état vide', () => {
    const src = read('app/(platform)/dashboard/owner/components/DashboardEmptyState.tsx');
    assert.ok(!src.includes('78 %'), 'chiffre non mesurable affiché comme un fait');
  });

  it('un email de bienvenue part à l’inscription, sans jamais la bloquer', () => {
    const route = read('app/api/auth/register/route.ts');
    assert.match(route, /sendWelcomeEmail/);
    assert.match(route, /\.catch\(/); // best-effort
    const mod = read('lib/emails/welcome.ts');
    assert.match(mod, /role === 'tenant'/); // contenu différencié par rôle
    assert.match(mod, /isEmailConfigured/);
  });

  it('on ne relance jamais un signataire vers un bail sans document', () => {
    const src = read('src/services/leaseSignatureService.js');
    const fn = src.slice(src.indexOf('async function resendInviteToCurrentSigner'), src.indexOf('async function sendFinalPdfToParties'));
    assert.match(fn, /Le document du bail est introuvable/);
    assert.match(fn, /safeUploadsPath\(refDoc\.pdfPath\)/);
  });
});

describe('vague 5 — overlays sur la primitive partagée', () => {
  it('les modules gestion ne re-codent plus d’overlay à la main', () => {
    // Un `fixed inset-0` artisanal n'a ni piège de focus, ni fermeture au
    // clavier, ni verrouillage du scroll, ni rendu mobile en feuille.
    for (const rel of [
      'app/(platform)/dashboard/owner/components/BauxPanel.tsx',
      'app/(platform)/dashboard/owner/components/EdlPanel.tsx',
      'app/(platform)/dashboard/owner/components/LoyersPanel.tsx',
    ]) {
      assert.ok(!read(rel).includes('fixed inset-0'), `${rel} doit utiliser <Modal>/<Overlay>`);
    }
  });

  it('chacun importe bien la primitive', () => {
    assert.match(read('app/(platform)/dashboard/owner/components/BauxPanel.tsx'), /components\/ui\/Modal/);
    assert.match(read('app/(platform)/dashboard/owner/components/LoyersPanel.tsx'), /components\/ui\/Modal/);
    const edl = read('app/(platform)/dashboard/owner/components/EdlPanel.tsx');
    assert.match(edl, /components\/ui\/Modal/);
    assert.match(edl, /components\/ui\/Overlay/);
  });
});
