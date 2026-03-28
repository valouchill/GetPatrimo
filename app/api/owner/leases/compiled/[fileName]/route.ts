import { promises as fs } from 'fs';
import path from 'path';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { COMPILED_DIR } = require('@/src/services/leaseCompileService');

function sanitizeFileSegment(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'document';
}

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

function getContentType(fileName: string) {
  if (fileName.endsWith('.pdf')) return 'application/pdf';
  if (fileName.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ msg: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ msg: 'Utilisateur introuvable' }, { status: 401 });
    }

    const userPrefix = `${sanitizeFileSegment(userId)}-`;
    const { fileName: rawFileName } = await params;
    const fileName = path.basename(String(rawFileName || ''));

    if (!fileName.startsWith(userPrefix)) {
      return NextResponse.json({ msg: 'Accès refusé' }, { status: 403 });
    }

    const absolutePath = path.join(COMPILED_DIR, fileName);

    // Protection path traversal
    const resolvedPath = path.resolve(absolutePath);
    const resolvedDir = path.resolve(COMPILED_DIR);
    if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== resolvedDir) {
      return NextResponse.json({ msg: 'Chemin non autorise' }, { status: 403 });
    }

    const fileBuffer = await fs.readFile(absolutePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': getContentType(fileName),
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ msg: 'Fichier introuvable' }, { status: 404 });
    }

    console.error('GET /api/owner/leases/compiled/[fileName]', error);
    return NextResponse.json({ msg: 'Erreur serveur' }, { status: 500 });
  }
}
