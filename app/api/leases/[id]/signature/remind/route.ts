import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

const Lease = require('@/models/Lease');
const User = require('@/models/User');
const { resendInviteToCurrentSigner } = require('@/src/services/leaseSignatureService');

/**
 * POST /api/leases/[id]/signature/remind — renvoie son lien au signataire courant.
 *
 * Le token brut n'est jamais stocké (seul son SHA-256 l'est) : le renvoi
 * régénère donc un token frais, ce qui prolonge la validité et ressuscite au
 * passage une campagne dont le lien avait expiré. C'est le recours du bailleur
 * quand l'email initial s'est perdu (inviteError) ou que le signataire tarde.
 */
export const POST = withErrorHandler(async (_request: NextRequest, ctx: any) => {
  const { id } = await ctx.params;
  const session = (await getServerSession(authOptions as never)) as
    | { user?: { email?: string } }
    | null;
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  await connectDiditDb();
  const user = await User.findOne({ email: session.user.email }).select('_id').lean();
  if (!user?._id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const lease = await Lease.findById(id).select('user leaseStatus').lean();
  if (!lease) return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });
  if (String(lease.user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  try {
    const { sentTo, role } = await resendInviteToCurrentSigner(id);
    return NextResponse.json({ success: true, sentTo, role });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Renvoi impossible.' },
      { status: 400 },
    );
  }
});
