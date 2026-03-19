#!/usr/bin/env node

const path = require('path');

const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  createPhase1HealthFixtures,
  runMetadataCommandCheck,
  runPhase1Healthcheck,
} = require('../src/services/phase1HealthService');

function formatStatus(ok, label, details = '') {
  return `${ok ? 'PASS' : 'FAIL'} ${label}${details ? ` - ${details}` : ''}`;
}

async function main() {
  const result = await runPhase1Healthcheck({ mode: 'live' });

  console.log('Doc2Loc Phase 1 Smoke Test');
  console.log('');

  const config = result.config || {};
  const checks = result.checks || [];
  const live = result.live || {};
  const providers = live.providers || {};

  console.log(formatStatus(Boolean(config.gemini?.configured), 'Gemini API key', config.gemini?.configured ? `model=${config.gemini?.model}` : 'GEMINI_API_KEY absent'));
  console.log(formatStatus(Boolean(config.mistral?.configured), 'Mistral API key', config.mistral?.configured ? `model=${config.mistral?.model}` : 'MISTRAL_API_KEY absent'));
  console.log(formatStatus(Boolean(config.metadata?.configured), 'Metadata command configured', config.metadata?.command || 'absent'));

  const metadataCheck = checks.find((check) => check.key === 'metadata_command');
  if (metadataCheck) {
    console.log(formatStatus(metadataCheck.ok, 'Metadata command', metadataCheck.details));
  }

  console.log('');
  console.log('Running end-to-end audit...');
  console.log(formatStatus(Boolean(providers.mistralOcr?.ok), 'Mistral OCR live', `${providers.mistralOcr?.usedCount || 0}/${providers.mistralOcr?.totalDocuments || 0} docs via Mistral`));
  console.log(formatStatus(Boolean(providers.metadataScript?.ok), 'Metadata script live', `${providers.metadataScript?.usedCount || 0}/${providers.metadataScript?.totalDocuments || 0} docs via script`));
  console.log(formatStatus(Boolean(providers.geminiArbiter?.ok), 'Gemini arbiter live', providers.geminiArbiter?.ok ? `model=${providers.geminiArbiter?.model}` : (providers.geminiArbiter?.error || 'fallback only')));
  console.log('');

  console.log('Audit summary');
  console.log(JSON.stringify({
    durationMs: live.durationMs,
    trustScore: live.auditSummary?.trustScore,
    trustStatus: live.auditSummary?.trustStatus,
    fraudScore: live.auditSummary?.fraudScore,
    fraudStatus: live.auditSummary?.fraudStatus,
    workflowDecision: live.auditSummary?.workflowDecision,
    pointsIncoherence: live.auditSummary?.pointsIncoherence || [],
    engine: live.auditSummary?.engine || {},
    documentProviders: live.documentProviders || [],
  }, null, 2));

  process.exitCode = result.ok ? 0 : 2;
}

async function createSmokeFixtures(tempDir, options = {}) {
  const result = await createPhase1HealthFixtures(tempDir, options);
  return result.files;
}

if (require.main === module) {
  main();
}

module.exports = {
  createSmokeFixtures,
  runMetadataCheck: runMetadataCommandCheck,
};
