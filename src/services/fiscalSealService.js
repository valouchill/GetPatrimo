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
 * Gated par FISCAL_SEAL_VERIFICATION_ENABLED. Fire-and-forget : ne lève jamais.
 * Distingue désormais une panne d'infra (Python/déps absents, script planté, timeout)
 * de l'absence de sceau : les pannes sont LOGGUÉES et signalées
 * (analyzeFiscalSeal → { unavailable:true }) au lieu d'être avalées en silence,
 * ce qui désactivait l'anti-fraude sans alerte (audit V1 — A7).
 *
 * Dépendances runtime (PROD) : Python + système libdmtx0 + pip pylibdmtx, Pillow,
 * fr_2ddoc_parser (+ pydantic, cryptography). Requires RELATIFS (convention du repo).
 */

const path = require('path');
const { spawn } = require('child_process');
const { logger } = require('../../lib/logger');

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
 * Statut structuré de la vérification du sceau.
 * @typedef {'OK'|'NO_SEAL'|'UNAVAILABLE'|'TIMEOUT'|'ERROR'} SealStatus
 */

/**
 * Lance scripts/verify_2ddoc.py avec `input` (Buffer image OU chaîne 2D-Doc) sur stdin.
 * Ne lève jamais. Renvoie un statut STRUCTURÉ afin de ne plus confondre une panne
 * d'infrastructure (Python/libdmtx absents, script planté, timeout) avec « pas de
 * sceau » : ces pannes étaient avalées en silence (resolve(null)), désactivant
 * l'anti-fraude sans aucune alerte (audit V1 — A7). Désormais : logguées + signalées.
 * @returns {Promise<{status: SealStatus, seal: object|null}>}
 */
function runSealWrapperDetailed(input, opts = {}) {
  return new Promise((resolve) => {
    if (input == null || input.length === 0) {
      resolve({ status: 'NO_SEAL', seal: null });
      return;
    }
    const python = opts.pythonBin || process.env.PYTHON_BIN || 'python3';
    const script = opts.scriptPath || path.join(process.cwd(), 'scripts', 'verify_2ddoc.py');
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; resolve(r); } };
    try {
      const child = spawn(python, [script], { timeout: SEAL_TIMEOUT_MS });
      let out = '';
      let errOut = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { errOut += d; }); // capturé pour diagnostic
      child.on('error', (e) => {
        // Le process n'a pas pu démarrer : binaire Python / dépendances absentes.
        logger.error('[fiscalSeal] Python introuvable ou non lançable — vérification du sceau IMPOSSIBLE (déps libdmtx/pylibdmtx/fr_2ddoc_parser ?)', {
          python,
          error: e && e.message ? e.message : String(e),
        });
        finish({ status: 'UNAVAILABLE', seal: null });
      });
      child.on('close', (code, signal) => {
        if (settled) return;
        if (code === null) {
          // Tué par signal — typiquement le timeout de spawn({ timeout }) → SIGTERM.
          logger.warn('[fiscalSeal] script de vérification tué (timeout probable)', { signal, timeoutMs: SEAL_TIMEOUT_MS });
          finish({ status: 'TIMEOUT', seal: null });
          return;
        }
        if (code !== 0) {
          // S23 : ne pas logger le contenu brut (peut contenir des valeurs scellées) — métadonnées seules.
          logger.warn('[fiscalSeal] script de vérification en échec (code de sortie non nul)', { code, stderrBytes: errOut.length });
          finish({ status: 'ERROR', seal: null });
          return;
        }
        try {
          const j = JSON.parse(String(out).trim());
          if (j && j.ok) finish({ status: 'OK', seal: j });
          else finish({ status: 'NO_SEAL', seal: null }); // exécution propre, aucun sceau valide
        } catch {
          // S23 : pas de contenu brut (valeurs 2D-Doc possibles) — tailles seules.
          logger.warn('[fiscalSeal] sortie du script illisible (JSON invalide)', { outBytes: String(out).length, stderrBytes: errOut.length });
          finish({ status: 'ERROR', seal: null });
        }
      });
      child.stdin.on('error', () => {});
      child.stdin.write(input);
      child.stdin.end();
    } catch (e) {
      logger.error('[fiscalSeal] échec lancement de la vérification du sceau', { error: e && e.message ? e.message : String(e) });
      finish({ status: 'ERROR', seal: null });
    }
  });
}

/**
 * Variante legacy : renvoie l'objet sceau si {ok:true}, sinon null. Ne lève jamais.
 * Conserve le contrat historique ; délègue à runSealWrapperDetailed.
 */
async function runSealWrapper(input, opts = {}) {
  const { seal } = await runSealWrapperDetailed(input, opts);
  return seal;
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
      const { status, seal } = await runSealWrapperDetailed(buf);
      if (status === 'OK' && seal) {
        const cross = crossCheckFiscalSeal(seal, ocr);
        return { seal, cross };
      }
      if (status === 'UNAVAILABLE' || status === 'TIMEOUT' || status === 'ERROR') {
        // Panne d'infra (déjà logguée) : inutile d'essayer les autres images, et on
        // REMONTE l'indisponibilité pour que l'orchestrateur la trace (≠ « pas de sceau »).
        return { seal: null, cross: null, unavailable: true, reason: status };
      }
      // status === 'NO_SEAL' → image suivante
    }
    return null;
  } catch (e) {
    logger.error('[fiscalSeal] erreur inattendue dans analyzeFiscalSeal', { error: e && e.message ? e.message : String(e) });
    return { seal: null, cross: null, unavailable: true, reason: 'ERROR' };
  }
}

module.exports = {
  isFiscalSealEnabled,
  dataUrlToBuffer,
  runSealWrapper,
  runSealWrapperDetailed,
  crossCheckFiscalSeal,
  analyzeFiscalSeal,
};
