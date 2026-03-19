const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createSmokeFixtures,
  runMetadataCheck,
} = require('../scripts/smoke-phase1-audit');

test('smoke fixtures generator creates the expected PDFs', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'doc2loc-smoke-fixtures-'));

  try {
    const fixtures = await createSmokeFixtures(tempDir);

    for (const filePath of Object.values(fixtures)) {
      const stats = await fs.promises.stat(filePath);
      assert.ok(stats.size > 0);
      assert.equal(path.extname(filePath), '.pdf');
    }
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});

test('metadata smoke helper reports success with the local metadata script', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'doc2loc-smoke-meta-'));

  try {
    const fixtures = await createSmokeFixtures(tempDir);
    const check = await runMetadataCheck(fixtures.payslip, {
      metadataCommand: path.resolve('/opt/doc2loc/scripts/extract-metadata.js'),
      metadataTimeoutMs: 15000,
    });

    assert.equal(check.ok, true);
    assert.equal(typeof check.payload, 'object');
    assert.equal(check.payload.mimeType, 'application/pdf');
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});
