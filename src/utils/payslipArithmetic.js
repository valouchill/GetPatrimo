/**
 * Contrôle arithmétique DÉTERMINISTE d'un bulletin de salaire : Brut − Cotisations = Net.
 *
 * Pourquoi côté serveur : le contrôle était demandé au modèle dans le prompt
 * (« si diff > 0,50 € → math_validation: false »), et sa réponse était reprise
 * telle quelle. Or le document analysé est une surface NON FIABLE : un bulletin
 * falsifié — ou porteur d'instructions embarquées — peut affirmer sa propre
 * cohérence. Un calcul est vérifiable : on le refait ici, et la conclusion du
 * serveur PRIME toujours sur celle du modèle.
 *
 * Tolérance : l'écart doit dépasser 0,50 € ET 2 % du brut. Le garde-fou des 2 %
 * absorbe le cas fréquent où l'OCR capte le « net imposable » au lieu du « net à
 * payer » (écart structurel de quelques dizaines d'euros) — sans lui, des
 * bulletins parfaitement authentiques seraient signalés comme frauduleux, ce qui
 * est le pire résultat possible pour un produit vendu sur la confiance.
 */

const MIN_ABSOLUTE_TOLERANCE = 0.5;
const RELATIVE_TOLERANCE = 0.02; // 2 % du brut
/** Pénalité appliquée au score de fraude quand le calcul ne tombe pas juste. */
const FRAUD_SCORE_PENALTY = 30;

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  // Piège : Number('') === 0 — une donnée MANQUANTE serait lue comme un zéro et
  // ferait échouer le calcul sur un bulletin parfaitement authentique.
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Recalcule la cohérence Brut − Cotisations = Net.
 * @returns {{checked: boolean, coherent: boolean, diff: number, tolerance: number}}
 *   `checked: false` si les trois montants ne sont pas tous disponibles (on ne
 *   conclut jamais sur une donnée manquante — un doute n'est pas une fraude).
 */
function verifyPayslipArithmetic({ gross, deductions, net }) {
  const g = toNumber(gross);
  const d = toNumber(deductions);
  const n = toNumber(net);

  if (g === null || d === null || n === null || g <= 0) {
    return { checked: false, coherent: true, diff: 0, tolerance: 0 };
  }

  const diff = Math.abs(g - d - n);
  const tolerance = Math.max(MIN_ABSOLUTE_TOLERANCE, g * RELATIVE_TOLERANCE);
  return { checked: true, coherent: diff <= tolerance, diff, tolerance };
}

/**
 * Applique le verdict serveur sur un bloc `trust_and_security`, en place.
 *
 * Règle asymétrique volontaire : un calcul incohérent DÉGRADE toujours (le
 * serveur écrase un `math_validation: true` menteur et alourdit le score) ; un
 * calcul cohérent ne fait jamais BAISSER le score de fraude — sinon un document
 * n'aurait qu'à présenter trois nombres qui tombent juste pour se blanchir des
 * autres signaux forensiques (métadonnées, retouche, génération IA).
 *
 * @returns {boolean} true si une incohérence a été détectée et sanctionnée
 */
function applyPayslipArithmeticVerdict(trust, { gross, deductions, net }) {
  if (!trust) return false;
  const result = verifyPayslipArithmetic({ gross, deductions, net });
  if (!result.checked) return false;

  if (!Array.isArray(trust.forensic_alerts)) trust.forensic_alerts = [];

  if (!result.coherent) {
    trust.math_validation = false;
    trust.fraud_score = Math.min(100, Number(trust.fraud_score || 0) + FRAUD_SCORE_PENALTY);
    trust.forensic_alerts.push(
      `Écart de ${result.diff.toFixed(2).replace('.', ',')} € entre Brut - Cotisations et Net `
      + `(tolérance ${result.tolerance.toFixed(2).replace('.', ',')} €) — contrôle serveur.`,
    );
    return true;
  }

  // Cohérent : on confirme uniquement si le modèle n'a rien dit.
  if (trust.math_validation === undefined) trust.math_validation = true;
  return false;
}

module.exports = {
  verifyPayslipArithmetic,
  applyPayslipArithmeticVerdict,
  _internals: { MIN_ABSOLUTE_TOLERANCE, RELATIVE_TOLERANCE, FRAUD_SCORE_PENALTY },
};
