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
  _internals: { DEFAULT_TIMEOUT_MS, DEFAULT_MAX_ATTEMPTS, isRetryableStatus, isRetryableNetworkError },
};
