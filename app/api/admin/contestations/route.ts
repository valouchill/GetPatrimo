/**
 * GET /api/admin/contestations — liste des contestations art. 22 (AIPD M11).
 * Filtre optionnel ?status=NEW|REVIEWED. Réservé admin (2FA requise).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth-admin';
import { connectDiditDb } from '@/app/api/didit/db';

const Contestation = require('@/models/Contestation');

export const GET = withAdmin(async (req: NextRequest) => {
  await connectDiditDb();
  const status = req.nextUrl.searchParams.get('status');
  const filter: Record<string, unknown> = {};
  if (status === 'NEW' || status === 'REVIEWED') filter.status = status;

  const items = await Contestation.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('application', 'passportSlug userEmail property')
    .lean();

  const pending = await Contestation.countDocuments({ status: 'NEW' });
  return NextResponse.json({ items, pending });
});
