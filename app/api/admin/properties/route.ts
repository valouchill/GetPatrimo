import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin } from '@/lib/auth-admin';
import { getPagination } from '@/lib/pagination';

 
const Property = require('@/models/Property');

export const GET = withAdmin(async (req: NextRequest) => {
  await connectDiditDb();
  const url = new URL(req.url);
  const { limit, skip } = getPagination(url);

  const status = url.searchParams.get('status') || '';
  const archivedParam = url.searchParams.get('archived');
  const q = (url.searchParams.get('q') || '').trim();

  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  if (archivedParam === 'true') filter.archived = true;
  else if (archivedParam === 'false') filter.archived = { $ne: true };
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { address: regex }, { city: regex }, { applyToken: regex }];
  }

  const [items, total] = await Promise.all([
    Property.find(filter)
      .populate('user', 'email firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Property.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((p: any) => ({ ...p, _id: String(p._id) })),
    total,
    limit,
    skip,
  });
});
