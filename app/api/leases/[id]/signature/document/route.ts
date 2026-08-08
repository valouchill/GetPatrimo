import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs';
import path from 'path';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

const Lease = require('@/models/Lease');
const User = require('@/models/User');

/**
 * GET /api/leases/[id]/signature/document — le bail signé (PDF + certificat),
 * côté BAILLEUR (le locataire passe par son lien /sign/[token]/document).
 *
 * Jusqu'ici le bailleur n'avait AUCUN moyen de télécharger le document final :
 * `signedPdfPath` n'était servi que par la route publique à token.
 */
export const GET = withErrorHandler(async (_request: NextRequest, ctx: any) => {
  const { id } = await ctx.params;
  const session = (await getServerSession(authOptions as never)) as
    | { user?: { email?: string } }
    | null;
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  await connectDiditDb();
  const user = await User.findOne({ email: session.user.email }).select('_id').lean();
  if (!user?._id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const lease = await Lease.findById(id).select('user signedPdfPath tenantLastName').lean();
  if (!lease) return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });
  if (String(lease.user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }
  if (!lease.signedPdfPath) {
    return NextResponse.json({ error: 'Le bail signé n’est pas encore disponible.' }, { status: 404 });
  }

  // Confinement : même règle que la route publique (uploads/ uniquement).
  const uploadsRoot = path.join(process.cwd(), 'uploads');
  const abs = path.resolve(
    path.isAbsolute(lease.signedPdfPath)
      ? lease.signedPdfPath
      : path.join(process.cwd(), lease.signedPdfPath),
  );
  if (!abs.startsWith(uploadsRoot + path.sep) || !fs.existsSync(abs)) {
    return NextResponse.json({ error: 'Document indisponible.' }, { status: 404 });
  }

  const fileName = `bail-signe-${String(lease.tenantLastName || 'maison-patrimo').toLowerCase()}.pdf`;
  return new NextResponse(new Uint8Array(fs.readFileSync(abs)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^a-z0-9._-]/gi, '_')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
