/**
 * Simple in-memory rate limiter for Next.js API routes.
 * Uses a sliding window per IP address.
 */

const ipHits = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipHits) {
    if (entry.resetAt < now) ipHits.delete(ip);
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  ip: string,
  { windowMs = 60_000, max = 5 }: { windowMs?: number; max?: number } = {}
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = ip;
  const entry = ipHits.get(key);

  if (!entry || entry.resetAt < now) {
    ipHits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: max - entry.count };
}
