import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Property from '@/models/Property';

 
const User = require('@/models/User');
 
const Document = require('@/models/Document');

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

const ALLOWED_TYPES = new Set([
  'BAIL', 'ETAT_DES_LIEUX', 'DIAGNOSTIC', 'QUITTANCE', 'QUITTANCE_LOYER',
  'DPE', 'PLOMB', 'AMIANTE', 'ELECTRICITE', 'GAZ', 'ERP', 'BOUTIN',
  'ANNEXES_TECHNIQUES', 'AUTRE',
]);

const META_ONLY_TYPES: Record<string, string> = {
  FACTURE_TRAVAUX: 'AUTRE',
  ASSURANCE: 'AUTRE',
};

type Signature = { ext: string; bytes: number[]; mime: string };
const MAGIC: Signature[] = [
  { ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },
];

function detectSignature(buffer: Buffer): Signature | null {
  return MAGIC.find((sig) => sig.bytes.every((b, i) => buffer[i] === b)) || null;
}

/**
 * POST /api/owner/properties/[id]/documents
 * Upload d'un document attaché au bien (bail, EDL, diagnostic, quittance, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const property = await Property.findOne({ _id: id, user: userId }).select('_id').lean();
    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawType = String(formData.get('type') || '').toUpperCase().trim();
    const expirationDate = formData.get('expirationDate');
    const documentDate = formData.get('documentDate');

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 });
    }

    // Résoudre type effectif (+ éventuel documentType en metadata)
    let effectiveType = 'AUTRE';
    let metaDocumentType = '';
    if (ALLOWED_TYPES.has(rawType)) {
      effectiveType = rawType;
    } else if (META_ONLY_TYPES[rawType]) {
      effectiveType = META_ONLY_TYPES[rawType];
      metaDocumentType = rawType;
    } else if (rawType) {
      return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 });
    }

    // Valider magic bytes
    const buffer = Buffer.from(await file.arrayBuffer());
    const sig = detectSignature(buffer);
    if (!sig) {
      return NextResponse.json(
        { error: 'Type de fichier non autorisé (PDF, JPEG, PNG, WebP uniquement)' },
        { status: 400 }
      );
    }

    // Écrire sur disque
    const uploadsDir = path.join(process.cwd(), 'uploads', 'property-documents');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const uuid = crypto.randomUUID();
    const filename = `doc-${Date.now()}-${uuid}.${sig.ext}`;
    const absPath = path.join(uploadsDir, filename);
    fs.writeFileSync(absPath, buffer);

    const parseDate = (v: unknown) => {
      if (!v || typeof v !== 'string') return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const doc = await Document.create({
      user: userId,
      property: id,
      type: effectiveType,
      originalName: file.name || filename,
      filename,
      mimeType: sig.mime,
      size: file.size,
      relPath: 'property-documents/' + filename,
      expirationDate: parseDate(expirationDate),
      documentDate: parseDate(documentDate),
      metadata: metaDocumentType ? { documentType: metaDocumentType } : {},
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: String(doc._id),
        type: doc.type,
        metaDocumentType: metaDocumentType || null,
        originalName: doc.originalName,
        size: doc.size,
        createdAt: doc.createdAt,
        expirationDate: doc.expirationDate || null,
        downloadUrl: `/api/owner/properties/${id}/documents/${doc._id}`,
      },
    });
  } catch (e) {
    logger.error('POST /api/owner/properties/[id]/documents', {
      error: e instanceof Error ? e.message : e,
    });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
