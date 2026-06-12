import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { safeUploadsPath } from '@/lib/safe-uploads-path';

 
const Application = require('@/models/Application');

export const GET = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id, docId } = await ctx.params;

  const app = await Application.findById(id).select('documents').lean();
  if (!app) throw new AdminHttpError(404, 'Candidature introuvable');

  const doc = (app as any).documents?.find((d: any) => String(d.id) === String(docId));
  if (!doc) throw new AdminHttpError(404, 'Document introuvable');
  if (!doc.fileUrl) throw new AdminHttpError(404, 'Fichier introuvable');

  // Sécurité (pentest files-5) : une pièce candidat ne doit JAMAIS être une URL externe
  // arbitraire — l'ancien redirect était un open-redirect/SSRF. On refuse.
  if (/^https?:\/\//i.test(String(doc.fileUrl))) {
    throw new AdminHttpError(400, 'Source de pièce non autorisée');
  }

  // Sécurité (pentest files-1) : chemin local CONFINÉ sous uploads/ (fileUrl = donnée
  // candidat → path traversal possible : ../../etc/passwd, /opt/doc2loc/.env, etc.).
  const filePath = safeUploadsPath(doc.fileUrl);
  if (!filePath) {
    throw new AdminHttpError(404, 'Fichier introuvable');
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

  // Anti-injection d'en-tête : neutraliser guillemets/sauts de ligne dans le nom de fichier.
  const safeName = String(doc.fileName || 'document').replace(/[\r\n"\\]/g, '_').slice(0, 120);
  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${safeName}${ext}"`,
      'Cache-Control': 'no-store',
    },
  });
});
