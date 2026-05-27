/**
 * GET /api/owner/applications/[id]/documents
 *
 * Retourne la liste des pièces d'une candidature pour le propriétaire
 * (avec validation que la candidature appartient à un bien dont il est
 * propriétaire). Utilisé par <CandidateDossier> dans la modale d'audit
 * candidat pour afficher la Trust-List.
 *
 * Réponse :
 *   { documents: [{ id, name, type, transmissionStatus, auditStatus,
 *                   auditMessage, url }, ...] }
 *
 * Le mapping LocalDocument (Mongo) → DossierDocument (UI) est fait ici :
 *   - category IDENTITY → type 'ID'
 *   - category INCOME → type 'FINANCE'
 *   - category ADDRESS → type 'ADDRESS'
 *   - category GUARANTOR → type 'PRO'
 *   - status CERTIFIED + !flagged → auditStatus 'verified'
 *   - status NEEDS_REVIEW / FLAGGED → 'manual_review'
 *   - status REJECTED → 'altered'
 *   - status ANALYZING / PENDING → 'pending'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Application from '@/models/Application';
import Property from '@/models/Property';

type AuditStatus = 'verified' | 'manual_review' | 'altered' | 'pending';
type DocType = 'ID' | 'FINANCE' | 'PRO' | 'ADDRESS' | 'OTHER';

interface AppDocument {
  id?: string;
  _id?: string;
  category?: string;
  type?: string;
  fileName?: string;
  fileUrl?: string;
  status?: string;
  flagged?: boolean;
  aiAnalysis?: Record<string, unknown> & {
    documentType?: string;
    confidence?: number;
    summary?: string;
    fraudScore?: number;
    flags?: string[];
    extractedFields?: Record<string, unknown> | Map<string, unknown>;
    detectedSoftware?: string;
    auditSummary?: string;
  };
  uploadedAt?: string | Date;
  dateEmission?: string;
}

function mapCategoryToType(category?: string): DocType {
  switch ((category || '').toUpperCase()) {
    case 'IDENTITY':
      return 'ID';
    case 'INCOME':
      return 'FINANCE';
    case 'ADDRESS':
      return 'ADDRESS';
    case 'GUARANTOR':
      return 'PRO';
    default:
      return 'OTHER';
  }
}

function mapStatusToAudit(status?: string, flagged?: boolean): AuditStatus {
  const upper = (status || '').toUpperCase();
  if (upper === 'CERTIFIED' && !flagged) return 'verified';
  if (upper === 'REJECTED') return 'altered';
  if (upper === 'NEEDS_REVIEW' || upper === 'FLAGGED' || flagged) return 'manual_review';
  return 'pending';
}

function deriveAuditMessage(doc: AppDocument, auditStatus: AuditStatus): string {
  // Privilégier le summary de l'IA si présent
  const aiSummary = doc.aiAnalysis?.auditSummary;
  if (typeof aiSummary === 'string' && aiSummary.length > 5) return aiSummary;

  const detected = doc.aiAnalysis?.detectedSoftware;
  if (typeof detected === 'string' && detected.length > 0) {
    return `Logiciel détecté : ${detected}`;
  }

  // Messages par défaut adaptés au statut
  switch (auditStatus) {
    case 'verified':
      return 'Document authentifié par l\'audit forensic IA.';
    case 'altered':
      return 'Anomalie structurelle détectée — pièce rejetée par l\'IA.';
    case 'manual_review':
      return 'Quelques points à vérifier visuellement avant validation.';
    case 'pending':
    default:
      return 'Analyse en cours.';
  }
}

function deriveDocumentName(doc: AppDocument): string {
  if (doc.fileName) return doc.fileName;
  const cat = (doc.category || '').toUpperCase();
  if (cat === 'IDENTITY') return "Pièce d'identité";
  if (cat === 'INCOME') return 'Justificatif de revenus';
  if (cat === 'ADDRESS') return 'Justificatif de domicile';
  if (cat === 'GUARANTOR') return 'Document garant';
  return doc.type || 'Document';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDiditDb();

    const session = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;

    // Récupère l'application avec son property associé
    const app = await Application.findById(id)
      .select('property documents profile')
      .lean();

    if (!app) {
      return NextResponse.json(
        { error: 'Candidature introuvable' },
        { status: 404 },
      );
    }

    // Validation ownership : la property doit appartenir au session.user
    const property = await Property.findById((app as any).property)
      .select('owner')
      .lean();

    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    const userId = (session as any)?.user?.id || (session as any)?.user?._id;
    const propertyOwner = String((property as any).owner || '');
    if (userId && propertyOwner && String(userId) !== propertyOwner) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Mapping documents
    const rawDocuments: AppDocument[] = Array.isArray((app as any).documents)
      ? (app as any).documents
      : [];

    const documents = rawDocuments.map((doc) => {
      const auditStatus = mapStatusToAudit(doc.status, doc.flagged);
      const ai = doc.aiAnalysis || {};

      // V5.12 — Extraction des champs IA pour aperçu synthétique côté UI.
      // Permet d'afficher un rapport quand fileUrl est absent ou format non
      // prévisualisable. Mongo Map → object plain pour la sérialisation JSON.
      let extractedFields: Record<string, unknown> = {};
      const raw = ai.extractedFields as unknown;
      if (raw && typeof raw === 'object') {
        if (raw instanceof Map) {
          extractedFields = Object.fromEntries(raw);
        } else {
          extractedFields = raw as Record<string, unknown>;
        }
      }

      const uploadedAt =
        doc.uploadedAt instanceof Date
          ? doc.uploadedAt.toISOString()
          : typeof doc.uploadedAt === 'string'
          ? doc.uploadedAt
          : null;

      return {
        id: String(doc.id || doc._id || ''),
        name: deriveDocumentName(doc),
        type: mapCategoryToType(doc.category),
        // Présent en DB → reçu. Manquant ailleurs (logique simplifiée V1).
        transmissionStatus: 'received' as const,
        auditStatus,
        auditMessage: deriveAuditMessage(doc, auditStatus),
        url: doc.fileUrl || null,
        // V5.12 — Données IA pour aperçu synthétique
        fileName: doc.fileName || null,
        uploadedAt,
        dateEmission: doc.dateEmission || null,
        aiInsights: {
          documentType: typeof ai.documentType === 'string' ? ai.documentType : null,
          confidence: typeof ai.confidence === 'number' ? ai.confidence : null,
          summary: typeof ai.summary === 'string' ? ai.summary : null,
          fraudScore: typeof ai.fraudScore === 'number' ? ai.fraudScore : null,
          flags: Array.isArray(ai.flags) ? ai.flags.filter((f: unknown) => typeof f === 'string') : [],
          extractedFields,
        },
      };
    });

    return NextResponse.json({ documents });
  } catch (error) {
    logger.error('GET /api/owner/applications/[id]/documents', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des pièces' },
      { status: 500 },
    );
  }
}
