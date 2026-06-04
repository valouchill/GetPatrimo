/**
 * api-cost-logger — enregistre le coût RÉEL de chaque appel API payant
 * dans la collection ApiCostLog (alimente le Cockpit SuperAdmin).
 *
 * GARANTIE : « fire-and-forget ». Toute erreur est avalée — logger un coût ne
 * doit JAMAIS interrompre l'analyse d'un dossier ni un parcours utilisateur.
 * Les appelants n'attendent PAS la promesse (pas de latence ajoutée). Le
 * conteneur étant long-vivant (pas serverless), l'insert se termine bien.
 *
 * Requires RELATIFS (les services JS du repo n'utilisent pas l'alias @/).
 */

// Tarifs OpenAI (USD / token) — alignés sur lib/services/openai-usage.ts.
const PRICING_USD = {
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
};
const USD_TO_EUR = 0.92;

// Coûts forfaitaires (EUR) — contractuels, pas de tokens.
const FLAT_COST_EUR = {
  diditKyc: 0.45, // vérification biométrique eIDAS
  brevoMail: 0.0008, // email transactionnel
};

function getApiCostLogModel() {
  // require paresseux : évite les cycles + ne charge mongoose qu'au besoin.
   
  return require('../../models/ApiCostLog');
}

/**
 * Coût d'un appel LLM, calculé depuis le `usage` renvoyé par OpenAI.
 * Fire-and-forget : ne PAS await côté appelant.
 */
async function recordLlmCost({ model, usage, userId, applicationId, category, meta } = {}) {
  try {
    const m = String(model || 'gpt-4o');
    const pricing = PRICING_USD[m] || PRICING_USD['gpt-4o'];
    const inputTokens = Number(usage && usage.prompt_tokens) || 0;
    const outputTokens = Number(usage && usage.completion_tokens) || 0;
    const costUsd = inputTokens * pricing.input + outputTokens * pricing.output;
    const costEur = costUsd * USD_TO_EUR;

    await getApiCostLogModel().create({
      provider: 'OpenAI',
      category: category || 'LLM',
      model: m,
      costEur,
      inputTokens,
      outputTokens,
      units: 1,
      userId: userId || '',
      applicationId: applicationId || '',
      meta: meta || {},
    });
  } catch (err) {
    // fire-and-forget : on n'interrompt jamais l'analyse.
    try {
       
      require('../../lib/server-logger').logger.warn('[api-cost-logger] LLM cost log failed', {
        error: err instanceof Error ? err.message : err,
      });
    } catch (_) {
      /* noop */
    }
  }
}

/**
 * Coût forfaitaire (Didit KYC, email Brevo, frais Stripe…).
 * Fire-and-forget : ne PAS await côté appelant.
 */
async function recordFlatCost({ provider, category, costEur, units, model, userId, applicationId, meta } = {}) {
  try {
    await getApiCostLogModel().create({
      provider: provider || 'Unknown',
      category: category || 'Other',
      model: model || '',
      costEur: Number(costEur) || 0,
      units: Number(units) || 1,
      userId: userId || '',
      applicationId: applicationId || '',
      meta: meta || {},
    });
  } catch (err) {
    try {
       
      require('../../lib/server-logger').logger.warn('[api-cost-logger] Flat cost log failed', {
        error: err instanceof Error ? err.message : err,
      });
    } catch (_) {
      /* noop */
    }
  }
}

module.exports = {
  recordLlmCost,
  recordFlatCost,
  PRICING_USD,
  USD_TO_EUR,
  FLAT_COST_EUR,
};
