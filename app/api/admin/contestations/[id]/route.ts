/**
 * PATCH /api/admin/contestations/[id] — clôture d'une contestation art. 22 (AIPD M11).
 * Trace le réexamen humain : note + auteur + horodatage, journalisé en audit admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { connectDiditDb } from '@/app/api/didit/db';

const Contestation = require('@/models/Contestation');

export const PATCH = withAdmin(async (req: NextRequest, ctx: any, admin) => {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) throw new AdminHttpError(400, 'Identifiant invalide');

  const body = await req.json().catch(() => ({}));
  const reviewNote = String(body.reviewNote || '').trim().slice(0, 2000);
  if (!reviewNote) throw new AdminHttpError(400, 'reviewNote requis (trace du réexamen humain)');

  await connectDiditDb();
  const contestation = await Contestation.findById(id);
  if (!contestation) throw new AdminHttpError(404, 'Contestation introuvable');

  const before = { status: contestation.status };
  contestation.status = 'REVIEWED';
  contestation.reviewNote = reviewNote;
  contestation.reviewedBy = admin.email;
  contestation.reviewedAt = new Date();
  await contestation.save();

  await logAdminAction({
    actor: admin,
    action: 'CONTESTATION_REVIEWED',
    targetType: 'Contestation',
    targetId: contestation._id,
    before,
    after: { status: 'REVIEWED' },
    note: 'Réexamen humain art. 22 RGPD',
    req,
  });

  return NextResponse.json({ success: true });
});
