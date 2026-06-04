/**
 * POST /api/owner/notifications/read
 *
 * Marque une liste de notification IDs comme "lues" pour l'owner connecté.
 * Persistance dans User.readNotificationIds (cross-device).
 *
 * Body : { ids: string[] }
 * Réponse : { ok: true, readCount: number }
 *
 * Auto-eviction : si on dépasse 500 IDs en cache, on garde les 500 plus récents
 * (FIFO via slice). Les IDs sont strings opaques (ex: "alert-69aed9da", "lease-69ae88bd").
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';

 
const User = require('@/models/User');

const MAX_READ_IDS = 500;

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email })
      .select('_id')
      .lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectDiditDb();

    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const ids: unknown = (body as { ids?: unknown })?.ids;
    if (!Array.isArray(ids)) {
      return NextResponse.json(
        { error: "Body invalide : 'ids' doit être un tableau de strings" },
        { status: 400 },
      );
    }
    const validIds = ids.filter(
      (id): id is string => typeof id === 'string' && id.length > 0 && id.length < 200,
    );

    if (validIds.length === 0) {
      return NextResponse.json({ ok: true, readCount: 0 });
    }

    // Lit l'etat actuel, fusionne, applique FIFO eviction si > MAX
    const user = (await User.findById(userId)
      .select('readNotificationIds')
      .lean()) as { readNotificationIds?: string[] } | null;

    const current = user?.readNotificationIds || [];
    const merged = [...current.filter((id) => !validIds.includes(id)), ...validIds];
    const capped =
      merged.length > MAX_READ_IDS
        ? merged.slice(merged.length - MAX_READ_IDS)
        : merged;

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          readNotificationIds: capped,
          notificationsReadAt: new Date(),
        },
      },
    );

    return NextResponse.json(
      { ok: true, readCount: capped.length },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    logger.error('POST /api/owner/notifications/read', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
