const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const Property = require('../../models/Property');
const Candidature = require('../../models/Candidature');
const Application = require('../../models/Application');
const Guarantor = require('../../models/Guarantor');
const User = require('../../models/User');
const { uploadsDir } = require('../config/app');
const { buildLeaseArtifacts, getSoftFallbackValue } = require('../utils/leaseDataBuilder');
const {
  getVariablesForTemplates,
  resolveTemplatePath,
} = require('../utils/leaseTemplateInventory');
const {
  deriveLeaseType,
  shouldGenerateGuaranteeDocument,
} = require('../utils/leaseWizardShared');

const COMPILED_DIR = path.join(uploadsDir, 'leases', 'compiled');
fs.mkdirSync(COMPILED_DIR, { recursive: true });

const TEMPLATE_MAP = {
  VIDE: 'Modele_Bail_Type_Location_Vide_loi_ALUR_template.docx',
  MEUBLE: 'Modele_Bail_Type_Location_Meublee_loi_Alur_template.docx',
  MOBILITE: 'Modele_type_bail_mobilite_template.docx',
  GARAGE_PARKING: 'Modele_Bail_Location_Garage_Parking_template.docx',
  GUARANTEE: 'acte_caution_solidaire_template.docx',
};

function sanitizeFileSegment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'document';
}

function createDoc(buffer) {
  const zip = new PizZip(buffer);
  return new Docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    linebreaks: true,
    paragraphLoop: true,
    nullGetter(part) {
      return getSoftFallbackValue(part?.value);
    },
  });
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#xa0;/g, ' ')
    .replace(/&#10;/g, '\n');
}

function extractDocxText(docxBuffer) {
  try {
    const zip = new PizZip(docxBuffer);
    const xml = zip.file('word/document.xml')?.asText() || '';
    return decodeXmlEntities(
      xml
        .replace(/<w:p[^>]*>/g, '\n')
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<[^>]+>/g, '')
    )
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch (error) {
    return '';
  }
}

function splitTextIntoLines(text, maxCharsPerLine = 92) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const rawLines = normalized.split('\n');
  const lines = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
        continue;
      }

      if (current) {
        lines.push(current);
      }
      current = word;
    }

    if (current) {
      lines.push(current);
    }
  }

  return lines;
}

async function renderTextPdfBuffer(title, text) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595.28, 841.89]);

  const margin = 50;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const titleSize = 18;
  const bodySize = 10;
  const lineHeight = 14;
  let cursorY = pageHeight - margin;

  page.drawText(String(title || 'Document'), {
    x: margin,
    y: cursorY,
    size: titleSize,
    font: boldFont,
    color: rgb(0.08, 0.12, 0.2),
  });

  cursorY -= 28;

  const lines = splitTextIntoLines(text || 'Document genere automatiquement.');
  for (const line of lines) {
    if (cursorY <= margin + 20) {
      cursorY = pageHeight - margin;
      pdfDoc.addPage([595.28, 841.89]);
    }
    const targetPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    targetPage.drawText(line || ' ', {
      x: margin,
      y: cursorY,
      size: bodySize,
      font: regularFont,
      color: rgb(0.18, 0.2, 0.26),
      maxWidth: pageWidth - margin * 2,
    });
    cursorY -= lineHeight;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

function convertDocxWithLibreOffice(docxBuffer) {
  const binaries = ['soffice', 'libreoffice'];

  for (const binary of binaries) {
    try {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc2loc-lease-'));
      const inputPath = path.join(tempDir, 'input.docx');
      const outputPath = path.join(tempDir, 'input.pdf');
      fs.writeFileSync(inputPath, docxBuffer);

      const result = spawnSync(binary, [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        tempDir,
        inputPath,
      ], { encoding: 'utf8' });

      if (result.status === 0 && fs.existsSync(outputPath)) {
        const pdfBuffer = fs.readFileSync(outputPath);
        fs.rmSync(tempDir, { recursive: true, force: true });
        return pdfBuffer;
      }

      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Fallback géré plus bas.
    }
  }

  return null;
}

async function convertDocxToPdfBuffer(docxBuffer, title) {
  const libreOfficeBuffer = convertDocxWithLibreOffice(docxBuffer);
  if (libreOfficeBuffer) return libreOfficeBuffer;

  const extractedText = extractDocxText(docxBuffer);
  return renderTextPdfBuffer(title, extractedText);
}

function persistArtifact(userId, baseName, extension, buffer) {
  const fileName = `${sanitizeFileSegment(userId)}-${baseName}.${extension}`;
  const absolutePath = path.join(COMPILED_DIR, fileName);
  fs.writeFileSync(absolutePath, buffer);
  return {
    fileName,
    absolutePath,
    relativePath: path.join('uploads', 'leases', 'compiled', fileName),
  };
}

function normalizeApplication(application) {
  const guarantorRecord = application?.guarantor?.guarantorId || null;
  const primaryGuaranteeSlot = Array.isArray(application?.guarantee?.guarantors)
    ? application.guarantee.guarantors.find((slot) => slot?.slot === 1) || application.guarantee.guarantors[0] || null
    : null;
  const fallbackGuarantor = guarantorRecord || primaryGuaranteeSlot;

  return {
    source: 'application',
    id: String(application?._id || ''),
    firstName: application?.profile?.firstName || application?.didit?.identityData?.firstName || '',
    lastName: application?.profile?.lastName || application?.didit?.identityData?.lastName || '',
    email: application?.userEmail || '',
    phone: application?.profile?.phone || '',
    birthDate: application?.profile?.birthDate || application?.didit?.identityData?.birthDate || '',
    monthlyIncome: Number(application?.financialSummary?.totalMonthlyIncome || 0) || 0,
    contractType: application?.financialSummary?.incomeSource || '',
    guarantor: fallbackGuarantor && String(application?.guarantee?.mode || '').toUpperCase() !== 'VISALE'
      ? {
          firstName: fallbackGuarantor.firstName || '',
          lastName: fallbackGuarantor.lastName || '',
          email: fallbackGuarantor.email || '',
          birthDate: fallbackGuarantor.identityVerification?.birthDate || fallbackGuarantor.birthDate || '',
        }
      : null,
    raw: application,
  };
}

function normalizeCandidature(candidature, guarantor) {
  return {
    source: 'candidature',
    id: String(candidature?._id || ''),
    firstName: candidature?.firstName || '',
    lastName: candidature?.lastName || '',
    email: candidature?.email || '',
    phone: candidature?.phone || '',
    birthDate: candidature?.identityVerification?.birthDate || '',
    monthlyIncome: Number(candidature?.monthlyNetIncome || 0) || 0,
    contractType: candidature?.contractType || '',
    guarantor: guarantor
      ? {
          firstName: guarantor.firstName || '',
          lastName: guarantor.lastName || '',
          email: guarantor.email || '',
          birthDate: guarantor.identityVerification?.birthDate || '',
        }
      : null,
    raw: candidature,
  };
}

async function resolveTenant({ property, userId, applicationId, candidatureId }) {
  if (applicationId || property?.acceptedTenantId) {
    const resolvedApplicationId = applicationId || property.acceptedTenantId;
    const application = await Application.findById(resolvedApplicationId)
      .populate('guarantor.guarantorId')
      .lean();

    if (application && String(application.property || '') === String(property._id)) {
      return normalizeApplication(application);
    }
  }

  if (candidatureId) {
    const candidature = await Candidature.findOne({
      _id: candidatureId,
      property: property._id,
      user: userId,
    }).lean();

    if (!candidature) {
      throw new Error('Candidature introuvable pour ce bien');
    }

    const guarantor = candidature.hasGuarantor
      ? await Guarantor.findOne({
          candidature: candidature._id,
        }).lean()
      : null;

    return normalizeCandidature(candidature, guarantor);
  }

  throw new Error('Aucun locataire exploitable trouvé pour ce bien');
}

function buildSecureUrl(fileName) {
  return `/api/leases/compiled/${encodeURIComponent(fileName)}`;
}

async function buildCompiledDocument({ kind, templateName, title, data, userId, leaseType }) {
  const templatePath = resolveTemplatePath(templateName);
  const templateBuffer = fs.readFileSync(templatePath);
  const doc = createDoc(templateBuffer);
  doc.render(data);

  const docxBuffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  const pdfBuffer = await convertDocxToPdfBuffer(docxBuffer, title);

  const baseName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${sanitizeFileSegment(leaseType)}-${kind}`;
  const docxFile = persistArtifact(userId, baseName, 'docx', docxBuffer);
  const pdfFile = persistArtifact(userId, baseName, 'pdf', pdfBuffer);

  return {
    kind,
    template: templateName,
    title,
    fileName: docxFile.fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    docxBuffer,
    pdfBuffer,
    docxPath: docxFile.relativePath,
    pdfPath: pdfFile.relativePath,
    secureUrl: buildSecureUrl(docxFile.fileName),
    pdfUrl: buildSecureUrl(pdfFile.fileName),
  };
}

async function prepareLeaseCompilation({
  propertyId,
  applicationId,
  candidatureId,
  formData = {},
  userId,
}) {
  if (!propertyId) {
    throw new Error('propertyId requis');
  }
  if (!userId) {
    throw new Error('userId requis');
  }

  const property = await Property.findOne({ _id: propertyId, user: userId }).lean();
  if (!property) {
    throw new Error('Bien introuvable');
  }

  const landlord = await User.findById(userId).lean();
  if (!landlord) {
    throw new Error('Bailleur introuvable');
  }

  const tenant = await resolveTenant({
    property,
    userId,
    applicationId,
    candidatureId,
  });

  const leaseType = deriveLeaseType(property, formData.leaseType);
  const documentPlan = [
    {
      kind: 'LEASE',
      templateName: TEMPLATE_MAP[leaseType] || TEMPLATE_MAP.VIDE,
      title: `Bail ${leaseType.toLowerCase()}`,
    },
  ];

  if (shouldGenerateGuaranteeDocument(leaseType, {
    ...(tenant.guarantor || {}),
    ...((formData && formData.guarantorOverrides) || {}),
  })) {
    documentPlan.push({
      kind: 'GUARANTEE',
      templateName: TEMPLATE_MAP.GUARANTEE,
      title: 'Acte de caution solidaire',
    });
  }

  const templateVariables = getVariablesForTemplates(documentPlan.map((document) => document.templateName));
  const { rawData, mergeData, warnings } = buildLeaseArtifacts(
    property,
    tenant,
    landlord,
    { ...formData, leaseType },
    templateVariables,
  );

  const signerRoles = ['tenant', 'owner'];
  if (documentPlan.some((document) => document.kind === 'GUARANTEE')) {
    signerRoles.splice(1, 0, 'guarantor');
  }

  return {
    property,
    landlord,
    tenant,
    leaseType,
    documentPlan,
    templateVariables,
    rawData,
    mergeData,
    warnings,
    compileMeta: {
      leaseType,
      hasGuarantee: documentPlan.some((document) => document.kind === 'GUARANTEE'),
      signerRoles,
      warnings,
    },
  };
}

async function compileLeaseBundle(options) {
  const prepared = await prepareLeaseCompilation(options);
  const { documentPlan, mergeData, leaseType, compileMeta } = prepared;
  const documents = [];

  for (const document of documentPlan) {
    documents.push(await buildCompiledDocument({
      kind: document.kind,
      templateName: document.templateName,
      title: document.title,
      data: mergeData,
      userId: options.userId,
      leaseType,
    }));
  }

  return {
    ...prepared,
    leaseData: mergeData,
    documents,
    compileMeta,
  };
}

module.exports = {
  COMPILED_DIR,
  TEMPLATE_MAP,
  compileLeaseBundle,
  extractDocxText,
  prepareLeaseCompilation,
};
