import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin } from '@/lib/auth-admin';
import { getPagination } from '@/lib/pagination';

 
const Application = require('@/models/Application');

export const GET = withAdmin(async (req: NextRequest) => {
  await connectDiditDb();
  const url = new URL(req.url);
  const { limit, skip } = getPagination(url);

  const status = url.searchParams.get('status') || '';
  const q = (url.searchParams.get('q') || '').trim();

  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { 'profile.firstName': regex },
      { 'profile.lastName': regex },
      { 'profile.email': regex },
      { applyToken: regex },
    ];
  }

  const [items, total] = await Promise.all([
    Application.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('profile status score grade applyToken createdAt property userId')
      .lean(),
    Application.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((a: any) => ({ ...a, _id: String(a._id) })),
    total,
    limit,
    skip,
  });
});
