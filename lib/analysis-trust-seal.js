/**
 * Sceau HMAC serveur-autoritaire des signaux de confiance d'une analyse de document.
 *
 * Sécurité (audit passe-5 — C1, CRITICAL) : le tunnel candidat renvoie au serveur l'`aiAnalysis`
 * qu'il a reçue de /api/analyze-document-v2, puis `saveApplicationProgress` s'en sert pour le
 * scoring (revenu, sceau Visale, statut CERTIFIED). Sans garde, un candidat pouvait fabriquer
 * `financial_data` / `trust_and_security` et gonfler son score, ses revenus certifiés et son
 * sceau Visale — c.-à-d. forger les signaux anti-fraude que le produit vend aux bailleurs.
 *
 * Parade : au moment de l'analyse, le serveur SIGNE (HMAC-SHA256, secret serveur) les deux
 * objets qui portent les signaux de confiance et joint le sceau dans `aiAnalysis._trustSig`.
 * À la sauvegarde, seul un document dont le sceau est VALIDE voit ses signaux pris en compte ;
 * sinon ils sont NEUTRALISÉS (revenu 0, pas de sceau, statut non-certifié). Le client ne peut
 * pas forger le sceau (il n'a pas le secret), et l'agrégation des bulletins (moyenne/médiane)
 * rend la duplication d'un document scellé inoffensive.
 */
const crypto = require('crypto');

/** JSON déterministe (clés triées récursivement) — sceau indépendant de l'ordre des clés. */
function stableStringify(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

/** Cœur scellé : les DEUX objets qui portent les signaux de confiance (revenu, sceau, fraude). */
function canonicalAnalysisCore(src) {
  const a = src || {};
  return stableStringify({
    v: 1,
    financial_data: a.financial_data || {},
    trust_and_security: a.trust_and_security || {},
  });
}

function analysisSealSecret() {
  return process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
}

/** Signe une analyse (objet portant financial_data + trust_and_security). Retourne le hex HMAC ('' si pas de secret). */
function signAnalysisTrust(src) {
  const secret = analysisSealSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(canonicalAnalysisCore(src)).digest('hex');
}

/** Vérifie le sceau `_trustSig` d'une aiAnalysis. true SSI présent, secret dispo et concordant. */
function verifyAnalysisTrust(aiAnalysis) {
  const a = aiAnalysis || {};
  const sig = a._trustSig;
  if (!analysisSealSecret() || !sig || typeof sig !== 'string') return false;
  const expected = signAnalysisTrust(a);
  if (!expected) return false;
  const x = Buffer.from(sig);
  const y = Buffer.from(expected);
  if (x.length !== y.length) return false;
  try {
    return crypto.timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

/**
 * Neutralise les signaux de confiance d'un document non scellé / falsifié : aucun revenu,
 * aucun sceau. NEUTRE (ne pénalise pas — on ne distingue pas un legacy d'un falsifié) : le
 * document reste pour l'affichage mais ne pèse plus dans le scoring. Statut CERTIFIED rétrogradé.
 */
function neutralizeUntrustedDocument(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const ai = doc.aiAnalysis && typeof doc.aiAnalysis === 'object' ? doc.aiAnalysis : {};
  ai.financial_data = {};
  ai.trust_and_security = {};
  doc.aiAnalysis = ai;
  if (doc.status === 'CERTIFIED') doc.status = 'NEEDS_REVIEW';
  return doc;
}

module.exports = {
  stableStringify,
  canonicalAnalysisCore,
  signAnalysisTrust,
  verifyAnalysisTrust,
  neutralizeUntrustedDocument,
};
