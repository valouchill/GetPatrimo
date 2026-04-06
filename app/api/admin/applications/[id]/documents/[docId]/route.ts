import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { ApplicationDocumentPatchSchema } from '@/lib/validations/admin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Application = require('@/models/Application');

export const PATCH = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  await connectDiditDb();
  const { id, docId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = ApplicationDocumentPatchSchema.safeParse(body);
  if (!parsed.success) throw new AdminHttpError(400, 'Données invalides');

  const app = await Application.findById(id).select('documents').lean();
  if (!app) throw new AdminHttpError(404, 'Candidature introuvable');

  const existing = (app as any).documents?.find((d: any) => String(d.id) === String(docId));
  if (!existing) throw new AdminHttpError(404, 'Document introuvable');

  const res = await Application.updateOne(
    { _id: id, 'documents.id': docId },
    {
      $set: {
        'documents.$.status': parsed.data.status,
        ...(parsed.data.flaggedReason !== undefined ? { 'documents.$.flaggedReason': parsed.data.flaggedReason } : {}),
      },
    }
  );

  if (res.matchedCount === 0) throw new AdminHttpError(404, 'Document non trouvé');

  await logAdminAction({
    actor: admin,
    action: 'application.document_status',
    targetType: 'Application',
    targetId: id,
    before: { docId, status: existing.status },
    after: { docId, status: parsed.data.status, flaggedReason: parsed.data.flaggedReason },
    note: `doc=${docId}`,
    req,
  });

  return NextResponse.json({ ok: true });
});
