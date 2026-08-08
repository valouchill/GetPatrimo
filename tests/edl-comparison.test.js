const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * État des lieux — normalisation du vocabulaire de vétusté.
 *
 * Le modèle accepte deux vocabulaires (nouveau `TRES_BON…HORS_SERVICE` et
 * legacy `GOOD…NEEDS_RENOVATION`) mais la comparaison entrée/sortie ne
 * connaissait QUE le legacy : les dégradations saisies dans le wizard avec les
 * nouveaux libellés n'étaient jamais détectées → retenues sur dépôt perdues.
 * On rejoue ici la règle métier (les routes Next ne sont pas importables en
 * test unitaire pur — même approche que tests/deposit-validation.test.js).
 */

const CONDITION_RANK = {
  TRES_BON: 0, GOOD: 0,
  BON: 1,
  USAGE_NORMAL: 2, NORMAL_WEAR: 2,
  MAUVAIS_ETAT: 3, DEGRADED: 3,
  HORS_SERVICE: 4, NEEDS_RENOVATION: 4,
};
const rank = (v) => CONDITION_RANK[String(v || 'BON').toUpperCase()] ?? 1;
const isDegradation = (entry, exit) => rank(exit) > rank(entry) && rank(exit) >= 3;

describe('détection des dégradations (entrée → sortie)', () => {
  it('détecte une dégradation exprimée dans le NOUVEAU vocabulaire', () => {
    assert.ok(isDegradation('TRES_BON', 'MAUVAIS_ETAT'));
    assert.ok(isDegradation('BON', 'HORS_SERVICE'));
  });

  it('détecte encore les dégradations legacy (non-régression)', () => {
    assert.ok(isDegradation('GOOD', 'DEGRADED'));
    assert.ok(isDegradation('NORMAL_WEAR', 'NEEDS_RENOVATION'));
  });

  it('fonctionne quand les deux vocabulaires se mélangent', () => {
    assert.ok(isDegradation('GOOD', 'HORS_SERVICE'));
    assert.ok(isDegradation('TRES_BON', 'DEGRADED'));
  });

  it('ne retient PAS l’usure normale (non imputable au locataire)', () => {
    assert.ok(!isDegradation('TRES_BON', 'USAGE_NORMAL'));
    assert.ok(!isDegradation('BON', 'USAGE_NORMAL'));
    assert.ok(!isDegradation('GOOD', 'NORMAL_WEAR'));
  });

  it('ne retient pas une amélioration ni un état identique', () => {
    assert.ok(!isDegradation('MAUVAIS_ETAT', 'BON'));
    assert.ok(!isDegradation('HORS_SERVICE', 'HORS_SERVICE'));
    assert.ok(!isDegradation('DEGRADED', 'MAUVAIS_ETAT')); // même rang
  });

  it('un état déjà dégradé à l’entrée n’est pas imputé à la sortie', () => {
    // Règle clé : le locataire ne paie pas ce qui était déjà abîmé.
    assert.ok(!isDegradation('MAUVAIS_ETAT', 'MAUVAIS_ETAT'));
    assert.ok(isDegradation('MAUVAIS_ETAT', 'HORS_SERVICE')); // aggravation réelle
  });
});

describe('câblage du module EDL', () => {
  const root = path.join(__dirname, '..');

  it('la comparaison utilise bien l’échelle normalisée', () => {
    const src = fs.readFileSync(
      path.join(root, 'app/api/inspections/[id]/compare/route.ts'),
      'utf8',
    );
    assert.match(src, /CONDITION_RANK/);
    assert.match(src, /MAUVAIS_ETAT/);
    assert.match(src, /HORS_SERVICE/);
    // l'ancienne condition en dur ne doit plus exister
    assert.ok(!src.includes("exitVal === 'DEGRADED' || exitVal === 'NEEDS_RENOVATION'"));
  });

  it('les routes EDL sont gatées par le flag (helper enfin câblé)', () => {
    for (const rel of [
      'app/api/inspections/route.ts',
      'app/api/inspections/[id]/route.ts',
      'app/api/inspections/[id]/photos/route.ts',
      'app/api/inspections/[id]/compare/route.ts',
      'app/api/inspections/[id]/pdf/route.ts',
    ]) {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      assert.match(src, /withFeatureGuard\('EDL'/, `${rel} doit être gaté`);
    }
  });

  it('le wizard EDL revient sur le bon onglet du dashboard', () => {
    const src = fs.readFileSync(
      path.join(root, 'app/(platform)/dashboard/owner/edl/[id]/EdlWizardClient.tsx'),
      'utf8',
    );
    assert.ok(!src.includes('?page=edl'), 'le dashboard lit ?tab=, pas ?page=');
    assert.match(src, /\?tab=edl/);
  });

  it('les miniatures de photo lisent la bonne clé de réponse', () => {
    const src = fs.readFileSync(
      path.join(root, 'app/(platform)/dashboard/owner/edl/[id]/components/PhotoCapture.tsx'),
      'utf8',
    );
    // la route renvoie { success, data: { url } }
    assert.match(src, /data\?\.data\?\.url/);
  });
});

describe('PDF EDL : migration WeasyPrint (photos + signatures)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'lib/services/inspectionPdfService.ts'),
    'utf8',
  );

  it('utilise le renderer partagé, plus PDFKit', () => {
    assert.match(src, /renderHtmlToPdf/);
    assert.ok(!src.includes("require('pdfkit')"), 'PDFKit ne doit plus être chargé');
  });

  it('embarque les photos, confinées au dossier de CET état des lieux', () => {
    assert.match(src, /safePhotoSrc/);
    // le chemin doit contenir l'id de l'inspection (pas de photo d'un autre EDL)
    assert.match(src, /uploads\/edl\/\$\{inspectionId\}/);
    assert.match(src, /fs\.existsSync/);
  });

  it('appose les signatures réelles (data-URL strictement validé)', () => {
    // l'ancien générateur imprimait « ____ » alors que les images existaient
    assert.match(src, /SAFE_DATA_IMAGE = \/\^data:image\\\/\(png\|jpeg\);base64,/);
    assert.match(src, /SAFE_DATA_IMAGE\.test\(String\(sig\.data\)\)/);
  });

  it('chiffre les retenues sur dépôt dans le PDF de sortie', () => {
    assert.match(src, /Retenues sur dépôt de garantie/);
    assert.match(src, /totalRetention/);
    assert.match(src, /refundAmount/);
  });

  it('échappe toutes les données utilisateur (anti-injection WeasyPrint)', () => {
    // noms de pièces, commentaires, légendes, clés : tout passe par esc()
    for (const call of ['esc(room.name)', 'esc(room.comment)', 'esc(ph.caption', 'esc(k.type)', 'esc(eq.name)', 'esc(ownerName)', 'esc(tenantName)']) {
      assert.ok(src.includes(call), `${call} manquant`);
    }
  });

  it('conserve les mentions légales (ALUR art. 3-2, décret 2016-382)', () => {
    assert.match(src, /2016-382/);
    assert.match(src, /10 jours calendaires/);
  });
});
