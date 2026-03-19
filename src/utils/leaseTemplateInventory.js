const fs = require('fs');
const path = require('path');

const PizZip = require('pizzip');

const TEMPLATE_DIRECTORIES = [
  process.env.DOC2LOC_TEMPLATE_DIR
    ? path.resolve(process.env.DOC2LOC_TEMPLATE_DIR)
    : path.resolve(process.cwd(), 'templates'),
  process.env.DOC2LOC_CURSOR_TEMPLATE_DIR
    ? path.resolve(process.env.DOC2LOC_CURSOR_TEMPLATE_DIR)
    : path.resolve(process.cwd(), '.cursor', 'templates'),
];

const inventoryCache = new Map();

function resolveTemplatePath(templateName) {
  for (const directory of TEMPLATE_DIRECTORIES) {
    const candidate = path.join(directory, templateName);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Template introuvable: ${templateName}`);
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

function extractVariablesFromXml(xml) {
  const normalized = decodeXmlEntities(String(xml || '').replace(/<[^>]+>/g, ''));
  return [...normalized.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

function extractTemplateVariables(templateName) {
  if (inventoryCache.has(templateName)) {
    return inventoryCache.get(templateName);
  }

  const templatePath = resolveTemplatePath(templateName);
  const zip = new PizZip(fs.readFileSync(templatePath));
  const variables = new Set();

  Object.keys(zip.files)
    .filter((fileName) => fileName.endsWith('.xml'))
    .forEach((fileName) => {
      const xml = zip.file(fileName)?.asText() || '';
      extractVariablesFromXml(xml).forEach((variable) => variables.add(variable));
    });

  const extracted = Array.from(variables).sort();
  inventoryCache.set(templateName, extracted);
  return extracted;
}

function getVariablesForTemplates(templateNames = []) {
  const variables = new Set();

  templateNames
    .filter(Boolean)
    .forEach((templateName) => {
      extractTemplateVariables(templateName).forEach((variable) => variables.add(variable));
    });

  return Array.from(variables).sort();
}

module.exports = {
  TEMPLATE_DIRECTORIES,
  extractTemplateVariables,
  getVariablesForTemplates,
  resolveTemplatePath,
};
