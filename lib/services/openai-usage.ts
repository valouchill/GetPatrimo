/**
 * OpenAI usage tracking service.
 * Logs token usage per user per month and alerts when thresholds are exceeded.
 */

import { logger } from '@/lib/server-logger';

// In-memory monthly tracking (persists per-process, resets on restart).
// For production at scale, move to MongoDB or Redis.
const usageByUser = new Map<string, { tokens: number; cost: number; calls: number; resetAt: number }>();

// GPT-4o pricing (as of 2025): $2.50/1M input, $10/1M output
const PRICING = {
  'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
} as Record<string, { input: number; output: number }>;

const MONTHLY_COST_ALERT = Number(process.env.OPENAI_MONTHLY_COST_ALERT || 50); // $50 default
const MONTHLY_COST_LIMIT = Number(process.env.OPENAI_MONTHLY_COST_LIMIT || 200); // $200 hard limit

function getMonthKey(): number {
  const now = new Date();
  return now.getFullYear() * 100 + now.getMonth(); // e.g. 202604
}

export function trackUsage(
  userId: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
) {
  const pricing = PRICING[model] || PRICING['gpt-4o'];
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  const totalTokens = usage.total_tokens || inputTokens + outputTokens;
  const cost = inputTokens * pricing.input + outputTokens * pricing.output;

  const monthKey = getMonthKey();
  const key = `${userId}:${monthKey}`;
  const entry = usageByUser.get(key);

  if (!entry || entry.resetAt !== monthKey) {
    usageByUser.set(key, { tokens: totalTokens, cost, calls: 1, resetAt: monthKey });
  } else {
    entry.tokens += totalTokens;
    entry.cost += cost;
    entry.calls += 1;
  }

  const current = usageByUser.get(key)!;

  logger.info('[openai-usage] Token usage tracked', {
    userId,
    model,
    tokens: totalTokens,
    callCost: cost.toFixed(4),
    monthlyCost: current.cost.toFixed(2),
    monthlyCalls: current.calls,
  });

  if (current.cost >= MONTHLY_COST_ALERT && current.cost - cost < MONTHLY_COST_ALERT) {
    logger.warn('[openai-usage] Monthly cost alert threshold reached', {
      userId,
      monthlyCost: current.cost.toFixed(2),
      threshold: MONTHLY_COST_ALERT,
    });
  }

  return current;
}

export function checkUserLimit(userId: string): { allowed: boolean; monthlyCost: number } {
  const monthKey = getMonthKey();
  const key = `${userId}:${monthKey}`;
  const entry = usageByUser.get(key);

  if (!entry || entry.resetAt !== monthKey) {
    return { allowed: true, monthlyCost: 0 };
  }

  return {
    allowed: entry.cost < MONTHLY_COST_LIMIT,
    monthlyCost: entry.cost,
  };
}
