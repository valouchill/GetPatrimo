import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

 
const User = require('@/models/User');
 
const Lease = require('@/models/Lease');
 
const Property = require('@/models/Property');
 
const { logEvent } = require('@/src/services/eventService');

/**
 * POST /api/leases/[id]/renew
 * Renew an expiring/expired lease. Applies IRL revision if enabled.
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const lease = await Lease.findById(id).lean();
  if (!lease) return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });

  // Verify ownership
  const property = await Property.findById(lease.property).lean();
  if (!property || String((property as { user: unknown }).user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  // Calculate new rent with IRL revision if enabled
  let newRent = lease.rentAmount;
  const irlRevision = lease.irlRevision;
  if (irlRevision?.enabled && irlRevision?.referenceIndex != null && irlRevision?.lastIndex != null && irlRevision.lastIndex !== 0) {
    // IRL formula: new_rent = old_rent × (new_index / old_index)
    newRent = Math.round(lease.rentAmount * (irlRevision.referenceIndex / irlRevision.lastIndex) * 100) / 100;
  }

  // Calculate new dates
  const oldEnd = lease.endDate ? new Date(lease.endDate) : new Date();
  const newStart = new Date(oldEnd);
  newStart.setDate(newStart.getDate() + 1);

  const durationMonths = lease.durationMonths || 12;
  const newEnd = new Date(newStart);
  newEnd.setMonth(newEnd.getMonth() + durationMonths);

  // Create renewed lease
  const renewedLease = await Lease.create({
    user: lease.user,
    property: lease.property,
    applicationId: lease.applicationId,
    candidature: lease.candidature,
    source: lease.source || 'FLOW',
    tenantFirstName: lease.tenantFirstName,
    tenantLastName: lease.tenantLastName,
    tenantEmail: lease.tenantEmail,
    tenantPhone: lease.tenantPhone || '',
    startDate: newStart,
    endDate: newEnd,
    rentAmount: newRent,
    chargesAmount: lease.chargesAmount || 0,
    depositAmount: lease.depositAmount || 0,
    leaseType: lease.leaseType,
    propertyType: lease.propertyType,
    paymentDay: lease.paymentDay || 5,
    durationMonths,
    additionalClauses: lease.additionalClauses || '',
    leaseStatus: 'DRAFT',
    guarantor: lease.guarantor || {},
    irlRevision: irlRevision ? {
      ...irlRevision,
      lastIndex: irlRevision.referenceIndex,
      lastRevisionDate: new Date(),
    } : undefined,
    specificClauses: lease.specificClauses || {},
    previousLeaseId: lease._id,
    renewalCount: (lease.renewalCount || 0) + 1,
  });

  // Mark old lease as expired
  await Lease.updateOne({ _id: id }, { $set: { leaseStatus: 'EXPIRED' } });

  logEvent(String(user._id), {
    property: lease.property,
    type: 'lease_renewed',
    meta: {
      oldLeaseId: id,
      newLeaseId: String(renewedLease._id),
      oldRent: lease.rentAmount,
      newRent,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: renewedLease._id.toString(),
      previousRent: lease.rentAmount,
      newRent,
      startDate: newStart,
      endDate: newEnd,
    },
  });
});
