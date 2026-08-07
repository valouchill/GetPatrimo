import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/server-logger';

const Lease = require('@/models/Lease');
const { resolveSignatureByToken } = require('@/src/services/leaseSignatureService');

/**
 * GET /api/public/sign/[token]/document — sert le PDF du bail au signataire.
 * Accès borné par le token de signature (personnel, expirant) : aucune session
 * requise, mais aucun accès sans token valide. Anti-traversal strict.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
    if (!checkRateLimit(`sign-doc:${ip}`, { windowMs: 60_000, max: 30 }).allowed) {
      return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
    }
    const { token } = await ctx.params;
    await connectDiditDb();

    const signature = await resolveSignatureByToken(token);
    if (!signature) return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 404 });

    const lease = await Lease.findById(signature.lease).select('generatedDocuments signedPdfPath').lean();
    if (!lease) return NextResponse.json({ error: 'Bail introuvable.' }, { status: 404 });

    const docs = Array.isArray(lease.generatedDocuments) ? lease.generatedDocuments : [];
    const leaseDoc = docs.find((d: any) => d.kind === 'LEASE') || docs[0];
    const relPath = lease.signedPdfPath || leaseDoc?.pdfPath;
    if (!relPath) return NextResponse.json({ error: 'Document indisponible.' }, { status: 404 });

    // Anti-traversal : le fichier DOIT rester sous <cwd>/uploads.
    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const abs = path.resolve(path.isAbsolute(relPath) ? relPath : path.join(process.cwd(), relPath));
    if (!abs.startsWith(uploadsRoot + path.sep) || !fs.existsSync(abs)) {
      return NextResponse.json({ error: 'Document indisponible.' }, { status: 404 });
    }

    const buffer = fs.readFileSync(abs);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="bail.pdf"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    logger.error('[public-sign] document', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
