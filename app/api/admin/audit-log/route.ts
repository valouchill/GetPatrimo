import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin } from '@/lib/auth-admin';
import { getPagination } from '@/lib/pagination';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdminAuditLog = require('@/models/AdminAuditLog');

export const GET = withAdmin(async (req: NextRequest) => {
  await connectDiditDb();
  const url = new URL(req.url);
  const { limit, skip } = getPagination(url);

  const action = url.searchParams.get('action') || '';
  const targetType = url.searchParams.get('targetType') || '';
  const actorEmail = (url.searchParams.get('actorEmail') || '').trim().toLowerCase();

  const filter: Record<string, any> = {};
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (actorEmail) filter.actorEmail = actorEmail;

  const [items, total] = await Promise.all([
    AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminAuditLog.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((e: any) => ({ ...e, _id: String(e._id) })),
    total,
    limit,
    skip,
  });
});
