import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import fs from 'fs/promises';
import path from 'path';

 
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

function safeAbsPath(relPath: string): string | null {
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  const candidate = path.resolve(uploadsDir, relPath);
  if (!candidate.startsWith(uploadsDir + path.sep)) return null;
  return candidate;
}

/**
 * GET /api/owner/properties/[id]/documents/[docId]
 * Télécharge un document attaché au bien.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
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

    const { id, docId } = await params;
    const doc = await Document.findOne({ _id: docId, user: userId, property: id }).lean();
    if (!doc) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    }

    const relPath = String(doc.relPath || '').replace(/^\/+/, '');
    if (!relPath.startsWith('property-documents/') || relPath.includes('..')) {
      return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 });
    }

    const absPath = safeAbsPath(relPath);
    if (!absPath) {
      return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 });
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(absPath);
    } catch {
      return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
    }

    const originalName = String(doc.originalName || doc.filename || 'document').replace(/"/g, '');
    const mimeType = doc.mimeType || 'application/octet-stream';

    const body = new Uint8Array(buffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${originalName}"`,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    logger.error('GET /api/owner/properties/[id]/documents/[docId]', {
      error: e instanceof Error ? e.message : e,
    });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/**
 * DELETE /api/owner/properties/[id]/documents/[docId]
 * Supprime un document attaché au bien (fichier disque + Mongo).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
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

    const { id, docId } = await params;
    const doc = await Document.findOne({ _id: docId, user: userId, property: id });
    if (!doc) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    }

    const relPath = String(doc.relPath || '').replace(/^\/+/, '');
    if (relPath.startsWith('property-documents/') && !relPath.includes('..')) {
      const absPath = safeAbsPath(relPath);
      if (absPath) {
        try {
          await fs.unlink(absPath);
        } catch {
          // fichier déjà absent — on continue
        }
      }
    }

    await Document.deleteOne({ _id: docId });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error('DELETE /api/owner/properties/[id]/documents/[docId]', {
      error: e instanceof Error ? e.message : e,
    });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
