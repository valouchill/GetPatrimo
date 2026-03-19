import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Candidature = require('@/models/Candidature');

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }

    const { id } = await params;
    const candidature = await Candidature.findOne({ _id: id, user: userId }).lean();

    if (!candidature) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      _id: candidature._id.toString(),
      property: candidature.property ? String(candidature.property) : null,
      firstName: candidature.firstName || '',
      lastName: candidature.lastName || '',
      email: candidature.email || '',
      phone: candidature.phone || '',
      monthlyNetIncome: candidature.monthlyNetIncome || 0,
      contractType: candidature.contractType || '',
      guarantorType: candidature.guarantorType || '',
      hasGuarantor: candidature.hasGuarantor || false,
      status: candidature.status,
    });
  } catch (error) {
    console.error('GET /api/owner/candidatures/[id]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
