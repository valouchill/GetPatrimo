import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');

/**
 * GET /api/leases
 * Returns all leases for the authenticated owner.
 */
export const GET = withErrorHandler(async () => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const properties = await Property.find({ user: user._id }).select('_id').lean();
  const propertyIds = properties.map((p: { _id: unknown }) => p._id);

  const leases = await Lease.find({ property: { $in: propertyIds } })
    .populate('property', 'name address')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ success: true, data: leases });
});
