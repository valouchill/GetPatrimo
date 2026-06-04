import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import fs from 'fs';
import path from 'path';

 
const User = require('@/models/User');
 
const Inspection = require('@/models/Inspection');

/**
 * GET /api/inspections/[id]/pdf
 * Download the generated inspection PDF.
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const { id } = await params;

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  const inspection = await Inspection.findById(id).lean();
  if (!inspection) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (String(inspection.user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
  }

  if (!inspection.pdfUrl) {
    return NextResponse.json({ error: 'PDF non encore genere' }, { status: 404 });
  }

  // Resolve file path safely
  const pdfPath = inspection.pdfUrl.startsWith('/')
    ? path.join(process.cwd(), inspection.pdfUrl)
    : path.join(process.cwd(), 'uploads', 'edl', inspection.pdfUrl);

  const resolvedPath = path.resolve(pdfPath);
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!resolvedPath.startsWith(uploadsDir)) {
    return NextResponse.json({ error: 'Chemin non autorise' }, { status: 403 });
  }

  if (!fs.existsSync(resolvedPath)) {
    return NextResponse.json({ error: 'Fichier PDF introuvable' }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolvedPath);
  const fileName = `edl-${inspection.type || 'inspection'}-${id}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
