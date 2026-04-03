/**
 * Pagination helper for API routes.
 * Extracts limit/skip from URL search params with safe defaults.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function getPagination(url: URL): { limit: number; skip: number } {
  const rawLimit = Number(url.searchParams.get('limit')) || DEFAULT_LIMIT;
  const rawSkip = Number(url.searchParams.get('skip')) || 0;

  return {
    limit: Math.min(Math.max(1, rawLimit), MAX_LIMIT),
    skip: Math.max(0, rawSkip),
  };
}
