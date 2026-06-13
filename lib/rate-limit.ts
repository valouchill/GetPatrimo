/**
 * Simple in-memory rate limiter for Next.js API routes.
 * Uses a sliding window per IP address.
 *
 * LIMITATION: In-memory store does not persist across restarts and does not
 * work in multi-instance deployments. For horizontal scaling, migrate to a
 * Redis-backed rate limiter (e.g. rate-limit-redis or ioredis).
 * Acceptable for single-instance deployments.
 */

const ipHits = new Map<string, { count: number; resetAt: number }>();

// Sécurité (audit passe-5) : plafond dur du nombre de clés (défense en profondeur anti-épuisement
// mémoire). Les clés sont désormais l'IP réelle (dernier hop XFF) donc bornées en pratique.
const MAX_ENTRIES = 50_000;

function purgeExpired(now: number) {
  for (const [ip, entry] of ipHits) {
    if (entry.resetAt < now) ipHits.delete(ip);
  }
}

// Cleanup stale entries every 5 minutes
setInterval(() => purgeExpired(Date.now()), 5 * 60 * 1000);

export function checkRateLimit(
  ip: string,
  { windowMs = 60_000, max = 5 }: { windowMs?: number; max?: number } = {}
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = ip;
  const entry = ipHits.get(key);

  if (!entry || entry.resetAt < now) {
    // Plafond mémoire : purge les expirées, et en dernier recours vide le store.
    if (ipHits.size >= MAX_ENTRIES) {
      purgeExpired(now);
      if (ipHits.size >= MAX_ENTRIES) ipHits.clear();
    }
    ipHits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: max - entry.count };
}
