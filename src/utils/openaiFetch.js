/**
 * Appel OpenAI avec TIMEOUT et RETRY — client partagé.
 *
 * `fetch` (Node 18+) n'a AUCUN timeout par défaut : une connexion qui reste
 * pendue immobilise la requête indéfiniment. Sur le chemin de l'audit de dossier
 * — le produit payant —, cela signifiait un utilisateur bloqué sans réponse ni
 * message, et une connexion serveur retenue.
 *
 * Politique : timeout dur par tentative, et retry uniquement sur ce qui est
 * réessayable (429 quota, 5xx, coupure réseau). Une erreur 4xx métier (clé
 * invalide, requête malformée) n'est jamais réessayée — cela ne ferait que
 * retarder l'échec.
 */

/**
 * ROUTAGE UE — Azure OpenAI.
 *
 * Les appels partent par défaut vers api.openai.com, donc hors Union
 * européenne, alors que des bulletins de salaire et des avis d'imposition y
 * transitent. C'est incompatible avec l'hébergement européen annoncé, et c'est
 * la première question que pose le DPO d'un assureur.
 *
 * Dès que ces trois variables existent, TOUT le trafic bascule vers une
 * ressource Azure OpenAI en région française/européenne, sans autre changement
 * de code :
 *   AZURE_OPENAI_ENDPOINT    ex. https://patrimo.openai.azure.com
 *   AZURE_OPENAI_KEY
 *   AZURE_OPENAI_DEPLOYMENT  nom du déploiement (ex. gpt-4o)
 * Absentes → comportement inchangé. Aucun risque à déployer avant de les créer.
 */
function azureRoute(url, options) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const key = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !key || !deployment) return null;
  if (!String(url).includes('api.openai.com')) return null;

  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
  const base = String(endpoint).replace(/\/$/, '');
  const path = String(url).includes('/chat/completions') ? 'chat/completions' : 'chat/completions';

  // Azure attend `api-key` et non `Authorization: Bearer`.
  const headers = { ...(options.headers || {}) };
  delete headers.Authorization;
  delete headers.authorization;
  headers['api-key'] = key;

  return {
    url: `${base}/openai/deployments/${deployment}/${path}?api-version=${apiVersion}`,
    options: { ...options, headers },
  };
}

/** L'inférence part-elle bien d'une région européenne ? (supervision/DPA) */
function isEuInferenceConfigured() {
  return Boolean(
    process.env.AZURE_OPENAI_ENDPOINT
    && process.env.AZURE_OPENAI_KEY
    && process.env.AZURE_OPENAI_DEPLOYMENT,
  );
}

const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_MAX_ATTEMPTS = 2;

/** Statuts HTTP qu'il vaut la peine de réessayer. */
function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status < 600);
}

/** Erreurs réseau transitoires. */
function isRetryableNetworkError(error) {
  const code = String(error?.cause?.code || error?.code || '');
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'UND_ERR_SOCKET'].includes(code);
}

/**
 * POST vers l'API OpenAI, borné dans le temps.
 * @param {string} url
 * @param {object} options - options fetch (headers, body…)
 * @param {{timeoutMs?: number, maxAttempts?: number, label?: string}} [config]
 * @returns {Promise<Response>}
 * @throws {Error} `OpenAI timeout` si la limite de temps est atteinte
 */
async function openaiFetch(url, options = {}, config = {}) {
  // Bascule UE transparente si Azure OpenAI est configuré.
  const routed = azureRoute(url, options);
  if (routed) {
    url = routed.url;
    options = routed.options;
  }
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxAttempts = config.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const label = config.label || 'openai';

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (isRetryableStatus(response.status) && attempt < maxAttempts) {
        // On consomme le corps pour libérer la connexion avant de réessayer.
        await response.text().catch(() => {});
        lastError = new Error(`${label}: HTTP ${response.status}`);
        await new Promise((r) => setTimeout(r, 600 * attempt));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timer);
      if (error?.name === 'AbortError') {
        lastError = new Error(`${label}: délai dépassé (${timeoutMs} ms)`);
      } else {
        lastError = error;
      }
      const retryable = error?.name === 'AbortError' || isRetryableNetworkError(error);
      if (!retryable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastError;
}

module.exports = {
  openaiFetch,
  isEuInferenceConfigured,
  _internals: { DEFAULT_TIMEOUT_MS, DEFAULT_MAX_ATTEMPTS, isRetryableStatus, isRetryableNetworkError, azureRoute },
};
