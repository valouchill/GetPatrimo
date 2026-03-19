import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runPhase1Healthcheck } = require('@/src/services/phase1HealthService');

function parseAdminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();

    let user = null;
    if (session?.user?.id) {
      user = await User.findById(session.user.id).select('email').lean();
    }
    if (!user && session?.user?.email) {
      user = await User.findOne({ email: session.user.email }).select('email').lean();
    }
    if (!user?.email) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }

    const adminEmails = parseAdminEmails();
    if (!adminEmails.length) {
      return NextResponse.json({ error: 'Admin non configuré' }, { status: 403 });
    }

    if (!adminEmails.includes(String(user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedMode = String(searchParams.get('mode') || '').toLowerCase();
    const liveParam = String(searchParams.get('live') || '').toLowerCase();
    const mode =
      requestedMode === 'config' || liveParam === '0' || liveParam === 'false'
        ? 'config'
        : 'live';

    const result = await runPhase1Healthcheck({ mode });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error: any) {
    console.error('GET /api/trust/phase1/health', error);
    return NextResponse.json(
      {
        ok: false,
        mode: 'live',
        checkedAt: new Date().toISOString(),
        error: error?.message || 'Erreur healthcheck Phase 1',
      },
      { status: 500 }
    );
  }
}
