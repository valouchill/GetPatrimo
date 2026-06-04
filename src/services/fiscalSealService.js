/**
 * Module C — Vérification du sceau 2D-Doc (avis d'imposition, Visale…).
 *
 * Chaîne : image (data URL) → script Python `scripts/verify_2ddoc.py` qui DÉCODE le
 * DataMatrix (libdmtx) PUIS VÉRIFIE la signature via la lib MIT `fr_2ddoc_parser`
 * (betagouv/2ddoc-parser), laquelle embarque la liste de confiance officielle de
 * l'ANTS (tsl_signed.xml) → vérif ECDSA HORS-LIGNE, sans l'API ANTS. On RECOUPE
 * ensuite les valeurs SCELLÉES (RFR, n° fiscal, référence) avec l'OCR (Module B) :
 * un document édité garde un sceau aux vraies valeurs → divergence détectée.
 *
 * Pourquoi le décodage est en Python : aucun décodeur DataMatrix JS fiable
 * (@zxing/library échoue, zbar ne gère pas le DataMatrix) ; libdmtx est la
 * référence. On consolide donc décodage + vérif côté Python.
 *
 * Gated par FISCAL_SEAL_VERIFICATION_ENABLED. Fire-and-forget : ne lève jamais ;
 * renvoie null si désactivé / dépendances absentes / pas de sceau / erreur.
 *
 * Dépendances runtime (PROD) : Python + système libdmtx0 + pip pylibdmtx, Pillow,
 * fr_2ddoc_parser (+ pydantic, cryptography). Requires RELATIFS (convention du repo).
 */

const path = require('path');
const { spawn } = require('child_process');

const SEAL_TIMEOUT_MS = Number(process.env.FISCAL_SEAL_TIMEOUT_MS || 12000);

function isFiscalSealEnabled() {
  return process.env.FISCAL_SEAL_VERIFICATION_ENABLED === 'true';
}

/** "data:image/png;base64,XXXX" → Buffer (octets image), ou null. */
function dataUrlToBuffer(dataUrl) {
  const m = /^data:[^;]+;base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!m) return null;
  try {
    return Buffer.from(m[1], 'base64');
  } catch {
    return null;
  }
}

/**
 * Lance scripts/verify_2ddoc.py avec `input` (Buffer image OU chaîne 2D-Doc) sur stdin.
 * Renvoie l'objet sceau (JSON) si {ok:true}, sinon null. Ne lève jamais.
 */
function runSealWrapper(input, opts = {}) {
  return new Promise((resolve) => {
    if (input == null || input.length === 0) {
      resolve(null);
      return;
    }
    try {
      const python = opts.pythonBin || process.env.PYTHON_BIN || 'python3';
      const script = opts.scriptPath || path.join(process.cwd(), 'scripts', 'verify_2ddoc.py');
      const child = spawn(python, [script], { timeout: SEAL_TIMEOUT_MS });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', () => {}); // warnings de la lib ignorés
      child.on('error', () => resolve(null));
      child.on('close', () => {
        try {
          const j = JSON.parse(String(out).trim());
          resolve(j && j.ok ? j : null);
        } catch {
          resolve(null);
        }
      });
      child.stdin.on('error', () => {});
      child.stdin.write(input);
      child.stdin.end();
    } catch {
      resolve(null);
    }
  });
}

/* ─────────────────────────────  Recoupement scellé ↔ OCR (pur)  ───────────────────────────── */

const onlyDigits = (s) => String(s == null ? '' : s).replace(/\D/g, '');

/**
 * Recoupe les valeurs SCELLÉES (sceau) avec les valeurs OCR (Module B).
 * @returns {{ checks:Array, mismatches:string[], confirmations:string[], anyMismatch:boolean, anyConfirmation:boolean }}
 */
function crossCheckFiscalSeal(seal = {}, ocr = {}) {
  const checks = [];
  const mismatches = [];
  const confirmations = [];

  const cmpNum = (field, a, b) => {
    if (a == null || b == null || a === '' || b === '') return;
    const na = Math.round(Number(a));
    const nb = Math.round(Number(b));
    if (!Number.isFinite(na) || !Number.isFinite(nb)) return;
    const ok = na === nb;
    checks.push({ field, sealed: na, ocr: nb, ok });
    (ok ? confirmations : mismatches).push(field);
  };
  const cmpDigits = (field, a, b) => {
    const da = onlyDigits(a);
    const db = onlyDigits(b);
    if (!da || !db) return;
    const ok = da === db;
    checks.push({ field, sealed: da, ocr: db, ok });
    (ok ? confirmations : mismatches).push(field);
  };

  cmpNum('rfr', seal.rfr, ocr.rfr);
  cmpDigits('numeroFiscal', seal.numeroFiscal, ocr.numeroFiscal);
  cmpDigits('referenceAvis', seal.referenceAvis, ocr.referenceAvis);

  return {
    checks,
    mismatches,
    confirmations,
    anyMismatch: mismatches.length > 0,
    anyConfirmation: confirmations.length > 0,
  };
}

/* ─────────────────────────────  Orchestration  ───────────────────────────── */

/**
 * Décode + vérifie le sceau fiscal depuis les images, puis recoupe avec l'OCR.
 * @param {{images?:string[], ocr?:object}} input
 * @returns {Promise<{seal:object, cross:object}|null>}
 */
async function analyzeFiscalSeal({ images = [], ocr = {} } = {}) {
  if (!isFiscalSealEnabled()) return null;
  try {
    for (const img of images) {
      const buf = dataUrlToBuffer(img);
      if (!buf) continue;
      const seal = await runSealWrapper(buf);
      if (!seal) continue;
      const cross = crossCheckFiscalSeal(seal, ocr);
      return { seal, cross };
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  isFiscalSealEnabled,
  dataUrlToBuffer,
  runSealWrapper,
  crossCheckFiscalSeal,
  analyzeFiscalSeal,
};
