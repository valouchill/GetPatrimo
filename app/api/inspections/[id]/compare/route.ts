import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler, withFeatureGuard } from '@/lib/with-error-handler';

 
const User = require('@/models/User');
 
const Inspection = require('@/models/Inspection');
 
const Lease = require('@/models/Lease');

/**
 * GET /api/inspections/[id]/compare
 * Compare an EXIT inspection with its matching ENTRY inspection.
 */

/**
 * Échelle de vétusté normalisée (0 = neuf → 4 = hors service).
 *
 * Le modèle accepte DEUX vocabulaires (nouveau + legacy) mais la comparaison ne
 * connaissait que le legacy : un état saisi « MAUVAIS_ETAT » / « HORS_SERVICE »
 * dans le wizard n'était JAMAIS remonté comme dégradation → retenues sur dépôt
 * silencieusement perdues.
 */
const CONDITION_RANK: Record<string, number> = {
  TRES_BON: 0, GOOD: 0,
  BON: 1,
  USAGE_NORMAL: 2, NORMAL_WEAR: 2,
  MAUVAIS_ETAT: 3, DEGRADED: 3,
  HORS_SERVICE: 4, NEEDS_RENOVATION: 4,
};
const CONDITION_LABEL: Record<string, string> = {
  TRES_BON: 'Très bon état', GOOD: 'Bon état',
  BON: 'Bon état',
  USAGE_NORMAL: 'Usage normal', NORMAL_WEAR: 'Usage normal',
  MAUVAIS_ETAT: 'Mauvais état', DEGRADED: 'Dégradé',
  HORS_SERVICE: 'Hors service', NEEDS_RENOVATION: 'À rénover',
};
function conditionRank(value?: string): number {
  return CONDITION_RANK[String(value || 'BON').toUpperCase()] ?? 1;
}
/** Dégradation imputable = état détérioré ET au-delà de l'usure normale. */
function isDegradation(entryVal?: string, exitVal?: string): boolean {
  const from = conditionRank(entryVal);
  const to = conditionRank(exitVal);
  return to > from && to >= 3;
}

const _GET = withErrorHandler(async (
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
    const degradations: { item: string; entry: string; exit: string ; severity?: 'MEDIUM' | 'HIGH' }[] = [];

    for (const field of ['wallCondition', 'floorCondition', 'ceilingCondition'] as const) {
      const entryVal = entryRoom?.[field] || 'BON';
      const exitVal = exitRoom[field] || 'BON';
      if (isDegradation(entryVal, exitVal)) {
        degradations.push({
          item: field === 'wallCondition' ? 'Murs' : field === 'floorCondition' ? 'Sol' : 'Plafond',
          entry: CONDITION_LABEL[String(entryVal).toUpperCase()] || entryVal,
          exit: CONDITION_LABEL[String(exitVal).toUpperCase()] || exitVal,
          severity: conditionRank(exitVal) >= 4 ? 'HIGH' : 'MEDIUM',
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

// Le module EDL est gaté par le flag EDL : les routes renvoient 404 s'il est off
// (helper withFeatureGuard, jusqu'ici jamais câblé → API ouvertes malgré le flag).
export const GET = withFeatureGuard('EDL', _GET);
