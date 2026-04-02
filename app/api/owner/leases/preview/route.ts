import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prepareLeaseCompilation, TEMPLATE_MAP } = require('@/src/services/leaseCompileService');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveTemplatePath } = require('@/src/utils/leaseTemplateInventory');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { deriveLeaseType } = require('@/src/utils/leaseWizardShared');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isMissingValue } = require('@/src/utils/leaseDataBuilder');

function decodeXmlEntities(value: string): string {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#xa0;/g, ' ')
    .replace(/&#10;/g, '\n');
}

interface TemplateVariable {
  name: string;
  start: number;
  end: number;
}

interface TemplateParagraph {
  text: string;
  variables: TemplateVariable[];
}

function extractParagraphsFromTemplate(templatePath: string): TemplateParagraph[] {
  const buffer = fs.readFileSync(templatePath);
  const zip = new PizZip(buffer);
  const xml = zip.file('word/document.xml')?.asText() || '';

  // Extract full <w:p ...>...</w:p> blocks using regex
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const paragraphs: TemplateParagraph[] = [];
  let paraMatch;

  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];

    // Extract only text from <w:t> tags (the actual text content in DOCX)
    const textParts: string[] = [];
    const wtRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let wtMatch;
    while ((wtMatch = wtRegex.exec(paraXml)) !== null) {
      textParts.push(decodeXmlEntities(wtMatch[1]));
    }

    // Also handle tabs
    const tabCount = (paraXml.match(/<w:tab\/>/g) || []).length;
    if (tabCount > 0 && textParts.length === 0) continue;

    const text = textParts.join('').trim();
    if (!text) continue;

    // Find all {{ variable }} occurrences with positions
    const variables: TemplateVariable[] = [];
    const varRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
    let match;
    while ((match = varRegex.exec(text)) !== null) {
      variables.push({
        name: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    paragraphs.push({ text, variables });
  }

  return paragraphs;
}

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const dbUser = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = dbUser?._id?.toString();
  }
  return userId || null;
}

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }

    const body = await request.json();
    const { propertyId, applicationId, candidatureId, formData } = body;

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId requis' }, { status: 400 });
    }

    // Get resolved variable data from existing service
    const prepared = await prepareLeaseCompilation({
      propertyId,
      applicationId: applicationId || undefined,
      candidatureId: candidatureId || undefined,
      formData: formData || {},
      userId,
    });

    // Extract template paragraphs
    const leaseType = deriveLeaseType(prepared.property, formData?.leaseType);
    const templateName = TEMPLATE_MAP[leaseType] || TEMPLATE_MAP.VIDE;
    const templatePath = resolveTemplatePath(templateName);
    const paragraphs = extractParagraphsFromTemplate(templatePath);

    // Count filled vs total variables
    const allVarNames = prepared.templateVariables || [];
    const filledVariables = allVarNames.filter(
      (v: string) => !isMissingValue(prepared.rawData?.[v])
    ).length;

    return NextResponse.json({
      paragraphs,
      mergeData: prepared.mergeData || {},
      rawData: prepared.rawData || {},
      totalVariables: allVarNames.length,
      filledVariables,
      warnings: prepared.warnings || [],
      compileMeta: prepared.compileMeta || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('[preview]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
