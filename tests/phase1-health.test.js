const test = require('node:test');
const assert = require('node:assert/strict');

const {
  runPhase1ConfigHealthcheck,
} = require('../src/services/phase1HealthService');

test('Phase 1 config healthcheck reflects configured providers', async () => {
  const result = await runPhase1ConfigHealthcheck({
    configOverrides: {
      geminiApiKey: 'gemini-test-key',
      geminiModel: 'gemini-test-model',
      mistralApiKey: 'mistral-test-key',
      mistralOcrModel: 'mistral-test-model',
      metadataCommand: '/opt/doc2loc/scripts/extract-metadata.js',
      thresholds: {
        trustMax: 10,
        doubtMax: 60,
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'config');
  assert.equal(result.config.gemini.configured, true);
  assert.equal(result.config.gemini.model, 'gemini-test-model');
  assert.equal(result.config.mistral.configured, true);
  assert.equal(result.config.mistral.model, 'mistral-test-model');
  assert.equal(result.config.metadata.configured, true);
  assert.equal(result.config.metadata.command, '/opt/doc2loc/scripts/extract-metadata.js');
  assert.equal(result.config.thresholds.trustMax, 10);
  assert.equal(result.config.thresholds.doubtMax, 60);
});
