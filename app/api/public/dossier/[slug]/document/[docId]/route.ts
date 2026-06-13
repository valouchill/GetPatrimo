import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import Application from '@/models/Application';
import { resolveResilienceScore } from '@/lib/resilience-score';

type AuditStatus = 'verified' | 'manual_review' | 'altered' | 'pending';

interface AppDocument {
  id?: string;
  _id?: string;
  category?: string;
  subjectType?: string;
  subjectSlot?: number;
  type?: string;
  fileName?: string;
  fileUrl?: string;
  status?: string;
  flagged?: boolean;
  aiAnalysis?: {
    documentType?: string;
    confidence?: number;
    summary?: string;
    fraudScore?: number;
    flags?: string[];
    extractedFields?: Record<string, unknown> | Map<string, unknown>;
  };
  uploadedAt?: string | Date;
  dateEmission?: string;
}

function mapStatusToAudit(status?: string, flagged?: boolean): AuditStatus {
  const upper = (status || '').toUpperCase();
  if (upper === 'CERTIFIED' && !flagged) return 'verified';
  if (upper === 'REJECTED' || upper === 'ILLEGIBLE') return 'altered';
  if (upper === 'NEEDS_REVIEW' || upper === 'FLAGGED' || flagged) return 'manual_review';
  return 'pending';
}

function extractAiInsights(doc: AppDocument) {
  const ai = doc.aiAnalysis || {};
  // Sécurité (audit passe-5) : on N'EXPOSE PAS les champs OCR bruts (`extractedFields` :
  // salaire exact, employeur, adresse, n° fiscal…) sur cet endpoint PUBLIC non authentifié.
  // Seuls les signaux d'affichage de haut niveau (type, confiance, synthèse, score de fraude)
  // sont renvoyés — la preuve documentaire détaillée reste réservée à l'accès authentifié.
  return {
    documentType: typeof ai.documentType === 'string' ? ai.documentType : null,
    confidence: typeof ai.confidence === 'number' ? ai.confidence : null,
    summary: typeof ai.summary === 'string' ? ai.summary : null,
    fraudScore: typeof ai.fraudScore === 'number' ? ai.fraudScore : null,
    flags: Array.isArray(ai.flags) ? ai.flags.filter((f) => typeof f === 'string') : [],
  };
}

function isPrimaryTenantDocument(doc: AppDocument) {
  const subjectType = String(doc.subjectType || 'TENANT').toUpperCase();
  if (subjectType === 'GUARANTOR' || subjectType === 'VISALE') return false;
  const category = String(doc.category || '').toUpperCase();
  const type = String(doc.type || '').toUpperCase();
  if (category === 'GUARANTOR' || category === 'VISALE') return false;
  if (type === 'GUARANTOR' || type === 'VISALE') return false;
  const slot = Number(doc.subjectSlot || 1);
  return !Number.isFinite(slot) || slot <= 1;
}

function isValidPublicDocumentId(docId: string) {
  return /^doc-\d{1,4}$/i.test(docId) || /^[A-Z0-9_-]{2,80}$/i.test(docId);
}

function getDocumentId(doc: AppDocument) {
  return String(doc.id || doc._id || '').trim();
}

function findPublicDocument(docs: AppDocument[], docId: string) {
  const primaryDocuments = docs.filter(isPrimaryTenantDocument);
  return primaryDocuments.find((doc, index) => (
    docId === `doc-${index + 1}` || getDocumentId(doc) === docId
  ));
}

function getDocumentName(doc: AppDocument) {
  const aiType = doc.aiAnalysis?.documentType;
  if (typeof aiType === 'string' && aiType.trim()) return aiType.trim();
  return doc.fileName || doc.type || 'Document';
}

async function findApplicationByPassportSlug(slug: string) {
  // Sécurité (audit passe-5, HIGH) : résolution UNIQUEMENT par slug 64-bit (ou passport.id).
  // L'ancien matcher legacy `PT-\d{4}-<suffixe ObjectId>` permettait d'énumérer n'importe quel
  // dossier en brute-forçant 6-24 hex de l'_id (contournement de l'anti-énumération du slug).
  return Application.findOne({ $or: [{ passportSlug: slug }, { 'passport.id': slug }] })
    .populate('property', 'name')
    .select('passportSlug documents profile patrimometer property aiAuditV2')
    .lean();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; docId: string }> },
) {
  try {
    // Sécurité (audit passe-5) : endpoint PUBLIC non authentifié → limite de débit par IP
    // (anti-énumération / anti-DB-scan). Le slug est à 64 bits mais on borne quand même.
    const rlIp =
      request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    if (!checkRateLimit(`pubdoc:${rlIp}`, { windowMs: 60_000, max: 30 }).allowed) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }

    await connectDiditDb();

    const { slug, docId } = await params;
    if (!slug || !/^[A-Z0-9-]{6,80}$/i.test(slug)) {
      return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
    }
    if (!docId || !isValidPublicDocumentId(docId)) {
      return NextResponse.json({ error: 'Document invalide' }, { status: 400 });
    }

    const application = await findApplicationByPassportSlug(slug);
    if (!application) {
      logger.warn('GET /api/public/dossier/document — slug introuvable', { slug });
      return NextResponse.json({ error: 'Passeport introuvable' }, { status: 404 });
    }

    const docs: AppDocument[] = Array.isArray((application as any).documents)
      ? (application as any).documents
      : [];
    const doc = findPublicDocument(docs, docId);

    if (!doc) {
      logger.warn('GET /api/public/dossier/document — document introuvable', {
        slug,
        docId,
      });
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    }

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    logger.info('GET /api/public/dossier/document — accès public', {
      slug,
      docId,
      category: doc.category || null,
      ip: typeof ip === 'string' ? ip.split(',').pop()?.trim() : 'unknown',
    });

    const profile = (application as any).profile || {};
    const resilience = resolveResilienceScore(application);

    return NextResponse.json(
      {
        slug: (application as any).passportSlug || slug,
        docId,
        category: doc.category || null,
        candidate: {
          firstName: profile.firstName || null,
          lastInitial: profile.lastName ? `${profile.lastName[0]}.` : null,
        },
        score: resilience.score,
        grade: resilience.level,
        resilience,
        propertyName: (application as any).property?.name || null,
        document: {
          id: docId,
          name: getDocumentName(doc),
          category: doc.category || null,
          type: doc.type || null,
          auditStatus: mapStatusToAudit(doc.status, doc.flagged),
          url: null,
          fileName: doc.fileName || null,
          uploadedAt:
            doc.uploadedAt instanceof Date
              ? doc.uploadedAt.toISOString()
              : typeof doc.uploadedAt === 'string'
              ? doc.uploadedAt
              : null,
          dateEmission: doc.dateEmission || null,
          aiInsights: extractAiInsights(doc),
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    logger.error('GET /api/public/dossier/[slug]/document/[docId]', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du document' },
      { status: 500 },
    );
  }
}
