/**
 * GET /api/public/dossier/[slug]/[docType]
 *
 * Endpoint public (sans auth) pour la page de réception des Smart Links
 * du Passeport Locatif V2. Permet à un propriétaire prospect qui clique
 * sur un lien du PDF de visualiser une catégorie de pièces (avec
 * filigrane) AVANT de créer son compte.
 *
 * Mécanique d'acquisition :
 *   - Le PDF expose des liens type /dossier/{passportSlug}/cni
 *   - Cette page récupère les pièces de la catégorie demandée
 *   - Affichage avec filigrane + CTA "Créer mon Coffre-Fort"
 *
 * Sécurité :
 *   - passportSlug non-énumérable (PT-2026-XXXX, 4 chars random sans 0/1/I/O)
 *   - Pas de fileUrl exposé (uniquement aiInsights + métadonnées)
 *   - Logging de l'IP pour traçabilité (anti-scraping)
 *   - Rate-limit minimal (à durcir en V2)
 *
 * Catégories supportées (docType) :
 *   - cni / identite → IDENTITY
 *   - revenus / paie → INCOME (fiches de paie)
 *   - impots / fiscal → INCOME (avis d'imposition)
 *   - domicile → ADDRESS
 *   - garant → GUARANTOR
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import { checkRateLimit } from '@/lib/rate-limit';
import Application from '@/models/Application';
import { resolveResilienceScore } from '@/lib/resilience-score';

type DocType = 'cni' | 'identite' | 'revenus' | 'paie' | 'impots' | 'fiscal' | 'domicile' | 'garant';
type Category = 'IDENTITY' | 'INCOME' | 'ADDRESS' | 'GUARANTOR';

interface AppDocument {
  id?: string;
  _id?: string;
  category?: string;
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

function mapDocTypeToCategory(docType: string): Category | null {
  const t = docType.toLowerCase();
  if (t === 'cni' || t === 'identite' || t === 'identité') return 'IDENTITY';
  if (t === 'revenus' || t === 'paie' || t === 'impots' || t === 'impôts' || t === 'fiscal')
    return 'INCOME';
  if (t === 'domicile') return 'ADDRESS';
  if (t === 'garant') return 'GUARANTOR';
  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLegacyPassportExpr(slug: string) {
  // Sécurité (pentest public-9) : n'autoriser le repli legacy QUE pour les 24 hex EXACTS d'un
  // ObjectId (plus de suffixe partiel devinable). On reconstruit une égalité indexée sur _id
  // au lieu d'un scan $regexMatch.
  const match = /^PT-\d{4}-([A-Fa-f0-9]{24})$/.exec(slug);
  if (!match) return null;
  return { _id: match[1].toLowerCase() };
}

function mapStatusToAudit(status?: string, flagged?: boolean): string {
  const upper = (status || '').toUpperCase();
  if (upper === 'CERTIFIED' && !flagged) return 'verified';
  if (upper === 'REJECTED') return 'altered';
  if (upper === 'NEEDS_REVIEW' || upper === 'FLAGGED' || flagged) return 'manual_review';
  return 'pending';
}

function extractAiInsights(doc: AppDocument) {
  const ai = doc.aiAnalysis || {};
  let extractedFields: Record<string, unknown> = {};
  const raw = ai.extractedFields as unknown;
  if (raw && typeof raw === 'object') {
    if (raw instanceof Map) {
      extractedFields = Object.fromEntries(raw);
    } else {
      extractedFields = raw as Record<string, unknown>;
    }
  }
  return {
    documentType: typeof ai.documentType === 'string' ? ai.documentType : null,
    confidence: typeof ai.confidence === 'number' ? ai.confidence : null,
    summary: typeof ai.summary === 'string' ? ai.summary : null,
    fraudScore: typeof ai.fraudScore === 'number' ? ai.fraudScore : null,
    flags: Array.isArray(ai.flags) ? ai.flags.filter((f) => typeof f === 'string') : [],
    extractedFields,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; docType: string }> },
) {
  try {
    // Anti-scraping (pré-lancement) : endpoint public de consultation de pièces. Borne par IP.
    const rlIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`public-dossier:${rlIp}`, { windowMs: 60_000, max: 60 }).allowed) {
      return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
    }
    await connectDiditDb();

    const { slug, docType } = await params;

    // Validation slug : PT-{4-30 chars alphanumériques avec tirets}
    if (!slug || !/^[A-Z0-9-]{6,40}$/i.test(slug)) {
      return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
    }

    const category = mapDocTypeToCategory(docType);
    if (!category) {
      return NextResponse.json(
        { error: 'Catégorie inconnue' },
        { status: 400 },
      );
    }

    // Lookup par passportSlug (priorité) OU fallback legacy via passportId
    // visuel PT-YYYY-{last8(_id)} généré dans d'anciens PDFs.
    const legacyExpr = buildLegacyPassportExpr(slug);
    const lookupOr: Array<Record<string, unknown>> = [
      { passportSlug: slug },
      { 'passport.id': slug },
    ];
    if (legacyExpr) lookupOr.push(legacyExpr);

    const application = await Application.findOne({
      $or: lookupOr,
    })
      .populate('property', 'name')
      .select('passportSlug documents profile patrimometer property')
      .lean();

    if (!application) {
      logger.warn('GET /api/public/dossier — slug introuvable', { slug });
      return NextResponse.json(
        { error: 'Passeport introuvable' },
        { status: 404 },
      );
    }

    // Trace IP / UA pour anti-scraping (V2 : rate-limit Redis)
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    logger.info('GET /api/public/dossier — accès public', {
      slug,
      docType,
      category,
      ip: typeof ip === 'string' ? ip.split(',')[0]?.trim() : 'unknown',
    });

    const docs: AppDocument[] = Array.isArray((application as any).documents)
      ? (application as any).documents
      : [];

    // Filtre par catégorie + type spécifique pour 'impots' (avis fiscal)
    // vs 'revenus' (fiches de paie) — tous deux ont category=INCOME
    const filtered = docs.filter((doc) => {
      const docCat = (doc.category || '').toUpperCase();
      if (docCat !== category) return false;

      const docType_low = docType.toLowerCase();
      const t = (doc.type || '').toUpperCase();
      if (docType_low === 'impots' || docType_low === 'impôts' || docType_low === 'fiscal') {
        return t.includes('IMPOSITION') || t.includes('FISCAL') || t.includes('AVIS');
      }
      if (docType_low === 'revenus' || docType_low === 'paie') {
        return t.includes('BULLETIN') || t.includes('PAIE') || t.includes('SALAIRE') || !t.includes('IMPOSITION');
      }
      return true;
    });

    // Mapping sans exposer fileUrl (sécurité : la pièce ne peut pas être
    // téléchargée hors plateforme depuis cet endpoint public)
    const documents = filtered.map((doc) => ({
      id: String(doc.id || doc._id || ''),
      name: doc.fileName || doc.type || 'Document',
      category: doc.category,
      auditStatus: mapStatusToAudit(doc.status, doc.flagged),
      // URL volontairement absente — l'aperçu IA seul est exposé.
      // L'aperçu synthétique (extractedFields) suffit côté propriétaire prospect.
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
    }));

    const profile = (application as any).profile || {};
    const resilience = resolveResilienceScore(application);

    return NextResponse.json(
      {
        slug: (application as any).passportSlug || slug,
        docType,
        category,
        candidate: {
          firstName: profile.firstName || null,
          // Sécurité (revue V1 — S19) : on n'expose PAS le nom complet avant inscription
          // (le champ `fullName` fuitait l'identité du candidat sur cet endpoint public).
          lastInitial: profile.lastName ? `${profile.lastName[0]}.` : null,
        },
        score: resilience.score,
        grade: resilience.level,
        resilience,
        propertyName: (application as any).property?.name || null,
        documents,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    logger.error('GET /api/public/dossier/[slug]/[docType]', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du dossier' },
      { status: 500 },
    );
  }
}
