/**
 * V8.3 (audit M2) — Résolution d'un `callbackUrl` interne sûr.
 *
 * Source UNIQUE de vérité pour la garde anti open-redirect des pages d'auth.
 *
 * Le middleware renvoie tout utilisateur non authentifié vers
 * `/auth/login?callbackUrl=<route protégée>`. Après connexion on souhaite
 * honorer cette destination plutôt que de retomber systématiquement sur
 * l'accueil du rôle — MAIS jamais vers une URL externe, un chemin hors
 * périmètre du rôle, ou une boucle vers les pages d'auth.
 *
 * La fonction est pure (pas de dépendance à `window`) pour rester testable :
 * l'appelant lui passe `window.location.search`.
 *
 * @param rawSearch  La query string courante (ex. `window.location.search`).
 * @param role       Le rôle résolu de l'utilisateur (`'tenant'` | `'owner'` | undefined).
 * @returns          Un chemin interne sûr, ou `null` si aucune cible valide.
 */
export function safeCallbackUrl(
  rawSearch: string,
  role: string | undefined,
): string | null {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(rawSearch).get('callbackUrl');
  } catch {
    return null;
  }
  if (!raw) return null;

  // Le paramètre peut arriver encodé (une fois) — on tente un décodage tolérant.
  let cb = raw;
  try {
    cb = decodeURIComponent(raw);
  } catch {
    /* garde la valeur brute si le décodage échoue */
  }
  cb = cb.trim();

  // Chemin interne absolu uniquement : bloque
  //   - URL externe (https://evil.com)
  //   - protocole-relatif (//evil.com)
  //   - échappement backslash (/\evil.com, que certains navigateurs traitent comme //)
  //   - toute boucle vers les pages d'auth (/auth/login, /auth/register…)
  if (
    !cb.startsWith('/') ||
    cb.startsWith('//') ||
    cb.startsWith('/\\') ||
    cb.includes('\\') ||
    cb.startsWith('/auth')
  ) {
    return null;
  }

  // Garde de périmètre par rôle : on évite d'envoyer un locataire sur
  // l'espace bailleur (et inversement). Hors périmètre → accueil du rôle.
  const ownerScoped = cb.startsWith('/dashboard/owner');
  const tenantScoped =
    cb.startsWith('/dashboard/tenant') || cb.startsWith('/apply');
  if (role === 'tenant' && ownerScoped) return null;
  if (role !== 'tenant' && tenantScoped) return null;

  return cb;
}
