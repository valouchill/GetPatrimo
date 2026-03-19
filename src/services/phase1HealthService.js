const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const { getPhase1AuditConfig } = require('../config/phase1Audit');
const { buildPhase1Audit } = require('./phase1AuditService');

const execFileAsync = promisify(execFile);

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function shiftUtcMonths(date, deltaMonths) {
  const shifted = new Date(date.getTime());
  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() + deltaMonths);
  shifted.setUTCDate(28);
  return shifted;
}

function adjustToPreviousWorkingDay(date) {
  const adjusted = new Date(date.getTime());

  while (adjusted.getUTCDay() === 0 || adjusted.getUTCDay() === 6) {
    adjusted.setUTCDate(adjusted.getUTCDate() - 1);
  }

  return adjusted;
}

function toSerializableError(error) {
  if (!error) return 'unknown error';
  return error.message || String(error);
}

async function createTextPdf(filePath, title, lines) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  pdfDoc.setTitle(title);
  pdfDoc.setAuthor('Doc2Loc Healthcheck');
  pdfDoc.setCreator('Doc2Loc Healthcheck');
  pdfDoc.setProducer('pdf-lib');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  let cursorY = 800;
  page.drawText(title, {
    x: 50,
    y: cursorY,
    size: 16,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= 30;

  for (const line of lines) {
    page.drawText(line, {
      x: 50,
      y: cursorY,
      size: 11,
      font,
      color: rgb(0.15, 0.15, 0.15),
      maxWidth: 500,
      lineHeight: 14,
    });
    cursorY -= 18;
  }

  const bytes = await pdfDoc.save();
  await fs.promises.writeFile(filePath, bytes);
}

async function createPhase1HealthFixtures(tempDir, options = {}) {
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const submissionDate = new Date(referenceDate.getTime());
  const payslipDate = adjustToPreviousWorkingDay(shiftUtcMonths(submissionDate, -1));
  const employmentStartDate = shiftUtcMonths(submissionDate, -14);
  const taxEmissionDate = new Date(Date.UTC(submissionDate.getUTCFullYear() - 1, 7, 20));

  const files = {
    identity: path.join(tempDir, 'CNI_Alice_Martin.pdf'),
    payslip: path.join(tempDir, 'Bulletin_Recent_Alice_Martin.pdf'),
    tax: path.join(tempDir, 'Avis_Imposition_Alice_Martin.pdf'),
  };

  await createTextPdf(files.identity, 'Carte nationale d identite', [
    'Nom: Martin',
    'Prenom: Alice',
    'Adresse: 10 rue de Paris 75010 Paris',
    'Numero: ID123456',
  ]);

  await createTextPdf(files.payslip, `Bulletin de salaire ${payslipDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`, [
    'Nom: Martin',
    'Prenom: Alice',
    'Adresse: 10 rue de Paris 75010 Paris',
    'Employeur: ACME SAS',
    `Date d'embauche: ${formatDateOnly(employmentStartDate)}`,
    'Anciennete: 14 mois',
    `Date: ${formatDateOnly(payslipDate)}`,
    'Salaire brut: 3200.00 EUR',
    'Cotisations salariales: 700.00 EUR',
    'Net a payer: 2500.00 EUR',
    'Net imposable: 2600.00 EUR',
    `Cumul annuel net imposable: ${Number(2600 * Math.max(1, payslipDate.getUTCMonth() + 1)).toFixed(2)} EUR`,
  ]);

  await createTextPdf(files.tax, `Avis d imposition ${taxEmissionDate.getUTCFullYear()}`, [
    'Nom: Martin',
    'Prenom: Alice',
    'Adresse: 10 rue de Paris 75010 Paris',
    'Revenu fiscal de reference: 31200 EUR',
    `Date: ${formatDateOnly(taxEmissionDate)}`,
  ]);

  return {
    files,
    referenceDate: submissionDate.toISOString(),
    payload: {
      candidature: {
        _id: 'phase1-healthcheck-candidate',
        firstName: 'Alice',
        lastName: 'Martin',
        monthlyNetIncome: 2500,
        contractType: 'CDI',
        createdAt: submissionDate.toISOString(),
        docs: [],
      },
      property: {
        city: 'Paris',
        zipCode: '75010',
        rentAmount: 900,
        chargesAmount: 100,
      },
      documents: [
        {
          originalName: path.basename(files.identity),
          filePath: files.identity,
          mimeType: 'application/pdf',
        },
        {
          originalName: path.basename(files.payslip),
          filePath: files.payslip,
          mimeType: 'application/pdf',
        },
        {
          originalName: path.basename(files.tax),
          filePath: files.tax,
          mimeType: 'application/pdf',
        },
      ],
    },
  };
}

async function runMetadataCommandCheck(samplePdf, config) {
  if (!config.metadataCommand) {
    return {
      key: 'metadata_command',
      ok: false,
      details: 'FORENSIC_METADATA_COMMAND absent',
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      config.metadataCommand,
      [samplePdf],
      {
        timeout: config.metadataTimeoutMs,
        maxBuffer: 1024 * 1024 * 2,
      }
    );

    const raw = (stdout || stderr || '').trim();
    const parsed = raw ? JSON.parse(raw) : null;
    const creator = parsed?.creator || parsed?.producer || 'n/a';

    return {
      key: 'metadata_command',
      ok: Boolean(parsed),
      details: `creator=${creator}`,
      payload: parsed,
    };
  } catch (error) {
    return {
      key: 'metadata_command',
      ok: false,
      details: toSerializableError(error),
    };
  }
}

function buildConfigStatus(config) {
  return {
    gemini: {
      configured: Boolean(config.geminiApiKey),
      model: config.geminiModel,
    },
    mistral: {
      configured: Boolean(config.mistralApiKey),
      model: config.mistralOcrModel,
    },
    metadata: {
      configured: Boolean(config.metadataCommand),
      command: config.metadataCommand || '',
    },
    thresholds: config.thresholds,
  };
}

async function runPhase1ConfigHealthcheck(options = {}) {
  const config = getPhase1AuditConfig(options.configOverrides || {});
  const status = buildConfigStatus(config);
  const ok = status.gemini.configured && status.mistral.configured && status.metadata.configured;

  return {
    ok,
    mode: 'config',
    checkedAt: new Date().toISOString(),
    config: status,
  };
}

async function runPhase1LiveHealthcheck(options = {}) {
  const config = getPhase1AuditConfig(options.configOverrides || {});
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'doc2loc-phase1-health-'));

  try {
    const fixtures = await createPhase1HealthFixtures(tempDir, {
      referenceDate: options.referenceDate,
    });

    const configChecks = [
      {
        key: 'gemini_api_key',
        ok: Boolean(config.geminiApiKey),
        details: config.geminiApiKey ? `model=${config.geminiModel}` : 'GEMINI_API_KEY absent',
      },
      {
        key: 'mistral_api_key',
        ok: Boolean(config.mistralApiKey),
        details: config.mistralApiKey ? `model=${config.mistralOcrModel}` : 'MISTRAL_API_KEY absent',
      },
      {
        key: 'metadata_command_configured',
        ok: Boolean(config.metadataCommand),
        details: config.metadataCommand || 'absent',
      },
    ];

    const metadataCheck = await runMetadataCommandCheck(fixtures.files.payslip, config);
    const startedAt = Date.now();
    const result = await buildPhase1Audit(fixtures.payload, {
      adapters: options.adapters || {},
      config: options.configOverrides || {},
    });
    const durationMs = Date.now() - startedAt;

    const documents = result.documents || [];
    const phase1 = result.trustAnalysis?.phase1 || {};
    const mistralDocs = documents.filter((document) => document.ocr?.provider === 'mistral');
    const metadataScriptDocs = documents.filter((document) => document.metadata?.provider === 'script');
    const geminiUsed = Boolean(phase1.engine?.geminiUsed);

    const providers = {
      mistralOcr: {
        ok: documents.length > 0 && mistralDocs.length === documents.length,
        usedCount: mistralDocs.length,
        totalDocuments: documents.length,
      },
      metadataScript: {
        ok: documents.length > 0 && metadataScriptDocs.length === documents.length,
        usedCount: metadataScriptDocs.length,
        totalDocuments: documents.length,
      },
      geminiArbiter: {
        ok: geminiUsed,
        model: phase1.engine?.geminiModel || config.geminiModel,
        error: phase1.engine?.geminiError || '',
      },
    };

    const ok =
      configChecks.every((check) => check.ok) &&
      metadataCheck.ok &&
      providers.mistralOcr.ok &&
      providers.metadataScript.ok &&
      providers.geminiArbiter.ok;

    return {
      ok,
      mode: 'live',
      checkedAt: new Date().toISOString(),
      config: buildConfigStatus(config),
      checks: [...configChecks, metadataCheck],
      live: {
        durationMs,
        providers,
        auditSummary: {
          trustScore: result.trustAnalysis?.score,
          trustStatus: result.trustAnalysis?.status,
          fraudScore: phase1.fraudScore,
          fraudStatus: phase1.fraudStatus,
          workflowDecision: phase1.workflowDecision,
          pointsIncoherence: phase1.pointsIncoherence || [],
          engine: phase1.engine || {},
        },
        documentProviders: documents.map((document) => ({
          originalName: document.originalName,
          classification: document.classification,
          ocrProvider: document.ocr?.provider || '',
          metadataProvider: document.metadata?.provider || '',
        })),
      },
    };
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

async function runPhase1Healthcheck(options = {}) {
  const mode = String(options.mode || 'live').toLowerCase();

  try {
    if (mode === 'config') {
      return await runPhase1ConfigHealthcheck(options);
    }

    return await runPhase1LiveHealthcheck(options);
  } catch (error) {
    return {
      ok: false,
      mode,
      checkedAt: new Date().toISOString(),
      error: toSerializableError(error),
    };
  }
}

module.exports = {
  createPhase1HealthFixtures,
  runMetadataCommandCheck,
  runPhase1ConfigHealthcheck,
  runPhase1LiveHealthcheck,
  runPhase1Healthcheck,
};
