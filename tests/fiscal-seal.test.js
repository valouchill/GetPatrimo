const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isFiscalSealEnabled,
  dataUrlToBuffer,
  runSealWrapper,
  crossCheckFiscalSeal,
  analyzeFiscalSeal,
} = require('../src/services/fiscalSealService');

// 2D-Doc d'avis d'imposition SPÉCIMEN (vecteur de test de betagouv/2ddoc-parser).
const SPECIMEN_2DDOC =
  'DC04FR000001000F23DC2801FR432,75<GS>44227801234567845202146RETI PATRICK<GS>4A310720224Y145 RUE JULLIARD/ZASPECIMEN/78320/LEVIS STNOM<GS>4163198<GS>47300112345678948RETISOPHIE<GS>4907019877654324V3542<GS>4W182<GS>4X3724<GS><US>6W76EBC3I2LWHBVGNNYTL34SC6V32S2GDCIQQZLZNMTKCHNVEUISJYUQH5WE3AJJICBNG3YMQ2NXXHP5ZHVOQE332R6TUJDHNOHQ6BI';

/* ─── Recoupement scellé ↔ OCR (logique pure, déterministe) ─── */

test('crossCheckFiscalSeal confirms matching sealed vs OCR values', () => {
  const seal = { rfr: 35334, numeroFiscal: '3012534769188', referenceAvis: '2375036155182' };
  const ocr = { rfr: 35334, numeroFiscal: '30 12 534 769 188', referenceAvis: '23 75 0361551 82' };
  const r = crossCheckFiscalSeal(seal, ocr);
  assert.equal(r.anyMismatch, false);
  assert.equal(r.confirmations.length, 3);
  assert.ok(r.confirmations.includes('rfr'));
});

test('crossCheckFiscalSeal flags an altered RFR (sealed ≠ OCR = fraude)', () => {
  // Le sceau porte le vrai RFR (35334) ; l'OCR lit un RFR gonflé au Photoshop (50000).
  const r = crossCheckFiscalSeal(
    { rfr: 35334, numeroFiscal: '3012534769188' },
    { rfr: 50000, numeroFiscal: '3012534769188' },
  );
  assert.equal(r.anyMismatch, true);
  assert.ok(r.mismatches.includes('rfr'));
  assert.ok(r.confirmations.includes('numeroFiscal'));
});

test('crossCheckFiscalSeal ignores fields missing on either side', () => {
  const r = crossCheckFiscalSeal({ rfr: 35334 }, { numeroFiscal: '3012534769188' });
  assert.equal(r.checks.length, 0);
  assert.equal(r.anyMismatch, false);
  assert.equal(r.anyConfirmation, false);
});

test('dataUrlToBuffer extracts PNG bytes from a data URL', () => {
  const buf = dataUrlToBuffer('data:image/png;base64,iVBORw0KGgo=');
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.slice(0, 4).toString('latin1'), '\x89PNG');
  assert.equal(dataUrlToBuffer('pas une data url'), null);
});

/* ─── Gate + no-op désactivé ─── */

test('isFiscalSealEnabled + analyzeFiscalSeal no-op when disabled', async () => {
  const save = process.env.FISCAL_SEAL_VERIFICATION_ENABLED;
  try {
    delete process.env.FISCAL_SEAL_VERIFICATION_ENABLED;
    assert.equal(isFiscalSealEnabled(), false);
    const r = await analyzeFiscalSeal({ images: ['data:image/png;base64,xx'], ocr: { rfr: 1 } });
    assert.equal(r, null);
    process.env.FISCAL_SEAL_VERIFICATION_ENABLED = 'true';
    assert.equal(isFiscalSealEnabled(), true);
  } finally {
    if (save === undefined) delete process.env.FISCAL_SEAL_VERIFICATION_ENABLED;
    else process.env.FISCAL_SEAL_VERIFICATION_ENABLED = save;
  }
});

/* ─── Bout-en-bout : image DataMatrix → wrapper Python (décodage libdmtx + vérif).
 *     Saute proprement si les dépendances Python (libdmtx/pylibdmtx/fr_2ddoc_parser)
 *     ne sont pas installées dans l'environnement de test. ─── */

test('runSealWrapper decodes + verifies a 2D-Doc image end-to-end', async (t) => {
  let png;
  try {
     
    const bwipjs = require('bwip-js');
    png = await bwipjs.toBuffer({ bcid: 'datamatrix', text: SPECIMEN_2DDOC, scale: 4, padding: 8 });
  } catch {
    t.skip('bwip-js indisponible');
    return;
  }
  const seal = await runSealWrapper(png);
  if (!seal) {
    t.skip('dépendances Python (libdmtx/pylibdmtx/fr_2ddoc_parser) absentes — décode+vérif non testés ici');
    return;
  }
  assert.equal(seal.decodedFrom, 'image');
  assert.equal(seal.docType, '28');
  assert.equal(seal.rfr, 63198);
  assert.match(String(seal.declarant1), /RETI PATRICK/);
  assert.equal(seal.algHint, 'P-256');
  assert.equal(typeof seal.signatureValid, 'boolean');
});
