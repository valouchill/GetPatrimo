const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');

const {
  analyzePdfForensics,
  extractPDFMetadata,
} = require('../src/services/pdfDocumentService');

async function makePdf({ creator, producer, creationDate, modificationDate }) {
  const doc = await PDFDocument.create();
  doc.addPage([300, 200]);
  if (creator !== undefined) doc.setCreator(creator);
  if (producer !== undefined) doc.setProducer(producer);
  if (creationDate) doc.setCreationDate(creationDate);
  if (modificationDate) doc.setModificationDate(modificationDate);
  const bytes = await doc.save({ updateFieldAppearances: false });
  return Buffer.from(bytes);
}

test('analyzePdfForensics flags a retouching tool (Photoshop)', async () => {
  const pdf = await makePdf({ producer: 'Adobe Photoshop 25.0', creator: 'Adobe Photoshop' });
  const f = await analyzePdfForensics(pdf);
  assert.equal(f.isAltered, true);
  assert.equal(f.reasons.some((r) => /retouche|Photoshop/i.test(r)), true);
});

test('analyzePdfForensics flags iLovePDF (enriched list vs legacy)', async () => {
  const pdf = await makePdf({ producer: 'iLovePDF' });
  const f = await analyzePdfForensics(pdf);
  assert.equal(f.isAltered, true);
});

test('analyzePdfForensics does NOT flag a legitimate payroll tool', async () => {
  const pdf = await makePdf({
    creator: 'PayFit',
    producer: 'Adobe PDF Library',
    creationDate: new Date('2025-01-15T10:00:00.000Z'),
  });
  const f = await analyzePdfForensics(pdf);
  assert.equal(f.isAltered, false);
});

test('analyzePdfForensics surfaces a "modified after creation" reason without altering legit verdict', async () => {
  const pdf = await makePdf({
    creator: 'PayFit',
    producer: 'PayFit',
    creationDate: new Date('2025-01-15T10:00:00.000Z'),
    modificationDate: new Date('2025-01-18T10:00:00.000Z'), // +3 jours
  });
  const f = await analyzePdfForensics(pdf);
  assert.equal(f.isAltered, false); // legit software → pas d'altération
  assert.equal(f.reasons.some((r) => /modifié plus de 24 h/i.test(r)), true);
  assert.equal(typeof f.creationDate, 'string');
  assert.equal(typeof f.modificationDate, 'string');
});

test('extractPDFMetadata keeps the legacy shape (suspicious mirrors isAltered)', async () => {
  const suspicious = await extractPDFMetadata(await makePdf({ producer: 'GIMP 2.10' }));
  assert.equal(suspicious.suspicious, true);
  assert.equal(Array.isArray(suspicious.details), true);

  const clean = await extractPDFMetadata(await makePdf({ creator: 'Silae', producer: 'iText' }));
  assert.equal(clean.suspicious, false);
});

test('analyzePdfForensics fails safe on a non-PDF buffer', async () => {
  const f = await analyzePdfForensics(Buffer.from('not a pdf'));
  assert.equal(f.isAltered, false);
  assert.deepEqual(f.reasons, []);
});
