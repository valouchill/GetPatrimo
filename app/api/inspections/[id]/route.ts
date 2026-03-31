import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Inspection = require('@/models/Inspection');

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
  const { rooms, meterReadings, signatures, status, comparison } = body;
  if (rooms !== undefined) inspection.rooms = rooms;
  if (meterReadings !== undefined) inspection.meterReadings = meterReadings;
  if (signatures !== undefined) inspection.signatures = signatures;
  if (status !== undefined) inspection.status = status;
  if (comparison !== undefined) inspection.comparison = comparison;

  await inspection.save();

  return NextResponse.json({ success: true, data: inspection.toObject() });
});
