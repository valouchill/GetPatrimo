const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPdfRenderStrategies,
  cloneStablePdfBytes,
  getPdfConversionUserMessage,
  isDetachedArrayBufferError,
  toStableBuffer,
} = require('../src/utils/pdfBufferUtils');

test('toStableBuffer creates an independent copy from an ArrayBuffer', () => {
  const original = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  const stable = toStableBuffer(original.buffer);

  original[0] = 0x00;

  assert.equal(stable[0], 0x25);
  assert.equal(stable.toString('ascii', 0, 4), '%PDF');
});

test('cloneStablePdfBytes returns an independent Uint8Array copy', () => {
  const stable = Buffer.from('%PDF-example', 'ascii');
  const clone = cloneStablePdfBytes(stable);

  clone[0] = 0x00;

  assert.equal(stable[0], 0x25);
  assert.equal(clone[0], 0x00);
});

test('buildPdfRenderStrategies honors the requested DPI and fallback order', () => {
  assert.deepEqual(
    buildPdfRenderStrategies(200).map((strategy) => strategy.dpi),
    [200, 150, 100, 72]
  );

  assert.deepEqual(
    buildPdfRenderStrategies(72).map((strategy) => strategy.dpi),
    [72, 54, 36]
  );
});

test('detached ArrayBuffer errors get a dedicated user-facing message', () => {
  const error = new Error('Cannot perform Construct on a detached ArrayBuffer');
  const userMessage = getPdfConversionUserMessage(error);

  assert.equal(isDetachedArrayBufferError(error), true);
  assert.match(userMessage.details, /erreur interne temporaire/i);
  assert.match(userMessage.advice, /support|JPG\/PNG/i);
});
