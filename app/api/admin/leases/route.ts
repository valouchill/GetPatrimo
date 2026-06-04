import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin } from '@/lib/auth-admin';
import { getPagination } from '@/lib/pagination';

 
const Lease = require('@/models/Lease');

export const GET = withAdmin(async (req: NextRequest) => {
  await connectDiditDb();
  const url = new URL(req.url);
  const { limit, skip } = getPagination(url);

  const leaseStatus = url.searchParams.get('leaseStatus') || '';
  const q = (url.searchParams.get('q') || '').trim();

  const filter: Record<string, any> = {};
  if (leaseStatus) filter.leaseStatus = leaseStatus;
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { tenantEmail: regex },
      { tenantFirstName: regex },
      { tenantLastName: regex },
    ];
  }

  const [items, total] = await Promise.all([
    Lease.find(filter)
      .populate('user', 'email')
      .populate('property', 'name address city')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Lease.countDocuments(filter),
  ]);

  return NextResponse.json({
    items: items.map((l: any) => ({ ...l, _id: String(l._id) })),
    total,
    limit,
    skip,
  });
});
