const LEVEL_LABELS = {
  PLATINUM: 'Platinum',
  GOLD: 'Gold',
  SILVER: 'Silver',
  ALERTE: 'Alerte',
};

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function levelFromScore(score) {
  const value = clampScore(score) ?? 0;
  if (value >= 90) return 'PLATINUM';
  if (value >= 75) return 'GOLD';
  if (value >= 50) return 'SILVER';
  return 'ALERTE';
}

function normalizeLevel(level, score) {
  const normalized = String(level || '').toUpperCase();
  if (LEVEL_LABELS[normalized]) return normalized;
  return levelFromScore(score);
}

function buildResolvedScore({ score, level, source, cachedAt }) {
  const finalScore = clampScore(score) ?? 0;
  const finalLevel = normalizeLevel(level, finalScore);
  const label = LEVEL_LABELS[finalLevel] || LEVEL_LABELS.ALERTE;

  return {
    score: finalScore,
    level: finalLevel,
    label,
    scoreLabel: `${finalScore}/100 · ${label}`,
    source,
    isV2: source === 'v2',
    cachedAt: cachedAt || null,
  };
}

function resolveResilienceScore(input) {
  const candidate = input || {};
  const v2Score = clampScore(candidate?.aiAuditV2?.resilience?.score);
  if (v2Score !== null) {
    return buildResolvedScore({
      score: v2Score,
      level: candidate.aiAuditV2?.resilience?.level,
      source: 'v2',
      cachedAt: candidate.aiAuditV2?.cachedAt || candidate.aiAuditV2?.meta?.analyzedAt || null,
    });
  }

  const serializedScore = clampScore(candidate?.resilience?.score);
  if (serializedScore !== null) {
    const serializedSource = candidate?.resilience?.source === 'v2' || candidate?.resilience?.isV2
      ? 'v2'
      : 'legacy';
    return buildResolvedScore({
      score: serializedScore,
      level: candidate.resilience?.level,
      source: serializedSource,
      cachedAt: candidate.resilience?.cachedAt || null,
    });
  }

  return buildResolvedScore({
    score: candidate?.patrimometer?.score,
    level: candidate?.patrimometer?.grade,
    source: 'legacy',
    cachedAt: null,
  });
}

module.exports = {
  LEVEL_LABELS,
  clampScore,
  levelFromScore,
  resolveResilienceScore,
};
