import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { ReviseSchema } from '@/lib/validations/payment';
import { applyIRLRevision } from '@/lib/services/paymentService';

 
const User = require('@/models/User');

/**
 * POST /api/payments/revise — Applique la révision IRL
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json();
  const result = validateRequest(ReviseSchema, body);
  if (!result.success) return result.response;

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  // Sécurité (re-audit V1 — N3 IDOR) : le bail doit appartenir à l'utilisateur.
  const Lease = require('@/models/Lease');
  const lease = await Lease.findById(result.data.leaseId).select('user').lean();
  if (!lease || String((lease as { user?: unknown }).user) !== String((user as { _id?: unknown })._id)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const revision = await applyIRLRevision(result.data.leaseId, result.data.newIRLIndex, result.data.oldIRLIndex);
  return NextResponse.json({ success: true, data: revision });
});
