import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { logger } from '@/lib/server-logger';
import crypto from 'crypto';
import fsSync from 'fs';
import path from 'path';

 
const User = require('@/models/User');
 
const Inspection = require('@/models/Inspection');
 
const Lease = require('@/models/Lease');
 
const Property = require('@/models/Property');

/**
 * GET /api/inspections/[id]
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  await connectDiditDb();

  const inspection = await Inspection.findById(id)
    .populate('property', 'name address')
    .populate('lease', 'tenantFirstName tenantLastName tenantEmail depositAmount')
    .lean();

  if (!inspection) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  return NextResponse.json({ success: true, data: inspection });
});

/**
 * PATCH /api/inspections/[id]
 * Update an inspection (add rooms, signatures, status, etc.)
 */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const inspection = await Inspection.findById(id);
  if (!inspection) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (String(inspection.user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  // Update allowed fields
  const { rooms, meterReadings, signatures, status, comparison, keysDelivered } = body;
  if (rooms !== undefined) inspection.rooms = rooms;
  if (meterReadings !== undefined) inspection.meterReadings = meterReadings;
  if (keysDelivered !== undefined) inspection.keysDelivered = keysDelivered;
  if (status !== undefined) inspection.status = status;
  if (comparison !== undefined) inspection.comparison = comparison;

  // Save Base64 signature data to file instead of storing in DB
  if (signatures !== undefined) {
    const savedSigs = { ...signatures };
    for (const role of ['owner', 'tenant'] as const) {
      const sigData = savedSigs[role]?.data;
      if (sigData && typeof sigData === 'string' && sigData.startsWith('data:image/')) {
        const sigDir = path.join(process.cwd(), 'uploads', 'signatures');
        if (!fsSync.existsSync(sigDir)) fsSync.mkdirSync(sigDir, { recursive: true });

        const ext = sigData.includes('image/png') ? 'png' : 'jpg';
        const fileName = `edl-${id}-${role}-${crypto.randomUUID()}.${ext}`;
        const filePath = path.join(sigDir, fileName);

        const base64Data = sigData.replace(/^data:image\/\w+;base64,/, '');
        fsSync.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        savedSigs[role] = { ...savedSigs[role], data: `/uploads/signatures/${fileName}` };
      }
    }
    inspection.signatures = savedSigs;
  }

  // Validate signatures before completion (loi ALUR art. 3-2 — état des lieux contradictoire)
  if (status === 'COMPLETED') {
    if (!inspection.signatures?.owner?.data || !inspection.signatures?.tenant?.data) {
      return NextResponse.json(
        { error: 'L\'état des lieux doit être signé par les deux parties avant d\'être finalisé (loi ALUR art. 3-2).' },
        { status: 400 }
      );
    }
  }

  await inspection.save();

  // Generate PDF when inspection is completed and no PDF exists yet
  let pdfError: string | null = null;
  if (status === 'COMPLETED' && !inspection.pdfUrl) {
    try {
      const { generateInspectionPdf } = await import('@/lib/services/inspectionPdfService');
      const pdfUrl = await generateInspectionPdf(inspection.toObject());
      inspection.pdfUrl = pdfUrl;
      await inspection.save();
    } catch (e) {
      logger.error('EDL PDF generation failed', { error: e instanceof Error ? e.message : e });
      pdfError = e instanceof Error ? e.message : 'Erreur de génération PDF';
    }
  }

  return NextResponse.json({
    success: true,
    data: inspection.toObject(),
    ...(pdfError && { pdfError }),
  });
});
