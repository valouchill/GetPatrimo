import 'server-only';
import { PostHog } from 'posthog-node';

/**
 * posthog-server — capture serveur des événements funnel (Sprint 1.A / Tâche 2).
 *
 * Fire-and-forget : ne JAMAIS casser un flux métier (auth, analyse, webhook) si
 * l'analytics échoue. No-op si la clé n'est pas configurée (feature inerte).
 *
 * distinctId = userId → stitch avec l'`identify(userId)` côté client (PostHogProvider),
 * pour que le funnel anonyme → connu soit cohérent.
 *
 * Clé lue au RUNTIME (via .env), pas besoin d'être en NEXT_PUBLIC pour le serveur.
 */

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key =
    process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_KEY || '';
  if (!key) {
    client = null;
    return null;
  }
  client = new PostHog(key, {
    host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ||
      process.env.POSTHOG_HOST ||
      'https://eu.i.posthog.com',
    flushAt: 1,
    flushInterval: 3000,
  });
  return client;
}

export function captureServer(
  event: string,
  distinctId: string | null | undefined,
  properties?: Record<string, unknown>,
): void {
  try {
    const c = getClient();
    if (!c || !distinctId) return;
    c.capture({ distinctId: String(distinctId), event, properties });
  } catch {
    /* fire-and-forget */
  }
}
