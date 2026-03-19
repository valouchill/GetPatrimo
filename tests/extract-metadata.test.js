const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const {
  extractMetadataFromFile,
  extractPDFMetadata,
  inferMimeType,
} = require('../scripts/extract-metadata');

test('inferMimeType returns expected values', () => {
  assert.equal(inferMimeType('/tmp/doc.pdf'), 'application/pdf');
  assert.equal(inferMimeType('/tmp/image.png'), 'image/png');
  assert.equal(inferMimeType('/tmp/unknown.bin'), 'application/octet-stream');
});

test('extractPDFMetadata returns embedded PDF metadata', async () => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([300, 200]);
  pdfDoc.setTitle('Bulletin de salaire');
  pdfDoc.setAuthor('Doc2Loc');
  pdfDoc.setCreator('PayFit');
  pdfDoc.setProducer('Adobe PDF Library');
  pdfDoc.setCreationDate(new Date('2025-01-15T10:00:00.000Z'));
  pdfDoc.setModificationDate(new Date('2025-01-16T12:00:00.000Z'));

  const bytes = await pdfDoc.save({ updateFieldAppearances: false });
  const metadata = await extractPDFMetadata(Buffer.from(bytes));

  assert.equal(metadata.title, 'Bulletin de salaire');
  assert.equal(metadata.author, 'Doc2Loc');
  assert.equal(metadata.creator, 'PayFit');
  assert.equal(metadata.producer, 'Adobe PDF Library');
  assert.equal(metadata.pageCount, 1);
  assert.equal(metadata.isPdf, true);
  assert.equal(metadata.encrypted, false);
  assert.equal(typeof metadata.fileSizeKB, 'number');
});

test('extractMetadataFromFile falls back cleanly for non-PDF files', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'doc2loc-meta-'));
  const filePath = path.join(tempDir, 'note.txt');

  await fs.promises.writeFile(filePath, 'hello');

  const metadata = await extractMetadataFromFile(filePath);

  assert.equal(metadata.isPdf, false);
  assert.equal(metadata.mimeType, 'text/plain');
  assert.equal(metadata.pageCount, 0);
  assert.equal(metadata.fileSizeKB >= 0, true);
  assert.equal(Array.isArray(metadata.details), true);
});
