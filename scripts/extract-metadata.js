#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

function isDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function toIsoOrNull(value) {
  return isDate(value) ? value.toISOString() : null;
}

function inferMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.txt':
      return 'text/plain';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

function buildEmptyMetadata(extra = {}) {
  return {
    title: null,
    author: null,
    creator: null,
    producer: null,
    creationDate: null,
    modificationDate: null,
    pageCount: 0,
    fileSizeKB: 0,
    mimeType: 'application/octet-stream',
    isPdf: false,
    encrypted: false,
    hasForm: false,
    details: [],
    ...extra,
  };
}

async function extractPDFMetadata(fileBuffer, filePath = '') {
  try {
    const pdfDoc = await PDFDocument.load(fileBuffer, {
      updateMetadata: false,
      ignoreEncryption: false,
    });

    let hasForm = false;
    try {
      hasForm = !!pdfDoc.getForm();
    } catch (error) {
      hasForm = false;
    }

    return buildEmptyMetadata({
      title: pdfDoc.getTitle() || null,
      author: pdfDoc.getAuthor() || null,
      creator: pdfDoc.getCreator() || null,
      producer: pdfDoc.getProducer() || null,
      creationDate: toIsoOrNull(pdfDoc.getCreationDate()),
      modificationDate: toIsoOrNull(pdfDoc.getModificationDate()),
      pageCount: pdfDoc.getPageCount(),
      fileSizeKB: Math.round(fileBuffer.byteLength / 1024),
      mimeType: 'application/pdf',
      isPdf: true,
      encrypted: false,
      hasForm,
      details: filePath ? [`PDF metadata extracted from ${path.basename(filePath)}`] : ['PDF metadata extracted'],
    });
  } catch (error) {
    return buildEmptyMetadata({
      fileSizeKB: Math.round(fileBuffer.byteLength / 1024),
      mimeType: 'application/pdf',
      isPdf: true,
      encrypted: /password|encrypted/i.test(String(error && error.message || '')),
      details: [
        `PDF metadata extraction failed: ${error && error.message ? error.message : 'unknown error'}`,
      ],
    });
  }
}

async function extractMetadataFromFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const stats = await fs.promises.stat(absolutePath);
  const fileBuffer = await fs.promises.readFile(absolutePath);
  const mimeType = inferMimeType(absolutePath);

  if (mimeType === 'application/pdf') {
    const metadata = await extractPDFMetadata(fileBuffer, absolutePath);
    if (!metadata.creationDate) {
      metadata.creationDate = toIsoOrNull(stats.birthtime) || toIsoOrNull(stats.ctime);
    }
    if (!metadata.modificationDate) {
      metadata.modificationDate = toIsoOrNull(stats.mtime);
    }
    return metadata;
  }

  return buildEmptyMetadata({
    fileSizeKB: Math.round(fileBuffer.byteLength / 1024),
    mimeType,
    creationDate: toIsoOrNull(stats.birthtime) || toIsoOrNull(stats.ctime),
    modificationDate: toIsoOrNull(stats.mtime),
    details: [
      `Non-PDF fallback metadata only for ${path.basename(absolutePath)}`,
    ],
  });
}

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    process.stderr.write('Usage: extract-metadata.js <file-path>\n');
    process.exitCode = 1;
    return;
  }

  try {
    const metadata = await extractMetadataFromFile(filePath);
    process.stdout.write(`${JSON.stringify(metadata)}\n`);
  } catch (error) {
    const fallback = buildEmptyMetadata({
      mimeType: inferMimeType(filePath),
      details: [
        `Metadata command failed: ${error && error.message ? error.message : 'unknown error'}`,
      ],
    });
    process.stdout.write(`${JSON.stringify(fallback)}\n`);
    process.exitCode = 0;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildEmptyMetadata,
  extractMetadataFromFile,
  extractPDFMetadata,
  inferMimeType,
};
