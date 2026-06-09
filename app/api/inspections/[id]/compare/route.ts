import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

 
const User = require('@/models/User');
 
const Inspection = require('@/models/Inspection');
 
const Lease = require('@/models/Lease');

/**
 * GET /api/inspections/[id]/compare
 * Compare an EXIT inspection with its matching ENTRY inspection.
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

  const exitInspection = await Inspection.findById(id)
    .populate('property', 'name address')
    .populate('lease', 'tenantFirstName tenantLastName depositAmount')
    .lean();

  if (!exitInspection) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  // Sécurité (re-audit V1 — N4 IDOR) : l'inspection doit appartenir à l'utilisateur.
  if (String((exitInspection as { user?: unknown }).user) !== String((session.user as { id?: string }).id)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (exitInspection.type !== 'EXIT') {
    return NextResponse.json({ error: 'Seul un EDL de sortie peut être comparé' }, { status: 400 });
  }

  // Find matching entry inspection for the same lease
  const entryInspection = await Inspection.findOne({
    lease: exitInspection.lease?._id || exitInspection.lease,
    type: 'ENTRY',
    status: { $in: ['COMPLETED', 'SIGNED'] },
  })
    .populate('property', 'name address')
    .lean();

  // Build comparison
  const exitRooms = exitInspection.rooms || [];
  const entryRooms = entryInspection?.rooms || [];
  const depositAmount = (exitInspection.lease as { depositAmount?: number })?.depositAmount || 0;

  const roomComparisons = exitRooms.map((exitRoom: {
    name: string;
    wallCondition: string;
    floorCondition: string;
    ceilingCondition: string;
    photos?: { url: string }[];
    comment?: string;
  }) => {
    const entryRoom = entryRooms.find((r: { name: string }) => r.name === exitRoom.name);
    const degradations: { item: string; entry: string; exit: string }[] = [];

    for (const field of ['wallCondition', 'floorCondition', 'ceilingCondition'] as const) {
      const entryVal = entryRoom?.[field] || 'GOOD';
      const exitVal = exitRoom[field] || 'GOOD';
      if (exitVal !== entryVal && (exitVal === 'DEGRADED' || exitVal === 'NEEDS_RENOVATION')) {
        degradations.push({
          item: field === 'wallCondition' ? 'Murs' : field === 'floorCondition' ? 'Sol' : 'Plafond',
          entry: entryVal,
          exit: exitVal,
        });
      }
    }

    return {
      name: exitRoom.name,
      entry: entryRoom ? {
        wallCondition: entryRoom.wallCondition,
        floorCondition: entryRoom.floorCondition,
        ceilingCondition: entryRoom.ceilingCondition,
        photos: entryRoom.photos || [],
      } : null,
      exit: {
        wallCondition: exitRoom.wallCondition,
        floorCondition: exitRoom.floorCondition,
        ceilingCondition: exitRoom.ceilingCondition,
        photos: exitRoom.photos || [],
      },
      degradations,
      hasDegradation: degradations.length > 0,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      entryInspection: entryInspection ? {
        _id: entryInspection._id,
        date: entryInspection.date,
        meterReadings: entryInspection.meterReadings,
      } : null,
      exitInspection: {
        _id: exitInspection._id,
        date: exitInspection.date,
        meterReadings: exitInspection.meterReadings,
      },
      roomComparisons,
      depositAmount,
      existingRetentions: exitInspection.comparison?.retentions || [],
      totalDegradations: roomComparisons.filter((r: { hasDegradation: boolean }) => r.hasDegradation).length,
    },
  });
});
