import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Application = require('@/models/Application');

export const GET = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id, docId } = await ctx.params;

  const app = await Application.findById(id).select('documents').lean();
  if (!app) throw new AdminHttpError(404, 'Candidature introuvable');

  const doc = (app as any).documents?.find((d: any) => String(d.id) === String(docId));
  if (!doc) throw new AdminHttpError(404, 'Document introuvable');
  if (!doc.fileUrl) throw new AdminHttpError(404, 'Fichier introuvable');

  // fileUrl peut être une URL externe ou un chemin local
  if (doc.fileUrl.startsWith('http://') || doc.fileUrl.startsWith('https://')) {
    await logAdminAction({
      actor: admin,
      action: 'application.document_download',
      targetType: 'Application',
      targetId: id,
      before: null,
      after: { docId, fileUrl: doc.fileUrl, external: true },
      req,
    });
    return NextResponse.redirect(doc.fileUrl);
  }

  // Chemin local : résoudre depuis cwd
  const relPath = doc.fileUrl.replace(/^\/+/, '');
  const filePath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) {
    throw new AdminHttpError(404, 'Fichier introuvable sur disque');
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.pdf' ? 'application/pdf' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.png' ? 'image/png' :
    'application/octet-stream';

  await logAdminAction({
    actor: admin,
    action: 'application.document_download',
    targetType: 'Application',
    targetId: id,
    before: null,
    after: { docId, fileName: doc.fileName },
    req,
  });

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${doc.fileName || 'document'}${ext}"`,
      'Cache-Control': 'no-store',
    },
  });
});
