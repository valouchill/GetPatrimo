const path = require('path');

const DEFAULT_SUSPICIOUS_SOFTWARE = [
  'Adobe Photoshop',
  'Canva',
  'GIMP',
  'Paint',
  'Illustrator',
  'InDesign',
  'ImageMagick',
  'ILovePDF',
  'Smallpdf',
  'Sejda',
];

const DEFAULT_LEGITIMATE_SOFTWARE = [
  'Payfit',
  'Sage',
  'Cegid',
  'Silae',
  'ADP',
  'Lucca',
  'Microsoft',
  'LibreOffice',
  'Apache',
  'iText',
  'PDFKit',
];

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value, fallback) {
  if (!value) return [...fallback];

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeThresholds(overrides = {}) {
  const trustMax = parseNumber(
    overrides.trustMax ?? process.env.FORENSIC_THRESHOLD_TRUST_MAX,
    20
  );
  const doubtMax = parseNumber(
    overrides.doubtMax ?? process.env.FORENSIC_THRESHOLD_DOUBT_MAX,
    80
  );

  return {
    trustMax: Math.max(0, Math.min(100, trustMax)),
    doubtMax: Math.max(Math.max(0, trustMax), Math.min(100, doubtMax)),
  };
}

function getPhase1AuditConfig(overrides = {}) {
  return {
    uploadsDir: overrides.uploadsDir || path.join(__dirname, '../../uploads'),
    geminiApiKey: overrides.geminiApiKey ?? process.env.GEMINI_API_KEY ?? '',
    geminiModel: overrides.geminiModel ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    mistralApiKey: overrides.mistralApiKey ?? process.env.MISTRAL_API_KEY ?? '',
    mistralOcrModel: overrides.mistralOcrModel ?? process.env.MISTRAL_OCR_MODEL ?? 'mistral-ocr-latest',
    metadataCommand:
      overrides.metadataCommand ??
      process.env.FORENSIC_METADATA_COMMAND ??
      process.env.METADATA_SCRIPT_COMMAND ??
      '',
    metadataTimeoutMs: parseNumber(
      overrides.metadataTimeoutMs ?? process.env.FORENSIC_METADATA_TIMEOUT_MS,
      15000
    ),
    mistralTimeoutMs: parseNumber(
      overrides.mistralTimeoutMs ?? process.env.MISTRAL_TIMEOUT_MS,
      45000
    ),
    geminiTimeoutMs: parseNumber(
      overrides.geminiTimeoutMs ?? process.env.GEMINI_TIMEOUT_MS,
      45000
    ),
    mathTolerance: parseNumber(
      overrides.mathTolerance ?? process.env.FORENSIC_MATH_TOLERANCE,
      1
    ),
    thresholds: normalizeThresholds(overrides.thresholds || {}),
    suspiciousSoftware: parseList(
      overrides.suspiciousSoftware ?? process.env.FORENSIC_SUSPICIOUS_SOFTWARE,
      DEFAULT_SUSPICIOUS_SOFTWARE
    ),
    legitimateSoftware: parseList(
      overrides.legitimateSoftware ?? process.env.FORENSIC_LEGITIMATE_SOFTWARE,
      DEFAULT_LEGITIMATE_SOFTWARE
    ),
  };
}

module.exports = {
  DEFAULT_SUSPICIOUS_SOFTWARE,
  DEFAULT_LEGITIMATE_SOFTWARE,
  getPhase1AuditConfig,
  normalizeThresholds,
};
