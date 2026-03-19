const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const { getPhase1AuditConfig } = require('../config/phase1Audit');

const execAsync = promisify(exec);

const MONTHS = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

const FIXED_FRENCH_HOLIDAYS = new Set([
  '01-01',
  '05-01',
  '05-08',
  '07-14',
  '08-15',
  '11-01',
  '11-11',
  '12-25',
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeComparable(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function splitStructuredLines(text) {
  const normalized = normalizeText(text);
  return normalized.replace(
    /\s+(?=(Nom|Prenom|Prénom|Adresse|Employeur|Date d['’ ]?embauche|Anciennete|Ancienneté|Date|Salaire brut|Cotisations salariales|Net a payer|Net à payer|Cumul annuel net imposable|Net imposable|Revenu fiscal de reference|Revenu fiscal de référence)\s*:)/gi,
    '\n'
  );
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function parseAmount(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  let cleaned = String(value)
    .trim()
    .replace(/[€$£]/g, '')
    .replace(/\s/g, '');

  if (!cleaned) return null;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    const parts = cleaned.split('.');
    cleaned = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractAmountCandidates(text) {
  const matches = String(text || '').match(
    /\b\d{1,3}(?:[ .]\d{3})*(?:,\d{2})\b|\b\d+(?:,\d{2})\b|\b\d+(?:\.\d{2})\b|\b\d{3,6}\b/g
  );

  return toArray(matches)
    .map((match) => parseAmount(match))
    .filter((value) => value !== null);
}

function extractLineValue(lines, patterns) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (patterns.some((pattern) => pattern.test(line))) {
      const afterColon = line.split(':').slice(1).join(':').trim();
      if (afterColon) return afterColon;

      const next = (lines[index + 1] || '').trim();
      if (next && !patterns.some((pattern) => pattern.test(next))) {
        return next;
      }
    }
  }

  return '';
}

function pickAmountFromLines(lines, patterns, strategy = 'last') {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!patterns.some((pattern) => pattern.test(line))) continue;

    let amounts = extractAmountCandidates(line);
    if (!amounts.length) {
      amounts = extractAmountCandidates(lines[index + 1] || '');
    }

    if (!amounts.length) continue;

    if (strategy === 'largest') return Math.max(...amounts);
    if (strategy === 'first') return amounts[0];
    return amounts[amounts.length - 1];
  }

  return null;
}

function extractAmountByRegex(text, pattern) {
  const match = String(text || '').match(pattern);
  if (!match) return null;
  return parseAmount(match[1]);
}

function extractMonthFromString(value) {
  const normalized = normalizeComparable(value).toLowerCase();

  for (const [monthName, monthIndex] of Object.entries(MONTHS)) {
    if (normalized.includes(monthName)) {
      return monthIndex;
    }
  }

  const slashMatch = normalized.match(/\b(0?[1-9]|1[0-2])[\/\-](20\d{2})\b/);
  if (slashMatch) {
    return Number.parseInt(slashMatch[1], 10);
  }

  return null;
}

function extractYearFromString(value) {
  const match = String(value || '').match(/\b(20\d{2})\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseDateValue(rawValue) {
  if (!rawValue) return null;

  const value = String(rawValue).trim();
  if (!value) return null;

  const isoMatch = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const frMatch = value.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if (frMatch) {
    return `${frMatch[3]}-${String(frMatch[2]).padStart(2, '0')}-${String(frMatch[1]).padStart(2, '0')}`;
  }

  const normalized = normalizeComparable(value).toLowerCase();
  for (const [monthName, monthIndex] of Object.entries(MONTHS)) {
    if (normalized.includes(monthName)) {
      const year = extractYearFromString(value);
      if (year) {
        return `${year}-${String(monthIndex).padStart(2, '0')}-01`;
      }
    }
  }

  return null;
}

function extractDateFromLines(lines, patterns) {
  const raw = extractLineValue(lines, patterns);
  return parseDateValue(raw);
}

function extractAddress(lines) {
  const addressRegex = /\d{1,4}\s+[^\n]{0,80}?\b\d{5}\s+[A-Za-zÀ-ÿ' -]{2,40}/i;
  const addressLabel = extractLineValue(lines, [/adresse/i, /domicile/i]);
  if (addressLabel) {
    const match = addressLabel.match(addressRegex);
    if (match) {
      return match[0].replace(/\s+/g, ' ').trim();
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const combined = `${lines[index] || ''} ${lines[index + 1] || ''}`
      .replace(/\s+/g, ' ')
      .trim();

    const match = combined.match(addressRegex);
    if (match) {
      return match[0].replace(/\s+/g, ' ').trim();
    }
  }

  return '';
}

function extractAncienneteMonths(lines) {
  const raw = extractLineValue(lines, [/anciennet[eé]/i]);
  if (!raw) return null;

  const yearsMonths = raw.match(/(\d+)\s*an(?:s|nees|nées)?(?:\s+et\s+(\d+)\s*mois?)?/i);
  if (yearsMonths) {
    return (Number.parseInt(yearsMonths[1], 10) * 12) + Number.parseInt(yearsMonths[2] || '0', 10);
  }

  const monthsOnly = raw.match(/(\d+)\s*mois?/i);
  if (monthsOnly) {
    return Number.parseInt(monthsOnly[1], 10);
  }

  return null;
}

function extractContractType(text) {
  const normalized = normalizeComparable(text);
  if (normalized.includes('CDI')) return 'CDI';
  if (normalized.includes('CDD')) return 'CDD';
  if (normalized.includes('INTERIM')) return 'INTERIM';
  if (normalized.includes('APPRENTISSAGE')) return 'APPRENTISSAGE';
  if (normalized.includes('STAGE')) return 'STAGE';
  if (normalized.includes('FREELANCE') || normalized.includes('INDEPENDANT')) return 'FREELANCE';
  return '';
}

function extractOwnerName(lines, candidature = {}) {
  const firstName = extractLineValue(lines, [/^\s*prenom\b/i, /\bpr[eé]nom\b/i]);
  const lastName = extractLineValue(lines, [/^\s*nom\b/i, /\bnom de famille\b/i]);

  let ownerName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (!ownerName) {
    const candidateFullName = `${candidature.firstName || ''} ${candidature.lastName || ''}`.trim();
    const comparableCandidate = normalizeComparable(candidateFullName);
    const comparableText = normalizeComparable(lines.join(' '));

    if (
      comparableCandidate &&
      candidature.firstName &&
      candidature.lastName &&
      comparableText.includes(normalizeComparable(candidature.firstName)) &&
      comparableText.includes(normalizeComparable(candidature.lastName))
    ) {
      ownerName = candidateFullName;
    }
  }

  return ownerName;
}

function extractStructuredData(text, classification, candidature = {}, doc = {}) {
  const normalizedText = splitStructuredLines(text);
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const ownerName = extractOwnerName(lines, candidature);
  const address = extractAddress(lines);
  const employerName = extractLineValue(lines, [
    /employeur/i,
    /raison sociale/i,
    /entreprise/i,
    /societe/i,
    /soci[eé]t[eé]/i,
  ]);
  const contractType = extractContractType(normalizedText);
  const startDate =
    extractDateFromLines(lines, [/date d['’ ]?embauche/i, /date d['’ ]?entree/i, /d[eé]but du contrat/i]) ||
    parseDateValue(extractLineValue(lines, [/anciennet[eé] depuis/i]));
  const emissionDate =
    extractDateFromLines(lines, [/date d['’ ]?emission/i, /[ée]dit[eé] le/i, /^\s*date\s*:/i, /date du bulletin/i, /date de l'avis/i, /p[eé]riode de paie/i]) ||
    parseDateValue(doc.originalName || '');
  const monthIndex = extractMonthFromString(`${doc.originalName || ''}\n${normalizedText}`);
  const year = extractYearFromString(`${doc.originalName || ''}\n${normalizedText}`);

  const grossSalary = pickAmountFromLines(lines, [/salaire brut/i, /\bbrut\b/i], 'largest');
  const cotisations = pickAmountFromLines(
    lines,
    [/cotisations?/i, /retenues?/i, /charges salariales?/i, /total des cotisations?/i],
    'largest'
  );
  const netPay = pickAmountFromLines(
    lines,
    [/net [aà] payer/i, /salaire net/i, /\bnet paye\b/i, /net pay[eé]/i],
    'first'
  );
  const netImposable = pickAmountFromLines(
    lines,
    [/net imposable/i, /revenu net imposable/i],
    'first'
  );
  const cumulativeNetImposable =
    extractAmountByRegex(
      normalizedText,
      /cumul(?: annuel)?\s+net imposable[^0-9]{0,20}([0-9 .]+(?:[,.][0-9]{2})?)/i
    ) ||
    pickAmountFromLines(
      lines,
      [/cumul(?: annuel)? net imposable/i, /net imposable cumul/i, /cumul imposable/i],
      'last'
    );
  const revenuFiscalReference =
    extractAmountByRegex(
      normalizedText,
      /revenu fiscal de r[eé]f[eé]rence[^0-9]{0,20}([0-9 .]+(?:[,.][0-9]{2})?)/i
    ) ||
    pickAmountFromLines(
      lines,
      [/revenu fiscal de r[eé]f[eé]rence/i, /\brfr\b/i],
      'largest'
    );

  return {
    ownerName,
    address,
    employerName,
    contractType,
    startDate,
    emissionDate,
    monthIndex,
    year,
    ancienneteMonths: extractAncienneteMonths(lines),
    grossSalary,
    cotisations,
    netPay,
    netImposable,
    cumulativeNetImposable,
    revenuFiscalReference,
    candidateNameDetected: Boolean(ownerName),
    sourceClassification: classification,
  };
}

function compareLooseText(a, b) {
  const left = normalizeComparable(a);
  const right = normalizeComparable(b);

  if (!left || !right) return { match: false, comparable: false };
  if (left === right) return { match: true, comparable: true };
  if (left.includes(right) || right.includes(left)) {
    return { match: true, comparable: true };
  }

  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter((token) => token && rightTokens.has(token));

  return {
    match: intersection.length >= Math.min(2, Math.min(leftTokens.size, rightTokens.size)),
    comparable: true,
  };
}

function classifyDocument(document = {}, text = '') {
  const corpus = `${document.originalName || ''} ${document.filename || ''} ${text}`.toLowerCase();

  if (/(bulletin|fiche de paie|salaire|paye)\b/.test(corpus)) return 'PAYSLIP';
  if (/(avis d[' ]?imposition|imposition|impot|impôt|revenu fiscal de reference|rfr)\b/.test(corpus)) return 'TAX';
  if (/(contrat|attestation employeur|cdi|cdd|embauche)\b/.test(corpus)) return 'CONTRACT';
  if (/(cni|carte nationale|identite|identité|passeport|mrz|titre de sejour)\b/.test(corpus)) return 'IDENTITY';
  if (/(justificatif de domicile|facture edf|quittance|domicile)\b/.test(corpus)) return 'ADDRESS';
  if (/(rib|iban|releve bancaire|relevé bancaire)\b/.test(corpus)) return 'BANK';
  if (/(visale|garant|cautionnement)\b/.test(corpus)) return 'GUARANTOR';
  return 'OTHER';
}

function isOfficialDocumentType(type) {
  return ['PAYSLIP', 'TAX', 'CONTRACT', 'IDENTITY', 'ADDRESS'].includes(type);
}

async function extractTextFallback(filePath, mimeType) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { provider: 'fallback', text: '', error: 'Fichier introuvable pour fallback OCR' };
  }

  if (mimeType === 'application/pdf' || /\.pdf$/i.test(filePath)) {
    try {
      const pdfParse = require('pdf-parse');
      const buffer = await fs.promises.readFile(filePath);
      const data = await pdfParse(buffer);
      return {
        provider: 'fallback-pdf-parse',
        text: normalizeText(data.text || ''),
      };
    } catch (error) {
      return {
        provider: 'fallback-pdf-parse',
        text: '',
        error: error.message,
      };
    }
  }

  if (/\.(txt|md|json)$/i.test(filePath)) {
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      return { provider: 'fallback-text', text: normalizeText(raw) };
    } catch (error) {
      return { provider: 'fallback-text', text: '', error: error.message };
    }
  }

  return {
    provider: 'fallback-none',
    text: '',
    error: 'Aucun moteur OCR local disponible pour ce format',
  };
}

async function uploadFileToMistral(filePath, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.mistralTimeoutMs);

  try {
    const buffer = await fs.promises.readFile(filePath);
    const form = new FormData();
    form.append('purpose', 'ocr');
    form.append('file', new Blob([buffer]), path.basename(filePath));

    const response = await fetch('https://api.mistral.ai/v1/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.mistralApiKey}`,
      },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Upload Mistral impossible (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    return data.id || data.file?.id || data.data?.id || null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callMistralOcr(fileId, config) {
  const payloadVariants = [
    {
      model: config.mistralOcrModel,
      document: { type: 'file', file_id: fileId },
      include_image_base64: false,
    },
    {
      model: config.mistralOcrModel,
      document: { file_id: fileId },
      include_image_base64: false,
    },
  ];

  for (const payload of payloadVariants) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.mistralTimeoutMs);

    try {
      const response = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.mistralApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        if (response.status >= 400 && response.status < 500) {
          continue;
        }
        throw new Error(`OCR Mistral impossible (${response.status}): ${errorBody}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('OCR Mistral impossible avec les formats de payload supportés');
}

async function extractTextWithMistral(filePath, mimeType, config) {
  if (!config.mistralApiKey) {
    return {
      provider: 'mistral-disabled',
      text: '',
      error: 'MISTRAL_API_KEY non configurée',
    };
  }

  if (!filePath || !fs.existsSync(filePath)) {
    return {
      provider: 'mistral',
      text: '',
      error: 'Fichier introuvable pour OCR Mistral',
    };
  }

  try {
    const fileId = await uploadFileToMistral(filePath, config);
    if (!fileId) {
      throw new Error('Aucun file_id Mistral retourné');
    }

    const data = await callMistralOcr(fileId, config);
    const pages = toArray(data.pages);
    const markdown = pages
      .map((page) => page.markdown || page.text || '')
      .filter(Boolean)
      .join('\n\n');

    if (markdown.trim()) {
      return {
        provider: 'mistral',
        text: normalizeText(markdown),
        model: data.model || config.mistralOcrModel,
        mimeType,
      };
    }

    return {
      provider: 'mistral',
      text: '',
      error: 'Réponse OCR Mistral vide',
      model: data.model || config.mistralOcrModel,
    };
  } catch (error) {
    return {
      provider: 'mistral',
      text: '',
      error: error.message,
    };
  }
}

async function fallbackMetadataExtraction(filePath, mimeType) {
  const metadata = {
    provider: 'fallback',
    creator: '',
    producer: '',
    creationDate: '',
    modificationDate: '',
    suspicious: false,
    legitimate: false,
    details: [],
  };

  if (!filePath || !fs.existsSync(filePath)) {
    metadata.details.push('Fichier introuvable pour extraction de métadonnées');
    return metadata;
  }

  const stats = await fs.promises.stat(filePath);
  metadata.modificationDate = stats.mtime.toISOString();
  metadata.creationDate = stats.birthtime ? stats.birthtime.toISOString() : stats.ctime.toISOString();

  if (mimeType === 'application/pdf' || /\.pdf$/i.test(filePath)) {
    try {
      const pdfParse = require('pdf-parse');
      const buffer = await fs.promises.readFile(filePath);
      const parsed = await pdfParse(buffer);
      const info = parsed.info || {};
      metadata.creator = info.Creator || info.Producer || '';
      metadata.producer = info.Producer || '';
      metadata.details.push(`PDF analysé via fallback (${metadata.creator || metadata.producer || 'créateur inconnu'})`);
    } catch (error) {
      metadata.details.push(`Fallback PDF indisponible: ${error.message}`);
    }
  } else {
    metadata.details.push('Métadonnées limitées au système de fichiers pour ce format');
  }

  return metadata;
}

async function extractTechnicalMetadata(document, config, adapters = {}) {
  if (document.technicalMetadata) {
    return {
      provider: 'preloaded',
      details: [],
      ...document.technicalMetadata,
    };
  }

  if (adapters.metadata) {
    const result = await adapters.metadata(document, { config });
    return typeof result === 'string'
      ? { provider: 'adapter', details: [], raw: result }
      : { provider: 'adapter', details: [], ...(result || {}) };
  }

  const filePath = document.absolutePath;
  if (config.metadataCommand && filePath) {
    try {
      const command = `${config.metadataCommand} ${shellEscape(filePath)}`;
      const { stdout, stderr } = await execAsync(command, {
        timeout: config.metadataTimeoutMs,
        maxBuffer: 1024 * 1024 * 4,
      });

      const raw = stdout || stderr || '';
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      return {
        provider: 'script',
        details: [],
        ...parsed,
      };
    } catch (error) {
      const fallback = await fallbackMetadataExtraction(filePath, document.mimeType);
      fallback.provider = 'fallback-after-script-error';
      fallback.details.unshift(`Script métadonnées indisponible: ${error.message}`);
      return fallback;
    }
  }

  return fallbackMetadataExtraction(filePath, document.mimeType);
}

function resolveAbsolutePath(document, config) {
  if (document.absolutePath) return document.absolutePath;
  if (document.filePath) return document.filePath;
  if (document.relPath) return path.resolve(config.uploadsDir, document.relPath);
  return null;
}

async function processDocument(document, candidature, config, adapters = {}) {
  const absolutePath = resolveAbsolutePath(document, config);
  let ocrResult = {
    provider: 'preloaded',
    text: normalizeText(document.ocrText || ''),
  };

  if (!ocrResult.text) {
    if (adapters.ocr) {
      const adapterResult = await adapters.ocr({ ...document, absolutePath }, { candidature, config });
      ocrResult =
        typeof adapterResult === 'string'
          ? { provider: 'adapter', text: normalizeText(adapterResult) }
          : { provider: 'adapter', text: normalizeText(adapterResult?.text || ''), ...(adapterResult || {}) };
    } else {
      const mistralResult = await extractTextWithMistral(absolutePath, document.mimeType, config);
      if (mistralResult.text) {
        ocrResult = mistralResult;
      } else {
        const fallbackResult = await extractTextFallback(absolutePath, document.mimeType);
        ocrResult = {
          ...fallbackResult,
          details: unique([mistralResult.error, fallbackResult.error]),
        };
      }
    }
  }

  const classification = document.classification || classifyDocument(document, ocrResult.text);
  const metadata = await extractTechnicalMetadata({ ...document, absolutePath }, config, adapters);
  const structured = extractStructuredData(ocrResult.text, classification, candidature, document);

  return {
    id: String(document._id || document.id || document.filename || document.originalName || Math.random()),
    originalName: document.originalName || document.filename || 'document',
    filename: document.filename || '',
    relPath: document.relPath || '',
    absolutePath,
    mimeType: document.mimeType || '',
    size: document.size || 0,
    classification,
    ocr: {
      provider: ocrResult.provider || 'unknown',
      text: normalizeText(ocrResult.text || ''),
      error: ocrResult.error || '',
      details: toArray(ocrResult.details),
    },
    metadata,
    structured,
  };
}

function addFinding(target, finding) {
  target.push({
    code: finding.code,
    severity: finding.severity || 'warning',
    message: finding.message,
    scoreImpact: finding.scoreImpact || 0,
    relatedDocuments: unique(toArray(finding.relatedDocuments)),
    metadata: finding.metadata || null,
  });
}

function isNonWorkingDay(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return true;
  return FIXED_FRENCH_HOLIDAYS.has(dateString.slice(5));
}

function buildDeterministicAssessment(payload, documents, config) {
  const findings = [];
  const candidate = payload.candidature || {};
  const property = payload.property || {};
  const submissionDate = candidate.createdAt ? new Date(candidate.createdAt) : null;
  const candidateFullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();

  const byType = documents.reduce((accumulator, document) => {
    accumulator[document.classification] = accumulator[document.classification] || [];
    accumulator[document.classification].push(document);
    return accumulator;
  }, {});

  const payslips = byType.PAYSLIP || [];
  const taxDocs = byType.TAX || [];
  const identityDocs = byType.IDENTITY || [];
  const contractDocs = byType.CONTRACT || [];
  const addressDocs = byType.ADDRESS || [];

  let hasProcessingUncertainty = false;
  let dossierPartial = false;
  let explicitCritical = false;

  const requiredTypes = [
    { type: 'IDENTITY', label: "pièce d'identité" },
    { type: 'PAYSLIP', label: 'fiches de paie' },
    { type: 'TAX', label: "avis d'imposition" },
  ];

  requiredTypes.forEach((requirement) => {
    if (!toArray(byType[requirement.type]).length) {
      dossierPartial = true;
      addFinding(findings, {
        code: `MISSING_${requirement.type}`,
        severity: 'warning',
        scoreImpact: 15,
        message: `Document manquant: ${requirement.label}. L'audit du dossier reste partiel.`,
      });
    }
  });

  for (const document of documents) {
    if (!document.ocr.text) {
      hasProcessingUncertainty = true;
      addFinding(findings, {
        code: 'OCR_UNAVAILABLE',
        severity: 'warning',
        scoreImpact: 12,
        relatedDocuments: [document.originalName],
        message: `OCR indisponible ou vide pour "${document.originalName}". Le dossier doit rester en revue manuelle.`,
      });
    }

    if (document.metadata.provider === 'fallback-after-script-error') {
      hasProcessingUncertainty = true;
    }

    const creatorRaw = `${document.metadata.creator || ''} ${document.metadata.producer || ''}`.trim();
    const creatorComparable = normalizeComparable(creatorRaw);

    const suspiciousSoftware = config.suspiciousSoftware.find((software) =>
      creatorComparable.includes(normalizeComparable(software))
    );
    const legitimateSoftware = config.legitimateSoftware.find((software) =>
      creatorComparable.includes(normalizeComparable(software))
    );

    document.metadata.suspicious = Boolean(suspiciousSoftware);
    document.metadata.legitimate = Boolean(legitimateSoftware);

    if (isOfficialDocumentType(document.classification) && suspiciousSoftware) {
      explicitCritical = true;
      addFinding(findings, {
        code: 'SUSPICIOUS_METADATA_SOFTWARE',
        severity: 'critical',
        scoreImpact: 60,
        relatedDocuments: [document.originalName],
        metadata: { creator: creatorRaw },
        message: `Logiciel de création suspect détecté sur "${document.originalName}": ${creatorRaw || suspiciousSoftware}.`,
      });
    }

    const modificationDate = parseDateValue(document.metadata.modificationDate) || document.metadata.modificationDate;
    if (submissionDate && modificationDate) {
      const parsedModification = new Date(modificationDate);
      if (!Number.isNaN(parsedModification.getTime()) && parsedModification > submissionDate) {
        addFinding(findings, {
          code: 'MODIFICATION_AFTER_SUBMISSION',
          severity: 'warning',
          scoreImpact: 20,
          relatedDocuments: [document.originalName],
          message: `Métadonnée incohérente: "${document.originalName}" semble modifié après la soumission du dossier.`,
        });
      }
    }

    if (document.structured.emissionDate && isNonWorkingDay(document.structured.emissionDate) && isOfficialDocumentType(document.classification)) {
      addFinding(findings, {
        code: 'NON_WORKING_DAY_ISSUE_DATE',
        severity: 'warning',
        scoreImpact: 8,
        relatedDocuments: [document.originalName],
        message: `Date d'émission inhabituelle sur "${document.originalName}" (${document.structured.emissionDate}, jour non ouvré).`,
      });
    }
  }

  let mathChecksAvailable = 0;
  let cumulativeChecksAvailable = 0;
  const payslipNetValues = [];
  const payslipGrossValues = [];

  for (const payslip of payslips) {
    const { grossSalary, cotisations, netPay, netImposable, cumulativeNetImposable, monthIndex } = payslip.structured;

    if ([grossSalary, cotisations, netPay].every((value) => value !== null)) {
      mathChecksAvailable += 1;
      const difference = Math.abs((grossSalary - cotisations) - netPay);
      if (difference > config.mathTolerance) {
        explicitCritical = true;
        addFinding(findings, {
          code: 'PAYSLIP_MATH_INCONSISTENCY',
          severity: 'critical',
          scoreImpact: 35,
          relatedDocuments: [payslip.originalName],
          metadata: { difference: Number(difference.toFixed(2)) },
          message: `Écart de ${difference.toFixed(2)}€ entre Brut - Cotisations et Net à payer sur "${payslip.originalName}".`,
        });
      }
    }

    if (monthIndex && netImposable !== null && cumulativeNetImposable !== null) {
      cumulativeChecksAvailable += 1;
      const expectedCumulative = netImposable * monthIndex;
      const difference = Math.abs(expectedCumulative - cumulativeNetImposable);
      const tolerance = Math.max(2, expectedCumulative * 0.02);

      if (difference > tolerance) {
        const severe = difference > Math.max(10, expectedCumulative * 0.1);
        if (severe) explicitCritical = true;
        addFinding(findings, {
          code: 'PAYSLIP_CUMULATIVE_INCONSISTENCY',
          severity: severe ? 'critical' : 'warning',
          scoreImpact: severe ? 30 : 18,
          relatedDocuments: [payslip.originalName],
          metadata: {
            expectedCumulative: Number(expectedCumulative.toFixed(2)),
            declaredCumulative: cumulativeNetImposable,
          },
          message: `Cumul net imposable incohérent sur "${payslip.originalName}" (${cumulativeNetImposable}€ déclarés vs ${expectedCumulative.toFixed(2)}€ attendus).`,
        });
      }
    }

    if (netPay !== null) payslipNetValues.push(netPay);
    if (grossSalary !== null) payslipGrossValues.push(grossSalary);
  }

  if (payslips.length && mathChecksAvailable === 0) {
    hasProcessingUncertainty = true;
    addFinding(findings, {
      code: 'PAYSLIP_MATH_UNAVAILABLE',
      severity: 'warning',
      scoreImpact: 10,
      relatedDocuments: payslips.map((document) => document.originalName),
      message: 'Contrôle mathématique impossible sur les fiches de paie faute de montants exploitables.',
    });
  }

  if (payslips.length && cumulativeChecksAvailable === 0) {
    hasProcessingUncertainty = true;
    addFinding(findings, {
      code: 'PAYSLIP_CUMUL_UNAVAILABLE',
      severity: 'warning',
      scoreImpact: 8,
      relatedDocuments: payslips.map((document) => document.originalName),
      message: 'Contrôle du net imposable cumulé impossible sur les fiches de paie.',
    });
  }

  if (
    payslipNetValues.length >= 3 &&
    payslipNetValues.every((value) => Number.isInteger(value)) &&
    unique(payslipNetValues.map((value) => value.toFixed(2))).length === 1
  ) {
    addFinding(findings, {
      code: 'ROUND_SALARY_PATTERN',
      severity: 'warning',
      scoreImpact: 12,
      relatedDocuments: payslips.map((document) => document.originalName),
      message: `Montants de salaire trop ronds et identiques sur plusieurs bulletins (${payslipNetValues[0].toFixed(2)}€).`,
    });
  }

  const taxDoc = taxDocs.find((document) => document.structured.revenuFiscalReference !== null);
  if (taxDoc && payslips.length >= 3) {
    const annualSourceValues = payslips
      .map((document) => document.structured.netImposable ?? document.structured.netPay)
      .filter((value) => value !== null);

    if (annualSourceValues.length >= 3) {
      const sum = annualSourceValues.reduce((total, value) => total + value, 0);
      const annualEstimate =
        annualSourceValues.length >= 11 ? sum : (sum / annualSourceValues.length) * 12;
      const revenueFiscalReference = taxDoc.structured.revenuFiscalReference;
      const diffRatio = Math.abs(annualEstimate - revenueFiscalReference) /
        Math.max(annualEstimate, revenueFiscalReference, 1);

      if (diffRatio > 0.5) {
        explicitCritical = true;
        addFinding(findings, {
          code: 'TAX_INCOME_MAJOR_MISMATCH',
          severity: 'critical',
          scoreImpact: 35,
          relatedDocuments: [taxDoc.originalName, ...payslips.map((document) => document.originalName)],
          metadata: {
            annualEstimate: Number(annualEstimate.toFixed(2)),
            revenueFiscalReference,
            estimatedFromPayslipCount: annualSourceValues.length,
          },
          message: `Le revenu fiscal de référence (${revenueFiscalReference}€) est très éloigné des revenus estimés depuis les bulletins (${annualEstimate.toFixed(2)}€).`,
        });
      } else if (diffRatio > 0.25) {
        addFinding(findings, {
          code: 'TAX_INCOME_MODERATE_MISMATCH',
          severity: 'warning',
          scoreImpact: 20,
          relatedDocuments: [taxDoc.originalName, ...payslips.map((document) => document.originalName)],
          metadata: {
            annualEstimate: Number(annualEstimate.toFixed(2)),
            revenueFiscalReference,
            estimatedFromPayslipCount: annualSourceValues.length,
          },
          message: `Le revenu fiscal de référence (${revenueFiscalReference}€) s'écarte sensiblement des revenus estimés depuis les bulletins (${annualEstimate.toFixed(2)}€).`,
        });
      }
    }
  }

  const docNames = documents
    .map((document) => ({
      document,
      ownerName: document.structured.ownerName,
    }))
    .filter((entry) => entry.ownerName);

  const identityName = identityDocs.find((document) => document.structured.ownerName)?.structured.ownerName || '';
  if (candidateFullName && identityName) {
    const candidateVsIdentity = compareLooseText(candidateFullName, identityName);
    if (candidateVsIdentity.comparable && !candidateVsIdentity.match) {
      explicitCritical = true;
      addFinding(findings, {
        code: 'IDENTITY_CANDIDATE_NAME_MISMATCH',
        severity: 'critical',
        scoreImpact: 40,
        relatedDocuments: identityDocs.map((document) => document.originalName),
        message: `Le nom détecté sur la pièce d'identité (${identityName}) ne correspond pas au candidat déclaré (${candidateFullName}).`,
      });
    }
  }

  for (const entry of docNames) {
    if (!candidateFullName) break;
    const comparison = compareLooseText(candidateFullName, entry.ownerName);
    if (comparison.comparable && !comparison.match) {
      const isIdentity = entry.document.classification === 'IDENTITY';
      if (isIdentity) explicitCritical = true;
      addFinding(findings, {
        code: 'DOC_OWNER_NAME_MISMATCH',
        severity: isIdentity ? 'critical' : 'warning',
        scoreImpact: isIdentity ? 35 : 18,
        relatedDocuments: [entry.document.originalName],
        message: `Le titulaire détecté sur "${entry.document.originalName}" (${entry.ownerName}) diffère du candidat déclaré (${candidateFullName}).`,
      });
    }
  }

  if (identityName) {
    for (const document of [...payslips, ...taxDocs, ...contractDocs]) {
      if (!document.structured.ownerName) continue;
      const comparison = compareLooseText(identityName, document.structured.ownerName);
      if (comparison.comparable && !comparison.match) {
        explicitCritical = true;
        addFinding(findings, {
          code: 'CROSS_DOCUMENT_IDENTITY_MISMATCH',
          severity: 'critical',
          scoreImpact: 45,
          relatedDocuments: unique([document.originalName, ...identityDocs.map((entry) => entry.originalName)]),
          message: `Incohérence d'identité entre la pièce d'identité (${identityName}) et "${document.originalName}" (${document.structured.ownerName}).`,
        });
      }
    }
  }

  const addresses = unique(
    [...taxDocs, ...payslips, ...addressDocs, ...identityDocs]
      .map((document) => document.structured.address)
      .filter(Boolean)
      .map((address) => normalizeComparable(address))
  );

  if (addresses.length > 1) {
    addFinding(findings, {
      code: 'ADDRESS_MISMATCH',
      severity: 'warning',
      scoreImpact: 15,
      relatedDocuments: [...taxDocs, ...payslips, ...addressDocs, ...identityDocs].map((document) => document.originalName),
      message: "Des adresses différentes ont été détectées entre les pièces du dossier sans justification explicite.",
    });
  }

  const employerNames = unique(
    payslips
      .map((document) => document.structured.employerName)
      .filter(Boolean)
      .map((value) => normalizeComparable(value))
  );

  if (employerNames.length > 1) {
    addFinding(findings, {
      code: 'EMPLOYER_MISMATCH',
      severity: 'warning',
      scoreImpact: 15,
      relatedDocuments: payslips.map((document) => document.originalName),
      message: 'Des employeurs différents ont été détectés entre les bulletins de salaire.',
    });
  }

  const contractEmployer = contractDocs.find((document) => document.structured.employerName)?.structured.employerName;
  const payslipEmployer = payslips.find((document) => document.structured.employerName)?.structured.employerName;

  if (contractEmployer && payslipEmployer) {
    const employerComparison = compareLooseText(contractEmployer, payslipEmployer);
    if (employerComparison.comparable && !employerComparison.match) {
      addFinding(findings, {
        code: 'CONTRACT_EMPLOYER_MISMATCH',
        severity: 'warning',
        scoreImpact: 18,
        relatedDocuments: unique([
          ...contractDocs.map((document) => document.originalName),
          ...payslips.map((document) => document.originalName),
        ]),
        message: `Le contrat (${contractEmployer}) ne correspond pas à l'employeur détecté sur les bulletins (${payslipEmployer}).`,
      });
    }
  }

  const contractStartDate = contractDocs.find((document) => document.structured.startDate)?.structured.startDate;
  const firstPayslipEmissionDate = payslips
    .map((document) => document.structured.emissionDate)
    .filter(Boolean)
    .sort()[0];

  if (contractStartDate && firstPayslipEmissionDate) {
    const contractDate = new Date(contractStartDate);
    const payslipDate = new Date(firstPayslipEmissionDate);
    if (!Number.isNaN(contractDate.getTime()) && !Number.isNaN(payslipDate.getTime()) && contractDate > payslipDate) {
      explicitCritical = true;
      addFinding(findings, {
        code: 'TEMPORAL_EMPLOYMENT_INCONSISTENCY',
        severity: 'critical',
        scoreImpact: 25,
        relatedDocuments: unique([
          ...contractDocs.map((document) => document.originalName),
          ...payslips.map((document) => document.originalName),
        ]),
        message: `Le contrat semble démarrer après au moins un bulletin de salaire (${contractStartDate} > ${firstPayslipEmissionDate}).`,
      });
    }
  }

  const payslipAnciennete = payslips.find((document) => document.structured.ancienneteMonths !== null)?.structured.ancienneteMonths;
  if (contractStartDate && firstPayslipEmissionDate && payslipAnciennete !== null) {
    const contractDate = new Date(contractStartDate);
    const payslipDate = new Date(firstPayslipEmissionDate);
    if (!Number.isNaN(contractDate.getTime()) && !Number.isNaN(payslipDate.getTime())) {
      const monthsDiff =
        ((payslipDate.getUTCFullYear() - contractDate.getUTCFullYear()) * 12) +
        (payslipDate.getUTCMonth() - contractDate.getUTCMonth());

      if (Math.abs(monthsDiff - payslipAnciennete) > 2) {
        addFinding(findings, {
          code: 'ANCIENNETE_MISMATCH',
          severity: 'warning',
          scoreImpact: 12,
          relatedDocuments: unique([
            ...contractDocs.map((document) => document.originalName),
            ...payslips.map((document) => document.originalName),
          ]),
          message: `Ancienneté incohérente entre le contrat et les bulletins (${payslipAnciennete} mois lus vs ${monthsDiff} mois calculés).`,
        });
      }
    }
  }

  const rawFraudScore = clamp(
    findings.reduce((total, finding) => total + (finding.scoreImpact || 0), 0),
    0,
    100
  );

  const positiveIndicators = {
    payslipCount: payslips.length,
    taxDocCount: taxDocs.length,
    identityDocCount: identityDocs.length,
    contractDocCount: contractDocs.length,
    propertyCity: property.city || '',
  };

  return {
    findings,
    rawFraudScore,
    hasProcessingUncertainty,
    dossierPartial,
    explicitCritical,
    positiveIndicators,
  };
}

function mapFraudStatusToWorkflow(status) {
  if (status === 'TRUST') return 'AUTOMATIC_PASS';
  if (status === 'ALERT') return 'AUTOMATIC_REJECT';
  return 'ROUTE_TO_HUMAN';
}

function deriveStatusFromScore(score, thresholds) {
  if (score <= thresholds.trustMax) return 'TRUST';
  if (score <= thresholds.doubtMax) return 'DOUBT';
  return 'ALERT';
}

function deriveDeterministicVerdict(assessment, config) {
  let fraudScore = assessment.rawFraudScore;

  if (assessment.explicitCritical) {
    fraudScore = Math.max(fraudScore, config.thresholds.doubtMax + 1);
  }

  let fraudStatus = deriveStatusFromScore(fraudScore, config.thresholds);

  if (!assessment.explicitCritical && (assessment.hasProcessingUncertainty || assessment.dossierPartial)) {
    fraudStatus = 'DOUBT';
    fraudScore = clamp(
      Math.max(fraudScore, config.thresholds.trustMax + 1),
      config.thresholds.trustMax + 1,
      config.thresholds.doubtMax
    );
  }

  const pointsIncoherence = unique(assessment.findings.map((finding) => finding.message));
  let auditorExplanation = 'Le dossier est cohérent au regard des contrôles automatiques effectués.';

  if (fraudStatus === 'TRUST' && pointsIncoherence.length) {
    auditorExplanation = `Le dossier reste globalement cohérent malgré ${pointsIncoherence.length} point(s) de vigilance mineurs.`;
  } else if (fraudStatus === 'DOUBT') {
    auditorExplanation = `Le dossier présente ${pointsIncoherence.length || 'plusieurs'} anomalie(s) ou incertitude(s) nécessitant une revue humaine.`;
  } else if (fraudStatus === 'ALERT') {
    auditorExplanation = `Des incohérences critiques ont été détectées sur le dossier. Une validation automatique n'est pas recommandée.`;
  }

  return {
    fraudScore,
    fraudStatus,
    workflowDecision: mapFraudStatusToWorkflow(fraudStatus),
    pointsIncoherence,
    auditorExplanation,
    findings: assessment.findings,
    explicitCritical: assessment.explicitCritical,
    hasProcessingUncertainty: assessment.hasProcessingUncertainty,
    dossierPartial: assessment.dossierPartial,
  };
}

function buildGeminiPrompt(payload) {
  return `Tu es un expert en détection de fraude documentaire spécialisé dans le marché locatif français.

Analyse un dossier locatif consolidé à partir des preuves structurées suivantes:
- texte OCR consolidé
- métadonnées techniques
- anomalies déterministes déjà calculées

Règles:
- Reste prudent: en cas d'incertitude d'extraction ou de dossier partiel, privilégie DOUBT.
- Réserve ALERT aux incohérences documentaires fortes ou signaux critiques explicites.
- Réponds en JSON strict uniquement.

Format attendu:
{
  "score_fraude": 0,
  "statut": "TRUST | DOUBT | ALERT",
  "points_incoherence": ["..."],
  "decision_workflow": "AUTOMATIC_PASS | ROUTE_TO_HUMAN | AUTOMATIC_REJECT",
  "explication_auditeur": "..."
}

DOSSIER:
${JSON.stringify(payload, null, 2)}`;
}

function safeJsonParse(rawText) {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch (error) {
    const jsonMatch = String(rawText).match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (nestedError) {
      return null;
    }
  }
}

async function callGeminiArbiter(geminiPayload, config, adapters = {}) {
  if (adapters.gemini) {
    const adapterResult = await adapters.gemini(geminiPayload, { config });
    return {
      used: true,
      provider: 'adapter',
      parsed:
        typeof adapterResult === 'string' ? safeJsonParse(adapterResult) : adapterResult || null,
      rawText: typeof adapterResult === 'string' ? adapterResult : JSON.stringify(adapterResult || {}),
    };
  }

  if (!config.geminiApiKey) {
    return {
      used: false,
      provider: 'deterministic',
      parsed: null,
      error: 'GEMINI_API_KEY non configurée',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.geminiTimeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: buildGeminiPrompt(geminiPayload) }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return {
        used: false,
        provider: 'gemini',
        parsed: null,
        error: `Gemini indisponible (${response.status}): ${errorBody}`,
      };
    }

    const data = await response.json();
    const rawText = toArray(data.candidates)
      .flatMap((candidate) => toArray(candidate.content?.parts))
      .map((part) => part.text || '')
      .join('\n')
      .trim();

    return {
      used: true,
      provider: 'gemini',
      parsed: safeJsonParse(rawText),
      rawText,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mergeAuditDecisions(deterministic, geminiResult, config) {
  if (!geminiResult.used || !geminiResult.parsed) {
    return {
      ...deterministic,
      engine: {
        arbiter: 'deterministic-fallback',
        geminiUsed: false,
        geminiError: geminiResult.error || null,
      },
    };
  }

  const parsed = geminiResult.parsed;
  let fraudScore = clamp(Number(parsed.score_fraude ?? deterministic.fraudScore), 0, 100);
  let fraudStatus = ['TRUST', 'DOUBT', 'ALERT'].includes(parsed.statut)
    ? parsed.statut
    : deriveStatusFromScore(fraudScore, config.thresholds);

  if (deterministic.explicitCritical) {
    fraudScore = Math.max(fraudScore, deterministic.fraudScore);
    fraudStatus = 'ALERT';
  } else {
    fraudScore = Math.round((fraudScore * 0.65) + (deterministic.fraudScore * 0.35));
  }

  if (!deterministic.explicitCritical && (deterministic.hasProcessingUncertainty || deterministic.dossierPartial)) {
    fraudStatus = 'DOUBT';
    fraudScore = clamp(
      Math.max(fraudScore, config.thresholds.trustMax + 1),
      config.thresholds.trustMax + 1,
      config.thresholds.doubtMax
    );
  } else if (!deterministic.explicitCritical) {
    fraudStatus = deriveStatusFromScore(fraudScore, config.thresholds);
  }

  const workflowDecision = mapFraudStatusToWorkflow(fraudStatus);
  const pointsIncoherence = unique([
    ...deterministic.pointsIncoherence,
    ...toArray(parsed.points_incoherence),
  ]);

  return {
    ...deterministic,
    fraudScore,
    fraudStatus,
    workflowDecision,
    pointsIncoherence,
    auditorExplanation:
      parsed.explication_auditeur ||
      deterministic.auditorExplanation,
    engine: {
      arbiter: 'gemini',
      geminiUsed: true,
      rawStatus: parsed.statut || null,
      rawWorkflowDecision: parsed.decision_workflow || null,
    },
  };
}

function createGroupedCheck(id, label, findings, passMessage, metadata = {}) {
  if (!findings.length) {
    return {
      id,
      label,
      status: 'PASS',
      details: passMessage,
      metadata,
    };
  }

  const hasCritical = findings.some((finding) => finding.severity === 'critical');
  return {
    id,
    label,
    status: hasCritical ? 'FAIL' : 'WARNING',
    details: findings[0].message,
    metadata: {
      ...metadata,
      findings: findings.map((finding) => ({
        code: finding.code,
        severity: finding.severity,
        relatedDocuments: finding.relatedDocuments,
      })),
    },
  };
}

function buildChecks(audit) {
  const grouped = {
    completeness: audit.findings.filter((finding) => finding.code.startsWith('MISSING_')),
    processing: audit.findings.filter((finding) => finding.code.startsWith('OCR_') || finding.code.includes('UNAVAILABLE')),
    metadata: audit.findings.filter((finding) => finding.code.includes('METADATA') || finding.code.includes('NON_WORKING_DAY') || finding.code.includes('ROUND_')),
    math: audit.findings.filter((finding) => finding.code.startsWith('PAYSLIP_')),
    tax: audit.findings.filter((finding) => finding.code.startsWith('TAX_')),
    identity: audit.findings.filter((finding) => finding.code.includes('IDENTITY') || finding.code.includes('OWNER_NAME')),
    employment: audit.findings.filter((finding) => finding.code.includes('EMPLOYER') || finding.code.includes('ANCIENNETE') || finding.code.includes('TEMPORAL_')),
    address: audit.findings.filter((finding) => finding.code.includes('ADDRESS')),
  };

  return [
    {
      id: 'phase1_verdict',
      label: 'Verdict Auditeur Forensic',
      status: audit.fraudStatus === 'TRUST' ? 'PASS' : audit.fraudStatus === 'DOUBT' ? 'WARNING' : 'FAIL',
      details: `${audit.fraudStatus} • ${audit.workflowDecision} • score fraude ${audit.fraudScore}/100`,
      metadata: {
        fraudScore: audit.fraudScore,
        fraudStatus: audit.fraudStatus,
        workflowDecision: audit.workflowDecision,
      },
    },
    createGroupedCheck(
      'dossier_completeness',
      'Complétude du dossier',
      grouped.completeness,
      'Les pièces essentielles du dossier sont présentes.'
    ),
    createGroupedCheck(
      'document_processing',
      'Qualité de traitement OCR / métadonnées',
      grouped.processing,
      'Les pièces ont pu être exploitées automatiquement.'
    ),
    createGroupedCheck(
      'metadata_integrity',
      'Intégrité des métadonnées',
      grouped.metadata,
      'Aucune métadonnée critique suspecte détectée.'
    ),
    createGroupedCheck(
      'payslip_math',
      'Cohérence mathématique des bulletins',
      grouped.math,
      'Les montants des bulletins sont cohérents.'
    ),
    createGroupedCheck(
      'tax_crosscheck',
      "Cohérence fiscale avis d'imposition / salaires",
      grouped.tax,
      "Aucun écart fiscal majeur détecté."
    ),
    createGroupedCheck(
      'identity_consistency',
      'Cohérence d’identité',
      grouped.identity,
      "L'identité est cohérente entre les pièces du dossier."
    ),
    createGroupedCheck(
      'employment_consistency',
      'Cohérence employeur / ancienneté / contrat',
      grouped.employment,
      "Les signaux d'emploi sont cohérents."
    ),
    createGroupedCheck(
      'address_consistency',
      'Cohérence des adresses',
      grouped.address,
      'Aucune incohérence d’adresse détectée.'
    ),
  ];
}

function buildRating(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

function buildBreakdown(documents, audit) {
  const integrityPenalty = audit.findings
    .filter((finding) => ['critical', 'warning'].includes(finding.severity))
    .reduce((total, finding) => total + finding.scoreImpact, 0);

  return {
    completeness: clamp(
      100 - (audit.findings.filter((finding) => finding.code.startsWith('MISSING_')).length * 15),
      0,
      100
    ),
    processing: clamp(
      100 - (audit.findings.filter((finding) => finding.code.startsWith('OCR_') || finding.code.includes('UNAVAILABLE')).length * 15),
      0,
      100
    ),
    integrity: clamp(100 - integrityPenalty, 0, 100),
    documentsAnalyzed: documents.length,
    workflowDecision: audit.workflowDecision,
  };
}

function buildTrustAnalysisFromAudit(documents, audit, config) {
  const trustScore = clamp(100 - audit.fraudScore, 0, 100);
  const summary = `${audit.fraudStatus} • ${audit.workflowDecision} • ${audit.auditorExplanation}`;

  return {
    score: trustScore,
    status:
      audit.fraudStatus === 'TRUST'
        ? 'VALIDATED'
        : audit.fraudStatus === 'DOUBT'
          ? 'WARNING'
          : 'REJECTED',
    summary,
    rating: buildRating(trustScore),
    breakdown: buildBreakdown(documents, audit),
    checks: buildChecks(audit),
    phase1: {
      fraudScore: audit.fraudScore,
      fraudStatus: audit.fraudStatus,
      workflowDecision: audit.workflowDecision,
      pointsIncoherence: audit.pointsIncoherence,
      auditorExplanation: audit.auditorExplanation,
      thresholds: config.thresholds,
      engine: audit.engine,
      evidence: {
        documents: documents.map((document) => ({
          id: document.id,
          originalName: document.originalName,
          classification: document.classification,
          relPath: document.relPath,
          ocr: {
            provider: document.ocr.provider,
            hasText: Boolean(document.ocr.text),
            excerpt: document.ocr.text.slice(0, 400),
            error: document.ocr.error || null,
          },
          technicalMetadata: {
            provider: document.metadata.provider || 'unknown',
            creator: document.metadata.creator || '',
            producer: document.metadata.producer || '',
            creationDate: document.metadata.creationDate || '',
            modificationDate: document.metadata.modificationDate || '',
            suspicious: Boolean(document.metadata.suspicious),
            legitimate: Boolean(document.metadata.legitimate),
          },
          structured: {
            ownerName: document.structured.ownerName || '',
            address: document.structured.address || '',
            employerName: document.structured.employerName || '',
            contractType: document.structured.contractType || '',
            startDate: document.structured.startDate || '',
            emissionDate: document.structured.emissionDate || '',
            monthIndex: document.structured.monthIndex || null,
            year: document.structured.year || null,
            grossSalary: document.structured.grossSalary,
            cotisations: document.structured.cotisations,
            netPay: document.structured.netPay,
            netImposable: document.structured.netImposable,
            cumulativeNetImposable: document.structured.cumulativeNetImposable,
            revenuFiscalReference: document.structured.revenuFiscalReference,
          },
        })),
        deterministicFindings: audit.findings,
      },
    },
    analyzedAt: new Date(),
  };
}

function buildGeminiPayload(payload, documents, deterministic, config) {
  return {
    candidate: {
      firstName: payload.candidature?.firstName || '',
      lastName: payload.candidature?.lastName || '',
      contractType: payload.candidature?.contractType || '',
      monthlyNetIncome: payload.candidature?.monthlyNetIncome || 0,
      submissionDate: payload.candidature?.createdAt || null,
    },
    property: {
      city: payload.property?.city || '',
      zipCode: payload.property?.zipCode || '',
      rentAmount: payload.property?.rentAmount || 0,
      chargesAmount: payload.property?.chargesAmount || 0,
    },
    thresholds: config.thresholds,
    deterministic_precheck: {
      fraudScore: deterministic.fraudScore,
      fraudStatus: deterministic.fraudStatus,
      workflowDecision: deterministic.workflowDecision,
      explicitCritical: deterministic.explicitCritical,
      processingUncertainty: deterministic.hasProcessingUncertainty,
      dossierPartial: deterministic.dossierPartial,
      findings: deterministic.findings,
    },
    documents: documents.map((document) => ({
      originalName: document.originalName,
      classification: document.classification,
      ocr_excerpt: document.ocr.text.slice(0, 3000),
      technical_metadata: {
        provider: document.metadata.provider || 'unknown',
        creator: document.metadata.creator || document.metadata.Creator || '',
        producer: document.metadata.producer || document.metadata.Producer || '',
        creationDate: document.metadata.creationDate || '',
        modificationDate: document.metadata.modificationDate || '',
        suspicious: Boolean(document.metadata.suspicious),
      },
      extracted: document.structured,
    })),
  };
}

async function buildPhase1Audit(input, options = {}) {
  const config = getPhase1AuditConfig(options.config || {});
  const payload = input.candidature ? input : { candidature: input.candidature || input, property: input.property || {}, documents: input.documents || input.docs || [] };
  const candidature = payload.candidature || {};
  const documentsInput = Array.isArray(payload.documents)
    ? payload.documents
    : Array.isArray(candidature.docs)
      ? candidature.docs
      : [];

  const processedDocuments = await Promise.all(
    documentsInput.map((document) => processDocument(document, candidature, config, options.adapters || {}))
  );

  const deterministicAssessment = buildDeterministicAssessment(payload, processedDocuments, config);
  const deterministicVerdict = deriveDeterministicVerdict(deterministicAssessment, config);
  const geminiPayload = buildGeminiPayload(payload, processedDocuments, deterministicVerdict, config);
  const geminiResult = await callGeminiArbiter(geminiPayload, config, options.adapters || {});
  const mergedAudit = mergeAuditDecisions(deterministicVerdict, geminiResult, config);

  mergedAudit.engine = {
    ...(mergedAudit.engine || {}),
    ocr: processedDocuments.length
      ? unique(processedDocuments.map((document) => document.ocr.provider)).join(', ')
      : 'none',
    metadata: processedDocuments.length
      ? unique(processedDocuments.map((document) => document.metadata.provider || 'unknown')).join(', ')
      : 'none',
    geminiModel: config.geminiModel,
  };

  const trustAnalysis = buildTrustAnalysisFromAudit(processedDocuments, mergedAudit, config);

  return {
    trustAnalysis,
    audit: mergedAudit,
    documents: processedDocuments,
  };
}

async function runPhase1Audit(input, options = {}) {
  const { trustAnalysis } = await buildPhase1Audit(input, options);
  return trustAnalysis;
}

module.exports = {
  buildPhase1Audit,
  buildTrustAnalysisFromAudit,
  classifyDocument,
  deriveDeterministicVerdict,
  extractStructuredData,
  runPhase1Audit,
};
