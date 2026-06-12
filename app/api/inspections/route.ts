import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

 
const User = require('@/models/User');
 
const Inspection = require('@/models/Inspection');
 
const Property = require('@/models/Property');
 
const Lease = require('@/models/Lease');
 
const { logEvent } = require('@/src/services/eventService');

/**
 * GET /api/inspections
 * List all inspections for the authenticated owner.
 */
export const GET = withErrorHandler(async () => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const inspections = await Inspection.find({ user: user._id })
    .populate('property', 'name address')
    .populate('lease', 'tenantFirstName tenantLastName tenantEmail startDate endDate')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({ success: true, data: inspections });
});

/**
 * POST /api/inspections
 * Create a new inspection (entry or exit).
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json();
  const { propertyId, leaseId, type, date, meterReadings, rooms } = body;

  if (!propertyId || !leaseId || !type) {
    return NextResponse.json({ error: 'propertyId, leaseId et type sont requis' }, { status: 400 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  // Verify ownership
  const property = await Property.findById(propertyId).lean();
  if (!property || String((property as { user: unknown }).user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  // Sécurité (pentest ChatGPT P2) : vérifier aussi que le bail appartient au même bailleur
  // ET au même bien — sinon on pouvait rattacher un bail tiers connu et fuiter son locataire
  // via le populate des vues d'inspection.
  const lease = await Lease.findOne({ _id: leaseId, property: propertyId, user: user._id }).select('_id').lean();
  if (!lease) {
    return NextResponse.json({ error: 'Bail non autorisé pour ce bien' }, { status: 403 });
  }

  const inspection = await Inspection.create({
    user: user._id,
    property: propertyId,
    lease: leaseId,
    type,
    date: date || new Date(),
    status: rooms?.length > 0 ? 'IN_PROGRESS' : 'DRAFT',
    meterReadings: meterReadings || {},
    rooms: rooms || [],
  });

  logEvent(String(user._id), {
    property: propertyId,
    type: 'inspection_created',
    meta: { inspectionId: String(inspection._id), inspectionType: type },
  });

  return NextResponse.json({ success: true, data: inspection.toObject() });
});
