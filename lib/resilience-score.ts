export type ResilienceLevel = 'PLATINUM' | 'GOLD' | 'SILVER' | 'ALERTE';
export type ResilienceSource = 'v2' | 'legacy';

export interface ResolvedResilienceScore {
  score: number;
  level: ResilienceLevel;
  label: string;
  scoreLabel: string;
  source: ResilienceSource;
  isV2: boolean;
  cachedAt: string | null;
}

type ResolverModule = {
  resolveResilienceScore: (input: unknown) => ResolvedResilienceScore;
  levelFromScore: (score: unknown) => ResilienceLevel;
  clampScore: (score: unknown) => number | null;
  LEVEL_LABELS: Record<ResilienceLevel, string>;
};

// Shared CommonJS resolver used by server utilities and client components.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const resolver = require('@/src/utils/resilienceScore') as ResolverModule;

export const LEVEL_LABELS = resolver.LEVEL_LABELS;
export const clampScore = resolver.clampScore;
export const levelFromScore = resolver.levelFromScore;
export const resolveResilienceScore = resolver.resolveResilienceScore;
